import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Graphium is now active.');

    const sidebarProvider = new SidebarProvider(context.extensionUri);

    const runGraphGeneration = async () => {
        try {
            const graphModule = await import('./graphGenerator.js');
            const stats = await graphModule.generateDependencyGraph(context);
            if (stats) {
                sidebarProvider.updateStats(stats);
            }
        } catch (error) {
            console.error('Graphium: Failed to generate dependency graph.', error);
            void vscode.window.showErrorMessage('Graphium: Failed to generate dependency graph. Check Extension Host logs for details.');
        }
    };

    const generateGraphCmd = vscode.commands.registerCommand('graphium.generateGraph', async () => {
        await runGraphGeneration();
    });

    const refreshGraphCmd = vscode.commands.registerCommand('graphium.refreshGraph', async () => {
        await runGraphGeneration();
    });

    const exportGraphCmd = vscode.commands.registerCommand('graphium.exportGraph', async () => {
        try {
            const graphModule = await import('./graphGenerator.js');
            if (graphModule.currentPanel) {
                void graphModule.currentPanel.webview.postMessage({ command: 'triggerExport' });
            } else {
                void vscode.window.showErrorMessage('Graphium: No active graph to export. Please generate one first.');
            }
        } catch (error) {
            console.error('Graphium: Failed to export graph.', error);
            void vscode.window.showErrorMessage('Graphium: Failed to export graph. Check Extension Host logs for details.');
        }
    });

    const toggleFilterCmd = vscode.commands.registerCommand('graphium.toggleFilter', () => {
        vscode.window.showInformationMessage('Graphium: Toggling filter...');
    });

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            sidebarProvider
        )
    );

    context.subscriptions.push(generateGraphCmd, refreshGraphCmd, exportGraphCmd, toggleFilterCmd);
}

export function deactivate() { }
