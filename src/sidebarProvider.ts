import * as vscode from 'vscode';
import { generateDependencyGraph } from './graphGenerator';

export class SidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'graphiumSidebar';
	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'generate':
					vscode.commands.executeCommand('graphium.generateGraph');
					break;
			}
		});
	}

	public updateStats(stats: { files: number, deps: number, cycles: number }) {
		if (this._view) {
			this._view.webview.postMessage({ command: 'updateStats', data: stats });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
				<style>
					:root {
						--bg: #0d0f12;
						--panel: #16191d;
						--card: #1c2128;
						--border: #30363d;
						--accent: #3794ff;
						--text: #adbac7;
						--text-bright: #ffffff;
                        --text-muted: #768390;
					}

					body {
						padding: 16px;
						color: var(--text);
						font-family: 'Inter', -apple-system, system-ui, sans-serif;
						background-color: var(--bg);
						margin: 0;
						overflow-y: auto;
						display: flex;
						flex-direction: column;
						min-height: 100vh;
					}

                    .header-label {
                        font-size: 10px;
                        font-weight: 700;
                        color: var(--text-muted);
                        text-transform: uppercase;
                        letter-spacing: 0.12em;
                        margin-bottom: 16px;
                    }

                    /* 1:1 DevDeck Banner Card */
					.banner-card {
						background: var(--panel);
						border: 1px solid var(--border);
						border-radius: 12px;
						padding: 24px;
						margin-bottom: 24px;
                        position: relative;
					}

                    .banner-title {
                        font-size: 18px;
                        font-weight: 800;
                        color: var(--text-bright);
                        margin-bottom: 8px;
                    }

                    .banner-desc {
                        font-size: 13px;
                        line-height: 1.5;
                        color: var(--text);
                        margin-bottom: 16px;
                    }

                    .stats-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                        font-size: 11px;
                        font-weight: 500;
                        color: var(--text-muted);
                    }

                    .stat-item span {
                        color: var(--text-bright);
                        font-weight: 700;
                        margin-right: 4px;
                    }

                    /* 1:1 DevDeck Search Bar */
                    .search-container {
                        position: relative;
                        margin-bottom: 20px;
                    }

                    .search-input {
                        width: 100%;
                        background: var(--panel);
                        border: 1px solid var(--border);
                        border-radius: 8px;
                        padding: 12px 40px 12px 16px;
                        color: var(--text-bright);
                        font-size: 13px;
                        box-sizing: border-box;
                        outline: none;
                    }

                    .search-input::placeholder {
                        color: var(--text-muted);
                    }

                    .search-clear {
                        position: absolute;
                        right: 12px;
                        top: 50%;
                        transform: translateY(-50%);
                        font-size: 11px;
                        font-weight: 600;
                        color: var(--text-muted);
                        cursor: pointer;
                        background: none;
                        border: none;
                    }

                    .results-info {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        color: var(--text-muted);
                        margin-bottom: 16px;
                        font-weight: 500;
                    }

                    /* 1:1 DevDeck Action Card */
					.action-card {
						background: var(--panel);
						border: 1px solid var(--border);
						border-radius: 12px;
						padding: 20px;
						margin-bottom: 16px;
                        transition: border-color 0.2s;
					}

                    .action-card:hover {
                        border-color: var(--text-muted);
                    }

                    .card-top {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 12px;
                    }

					.card-title {
						font-weight: 700;
						font-size: 14px;
						color: var(--text-bright);
					}

                    .expand-btn {
                        font-size: 11px;
                        font-weight: 600;
                        color: var(--text-muted);
                        cursor: pointer;
                    }

                    .tag-row {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 16px;
                    }

                    .tag {
                        font-size: 10px;
                        font-weight: 700;
                        padding: 3px 10px;
                        border-radius: 20px;
                        background: var(--bg);
                        border: 1px solid var(--border);
                        color: var(--text-muted);
                        text-transform: capitalize;
                    }

                    /* Generic Recessed Box from screenshots */
                    .recessed-box {
                        background: var(--bg);
                        border-radius: 6px;
                        padding: 10px 14px;
                        font-family: monospace;
                        font-size: 12px;
                        color: var(--text-muted);
                        border: 1px solid rgba(255,255,255,0.03);
                    }

					.btn-primary {
						background: var(--accent);
						color: #ffffff;
						border: none;
						padding: 10px 16px;
						cursor: pointer;
						border-radius: 6px;
						font-size: 13px;
						font-weight: 700;
						transition: all 0.2s;
						display: flex;
						align-items: center;
						justify-content: center;
						gap: 8px;
                        margin-top: 16px;
                        width: 100%;
					}

					.btn-primary:hover {
						filter: brightness(1.1);
					}

					.shortcut-list {
						margin-top: auto;
						display: flex;
						flex-direction: column;
						gap: 8px;
						padding-top: 24px;
					}

					.shortcut {
						display: flex;
						justify-content: space-between;
						font-size: 11px;
						color: var(--text-muted);
					}

					.key {
						background: var(--panel);
						border: 1px solid var(--border);
						padding: 2px 6px;
						border-radius: 4px;
						font-weight: 700;
						color: var(--text-bright);
					}
				</style>
			</head>
			<body>
                <div class="header-label">GRAPHIUM: INTEL HUB</div>

				<div class="banner-card">
					<div class="banner-title">Graphium</div>
                    <div class="banner-desc">Architectural dependency mapping and circular integrity scanner.</div>
                    <div class="stats-row">
                        <div class="stat-item">files <span>--</span></div>
                        <div class="stat-item">deps <span>--</span></div>
                        <div class="stat-item">cycles <span>--</span></div>
                    </div>
				</div>

                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Search modules..." readonly>
                    <button class="search-clear">Clear</button>
                </div>

                <div class="results-info">
                    <span>Scanner ready</span>
                    <span>Ctrl/Cmd+K to focus</span>
                </div>

                <div class="action-card">
                    <div class="card-top">
                        <div class="card-title">Initialize Full Scan</div>
                        <div class="expand-btn">Expand</div>
                    </div>
                    <div class="tag-row">
                        <div class="tag">System</div>
                        <div class="tag" style="color: var(--accent); border-color: var(--accent)">Primary</div>
                    </div>
                    <div class="recessed-box">
                        graphium.generateGraph
                    </div>
                    <button class="btn-primary" onclick="generate()">
                        Run Scan
                    </button>
                </div>

				<div class="shortcut-list">
					<div class="shortcut">
						<span>Focus Graph Search</span>
						<span class="key">CMD + K</span>
					</div>
					<div class="shortcut">
						<span>Reset View</span>
						<span class="key">ESC</span>
					</div>
				</div>

				<script>
					const vscode = acquireVsCodeApi();
					function generate() {
						vscode.postMessage({ command: 'generate' });
					}

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'updateStats') {
                            const { files, deps, cycles } = message.data;
                            const statsRow = document.querySelector('.stats-row');
                            if (statsRow) {
                                statsRow.innerHTML = \`
                                    <div class="stat-item">files <span>\${files}</span></div>
                                    <div class="stat-item">deps <span>\${deps}</span></div>
                                    <div class="stat-item">cycles <span>\${cycles}</span></div>
                                \`;
                            }
                        }
                    });
				</script>
			</body>
			</html>`;
	}
}
