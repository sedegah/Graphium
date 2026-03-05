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

export async function generateDependencyGraph(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Graphium: No workspace folder open.');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Find all JS/TS files ignoring node_modules
    const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', '**/node_modules/**');

    const dependencyMap: Record<string, FileMetadata> = {};

    for (const file of files) {
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
    }

    // Detect circular dependencies
    const cycles: [string, string][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    function detectCycle(node: string) {
        if (!visited.has(node)) {
            visited.add(node);
            recStack.add(node);

            const deps = dependencyMap[node]?.dependencies || [];
            for (const dep of deps) {
                if (!visited.has(dep.path)) {
                    detectCycle(dep.path);
                } else if (recStack.has(dep.path)) {
                    cycles.push([node, dep.path]);
                }
            }
        }
        recStack.delete(node);
    }
    for (const node of Object.keys(dependencyMap)) {
        detectCycle(node);
    }

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
            light: vscode.Uri.file(path.join(context.extensionPath, '1.png')),
            dark: vscode.Uri.file(path.join(context.extensionPath, '2.png'))
        };

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        }, null, context.subscriptions);
    }

    const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'index.html').fsPath;
    const cssUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'style.css'));
    const jsUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'script.js'));

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Inject URIs and data safely
    htmlContent = htmlContent
        .replace('{{styleUri}}', cssUri.toString())
        .replace('{{scriptUri}}', jsUri.toString())
        .replace('{{cspSource}}', currentPanel.webview.cspSource)
        .replace('{{graphData}}', JSON.stringify(dependencyMap))
        .replace('{{cycleData}}', JSON.stringify(cycles));

    currentPanel.webview.html = htmlContent;

    // Handle messages from webview
    currentPanel.webview.onDidReceiveMessage(
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
