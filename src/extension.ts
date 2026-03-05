import * as vscode from 'vscode';
import { generateDependencyGraph, currentPanel } from './graphGenerator';
import { SidebarProvider } from './sidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Graphium is now active.');

    const generateGraphCmd = vscode.commands.registerCommand('graphium.generateGraph', async () => {
        const stats = await generateDependencyGraph(context);
        if (stats) sidebarProvider.updateStats(stats);
    });

    const refreshGraphCmd = vscode.commands.registerCommand('graphium.refreshGraph', async () => {
        const stats = await generateDependencyGraph(context);
        if (stats) sidebarProvider.updateStats(stats);
    });

    const exportGraphCmd = vscode.commands.registerCommand('graphium.exportGraph', () => {
        if (currentPanel) {
            currentPanel.webview.postMessage({ command: 'triggerExport' });
        } else {
            vscode.window.showErrorMessage('Graphium: No active graph to export. Please generate one first.');
        }
    });

    const toggleFilterCmd = vscode.commands.registerCommand('graphium.toggleFilter', () => {
        vscode.window.showInformationMessage('Graphium: Toggling filter...');
    });

    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            sidebarProvider
        )
    );

    context.subscriptions.push(generateGraphCmd, refreshGraphCmd, exportGraphCmd, toggleFilterCmd);
}

export function deactivate() { }
