import * as fs from 'fs';
import * as path from 'path';
import { parseFileForDependencies, FileMetadata } from './parser/jsParser';

// Cache: file path → last modified + parsed data
interface CacheEntry {
    mtime: number;
    metadata: FileMetadata;
}

const parseCache = new Map<string, CacheEntry>();
const MAX_SCAN_FILES = 4000;
const YIELD_EVERY = 25;

async function yieldToEventLoop() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function escapeForInlineScript(json: string): string {
    return json.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

export async function generateDependencyGraph(
    scanPath: string,
    outputPath: string
): Promise<void> {
    console.log(`[INFO] Scanning directory: ${scanPath}`);
    
    const rootPath = path.resolve(scanPath);
    
    if (!fs.existsSync(rootPath)) {
        throw new Error(`Path does not exist: ${scanPath}`);
    }

    // Find all JS/TS files
    const files = findFiles(rootPath);
    
    if (files.length === 0) {
        console.log('[INFO] No source files found to scan.');
        return;
    }

    if (files.length > MAX_SCAN_FILES) {
        console.log(`[WARN] Large workspace detected. Scanning first ${MAX_SCAN_FILES} files out of ${files.length}.`);
    }

    const scanFiles = files.slice(0, MAX_SCAN_FILES);
    
    console.log(`[INFO] Parsing ${scanFiles.length} files...`);
    
    const dependencyMap: Record<string, FileMetadata> = {};

    for (let i = 0; i < scanFiles.length; i++) {
        const file = scanFiles[i];
        try {
            const relativePath = path.relative(rootPath, file).replace(/\\/g, '/');
            const stats = fs.statSync(file);
            const mtime = stats.mtimeMs;

            const cached = parseCache.get(file);

            if (cached && cached.mtime === mtime) {
                dependencyMap[relativePath] = cached.metadata;
            } else {
                const metadata = parseFileForDependencies(file, rootPath);
                parseCache.set(file, { mtime, metadata });
                dependencyMap[relativePath] = metadata;
            }
        } catch (e) {
            console.error(`[Graphium] Error parsing file ${file}`, e);
        }

        if (i % YIELD_EVERY === 0) {
            console.log(`[INFO] Progress: Parsing files ${i + 1}/${scanFiles.length}`);
            await yieldToEventLoop();
        }
    }

    console.log(`[INFO] Successfully parsed ${Object.keys(dependencyMap).length} files`);
    console.log(`[INFO] Detecting circular dependencies...`);

    const cycles = detectCycles(dependencyMap);
    
    if (cycles.length > 0) {
        console.log(`[WARN] Found ${cycles.length} circular dependencies`);
    } else {
        console.log(`[INFO] No circular dependencies detected`);
    }

    // Generate HTML
    const html = generateHTML(scanPath, dependencyMap, cycles);
    
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`[INFO] Dependency graph generated: ${outputPath}`);
}

function findFiles(rootPath: string): string[] {
    const results: string[] = [];
    // Updated exclude patterns to match VS Code version
    const excludeDirs = new Set(['node_modules', 'out', 'dist', '.next', 'coverage', '.git', 'src/webview/libs', 'media', 'build', '__pycache__', '.vscode']);

    function scan(dir: string) {
        if (results.length >= MAX_SCAN_FILES) {
            return;
        }

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Check if directory should be excluded
                    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                    const shouldExclude = excludeDirs.has(entry.name) || 
                                        entry.name.startsWith('.') ||
                                        excludeDirs.has(relativePath);
                    
                    if (!shouldExclude) {
                        scan(fullPath);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext) && 
                        !entry.name.endsWith('.d.ts') && 
                        !entry.name.endsWith('.min.js')) {
                        results.push(fullPath);
                    }
                }
            }
        } catch (e) {
            // Skip directories we can't read
        }
    }

    scan(rootPath);
    return results;
}

function detectCycles(dependencyMap: Record<string, FileMetadata>): [string, string][] {
    const localFiles = new Set(Object.keys(dependencyMap));
    const cycles: [string, string][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    function detectCycle(node: string) {
        if (!visited.has(node)) {
            visited.add(node);
            recStack.add(node);

            const deps = dependencyMap[node]?.dependencies || [];
            for (const dep of deps) {
                if (!localFiles.has(dep.path)) {
                    continue;
                }
                if (!visited.has(dep.path)) {
                    detectCycle(dep.path);
                } else if (recStack.has(dep.path)) {
                    cycles.push([node, dep.path]);
                }
            }
        }
        recStack.delete(node);
    }

    const nodes = Object.keys(dependencyMap);
    for (let i = 0; i < nodes.length; i++) {
        detectCycle(nodes[i]);
        
        if (i % YIELD_EVERY === 0) {
            console.log(`[INFO] Progress: Detecting cycles ${i + 1}/${nodes.length}`);
        }
    }

    return cycles;
}

function generateHTML(
    projectName: string,
    dependencyMap: Record<string, FileMetadata>,
    cycles: [string, string][]
): string {
    const templatePath = path.join(__dirname, '..', 'templates', 'graph.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    // Convert dependency map to Cytoscape elements
    const elements: any[] = [];
    const localFiles = new Set(Object.keys(dependencyMap));

    // Add nodes
    for (const [filePath, metadata] of Object.entries(dependencyMap)) {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath);
        const type = ext === '.ts' || ext === '.tsx' ? 'typescript' : 'javascript';

        elements.push({
            data: {
                id: filePath,
                label: fileName,
                path: filePath,
                type: type,
                classes: metadata.classes.length,
                functions: metadata.functions.length,
                exports: metadata.exports.length
            }
        });
    }

    // Add edges
    for (const [sourceFile, metadata] of Object.entries(dependencyMap)) {
        for (const dep of metadata.dependencies) {
            if (localFiles.has(dep.path)) {
                elements.push({
                    data: {
                        source: sourceFile,
                        target: dep.path,
                        symbols: dep.symbols.join(', ')
                    }
                });
            }
        }
    }

    // Calculate stats
    const fileCount = Object.keys(dependencyMap).length;
    const fileStats = {
        ts: Object.keys(dependencyMap).filter(f => f.endsWith('.ts') || f.endsWith('.tsx')).length,
        js: Object.keys(dependencyMap).filter(f => f.endsWith('.js') || f.endsWith('.jsx')).length,
        edges: elements.filter(e => e.data.source).length
    };

    // Escape JSON for inline script
    const escapeForInlineScript = (json: string): string => {
        return json.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
    };

    const projectBaseName = path.basename(projectName);

    html = html.replaceAll('{{PROJECT_NAME}}', projectBaseName);
    html = html.replaceAll('{{FILE_COUNT}}', fileCount.toString());
    html = html.replaceAll('{{TS_COUNT}}', fileStats.ts.toString());
    html = html.replaceAll('{{JS_COUNT}}', fileStats.js.toString());
    html = html.replaceAll('{{EDGE_COUNT}}', fileStats.edges.toString());
    html = html.replace('<!--CYTOSCAPE_ELEMENTS-->', escapeForInlineScript(JSON.stringify(elements)));

    return html;
}
