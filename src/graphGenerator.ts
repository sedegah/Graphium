import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseFileForDependencies, FileMetadata } from './parser/jsParser';

// Cache: file path → last modified + parsed data
interface CacheEntry {
    mtime: number;
    metadata: FileMetadata;
}

const parseCache = new Map<string, CacheEntry>();
export let currentPanel: vscode.WebviewPanel | undefined;
let webviewMessageDisposable: vscode.Disposable | undefined;
const MAX_SCAN_FILES = 4000;
const YIELD_EVERY = 25;

async function yieldToEventLoop() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function escapeForInlineScript(json: string): string {
    return json.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

export async function generateDependencyGraph(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Graphium: No workspace folder open.');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Find all JS/TS files while ignoring common generated directories.
    const foundFiles = await vscode.workspace.findFiles(
        '**/*.{js,ts,jsx,tsx}',
        '**/{node_modules,out,dist,.next,coverage,.git,src/webview/libs,media}/**'
    );

    const files = foundFiles.filter((file) => {
        const p = file.fsPath;
        return !p.endsWith('.d.ts') && !p.endsWith('.min.js');
    });

    if (files.length === 0) {
        void vscode.window.showInformationMessage('Graphium: No source files found to scan.');
        return { files: 0, deps: 0, cycles: 0 };
    }

    if (files.length > MAX_SCAN_FILES) {
        void vscode.window.showWarningMessage(`Graphium: Large workspace detected. Scanning first ${MAX_SCAN_FILES} files out of ${files.length} to keep VS Code responsive.`);
    }

    const scanFiles = files.slice(0, MAX_SCAN_FILES);

    const generationResult = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Graphium: Generating dependency graph...',
            cancellable: true
        },
        async (progress, token) => {
            const dependencyMap: Record<string, FileMetadata> = {};

            for (let i = 0; i < scanFiles.length; i++) {
                if (token.isCancellationRequested) {
                    void vscode.window.showInformationMessage('Graphium: Scan cancelled.');
                    return;
                }

                const file = scanFiles[i];
                try {
                    const relativePath = path.relative(rootPath, file.fsPath).replace(/\\/g, '/');
                    const stats = fs.statSync(file.fsPath);
                    const mtime = stats.mtimeMs;

                    const cached = parseCache.get(file.fsPath);

                    if (cached && cached.mtime === mtime) {
                        dependencyMap[relativePath] = cached.metadata;
                    } else {
                        const metadata = parseFileForDependencies(file.fsPath, rootPath);
                        parseCache.set(file.fsPath, { mtime, metadata });
                        dependencyMap[relativePath] = metadata;
                    }
                } catch (e) {
                    console.error(`Graphium: Error parsing file ${file.fsPath}`, e);
                }

                if (i % YIELD_EVERY === 0) {
                    progress.report({ message: `Parsing files ${i + 1}/${scanFiles.length}` });
                    await yieldToEventLoop();
                }
            }

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
                if (token.isCancellationRequested) {
                    void vscode.window.showInformationMessage('Graphium: Cycle detection cancelled.');
                    return;
                }

                detectCycle(nodes[i]);

                if (i % YIELD_EVERY === 0) {
                    progress.report({ message: `Detecting cycles ${i + 1}/${nodes.length}` });
                    await yieldToEventLoop();
                }
            }

            return { dependencyMap, cycles };
        }
    );

    if (!generationResult) {
        return;
    }

    const { dependencyMap, cycles } = generationResult;

    // Create or reveal webview
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
    } else {
        currentPanel = vscode.window.createWebviewPanel(
            'graphiumView',
            'Dependency Graph',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src', 'webview')]
            }
        );

        currentPanel.iconPath = {
            light: vscode.Uri.file(path.join(context.extensionPath, 'media', 'graphium-sidebar.svg')),
            dark: vscode.Uri.file(path.join(context.extensionPath, 'media', 'graphium-sidebar.svg'))
        };

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
            webviewMessageDisposable?.dispose();
            webviewMessageDisposable = undefined;
        }, null, context.subscriptions);
    }

    const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'index.html').fsPath;
    const webview = currentPanel.webview;
    const extensionUri = context.extensionUri;

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'style.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'script.js'));

    // Local libraries
    const libCytoscape = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'cytoscape.min.js'));
    const libLayoutBase = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'layout-base.js'));
    const libCoseBase = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'cose-base.js'));
    const libFcose = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'cytoscape-fcose.js'));
    const libPopper = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'popper.min.js'));
    const libTippy = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'tippy.umd.min.js'));
    const libCyPopper = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'cytoscape-popper.js'));
    const libTippyCss = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'libs', 'tippy.css'));

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Inject URIs and data safely
    htmlContent = htmlContent
        .replace('{{styleUri}}', cssUri.toString())
        .replace('{{scriptUri}}', jsUri.toString())
        .replace('{{cspSource}}', webview.cspSource)
        .replace('{{graphData}}', escapeForInlineScript(JSON.stringify(dependencyMap)))
        .replace('{{cycleData}}', escapeForInlineScript(JSON.stringify(cycles)))
        // Libraries
        .replace('{{libCytoscape}}', libCytoscape.toString())
        .replace('{{libLayoutBase}}', libLayoutBase.toString())
        .replace('{{libCoseBase}}', libCoseBase.toString())
        .replace('{{libFcose}}', libFcose.toString())
        .replace('{{libPopper}}', libPopper.toString())
        .replace('{{libTippy}}', libTippy.toString())
        .replace('{{libCyPopper}}', libCyPopper.toString())
        .replace('{{libTippyCss}}', libTippyCss.toString());

    webview.html = htmlContent;

    // Ensure only one message handler is active for the panel lifecycle.
    webviewMessageDisposable?.dispose();

    // Handle messages from webview
    webviewMessageDisposable = webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'log':
                    console.log(`[Webview Log]: ${message.text}`);
                    return;
                case 'error':
                    console.error(`[Webview Error]: ${message.text}`);
                    vscode.window.showErrorMessage(`Graphium Webview Error: ${message.text}`);
                    return;
                case 'openFile':
                    const filePath = path.join(rootPath, message.text);
                    if (fs.existsSync(filePath)) {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                        await vscode.window.showTextDocument(doc);
                    } else {
                        vscode.window.showErrorMessage(`Graphium: File not found: ${message.text}`);
                    }
                    return;
                case 'saveImage':
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(rootPath, 'graphium-export.png')),
                        filters: { 'Images': ['png'] }
                    });
                    if (uri) {
                        fs.writeFileSync(uri.fsPath, Buffer.from(message.data, 'base64'));
                        vscode.window.showInformationMessage('Graphium: Exported graph to ' + path.basename(uri.fsPath));
                    }
                    return;
            }
        },
        undefined,
        context.subscriptions
    );

    return {
        files: Object.keys(dependencyMap).length,
        deps: Object.values(dependencyMap).reduce((acc, cur) => acc + (cur.dependencies?.length || 0), 0),
        cycles: cycles.length
    };
}
