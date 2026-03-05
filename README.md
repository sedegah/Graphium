# Graphium

Graphium visualizes file-level dependencies in JavaScript and TypeScript workspaces directly inside VS Code.

It helps you inspect architecture, spot circular dependencies, and export graph snapshots for reviews or documentation.

## Features

- Interactive dependency graph rendered in a full-size webview.
- Circular dependency detection with visual highlighting.
- Fast scans with file modification time (`mtime`) caching.
- Filter nodes by file name or path.
- Reset graph layout and export the current view to PNG.

## Commands

- `Graphium: Generate Dependency Graph`
- `Graphium: Refresh Graph`
- `Graphium: Export Graph`

## How To Use

1. Open a JavaScript or TypeScript workspace.
2. Run `Graphium: Generate Dependency Graph` from the Command Palette.
3. Use the graph toolbar to filter nodes, reset layout, or export PNG.
4. Click any node to open the corresponding file.

## Notes

- Graphium scans `*.js`, `*.jsx`, `*.ts`, and `*.tsx` files.
- Common generated folders are excluded (`node_modules`, `dist`, `out`, `.next`, `coverage`, `.git`).

## Development

- `npm install`
- `npm run compile`
- Press `F5` in VS Code to launch an Extension Development Host.

## Packaging And Publish

- `npm run package` to build a `.vsix` package.
- `npm run publish` to publish to the VS Code Marketplace.

## License

MIT. See `LICENSE` for details.