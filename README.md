# Graphium

Graphium is a high-performance visual dependency analyzer for modern JavaScript and TypeScript codebases. It extracts detailed AST-level insights and represents them as a beautifully interactive graph right within a VS Code panel, designed with keyboard-first workflows in mind.

## Features

- **Interactive Dependency Mapping**: Generates a webview using Cytoscape.js highlighting the exact file-level imports across your repository.
- **Deep AST Extraction**: Extracts exported functions and classes. Hover over any node in the graph to see exactly what constructs are exported from that file.
- **Fast Generation**: Uses modified-time caching (`mtime`) so only files that have changed map re-parse.
- **DevDeck Inspired UI**: Clean, keyboard shortcut driven (`Ctrl+K` to search), dark-themed VS Code native aesthetic.
- **Cycle Detection**: Automatically flags cyclic dependency loops in your architecture, rendering their edges in bright red.
- **Export to PNG**: Found something interesting? Type `Graphium: Export Graph` to save the structural visualization.

## Usage

1. Open a workspace folder that contains a JS or TS project.
2. Open the command palette (`Ctrl/Shift/P` or `Cmd/Shift/P`).
3. Run `Graphium: Generate Dependency Graph`.
4. Press `Ctrl+K` while inside the Graphium panel to filter out specific services or files.

## Extension Settings

Graphium is designed to be zero-config.

## Development

- `npm install`
- `npm run compile`

## Release Notes

### 0.1.0

Initial MVP Release featuring JS/TS Babel Parsing, Circular Dependency Detection, Cytoscape `fcose` layout, image exporting, matching DevDeck styling rules.