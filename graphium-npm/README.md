# Graphium CLI

A command-line tool for generating interactive dependency graphs from JavaScript and TypeScript projects. Uses Babel AST parsing for accurate dependency detection and visualizes your codebase structure with an interactive network graph rendered in your browser.

## Features

- **Babel AST Parsing** - Uses Babel parser for accurate analysis of JavaScript and TypeScript code
- **Smart Dependency Resolution** - Resolves relative imports, index files, and extension variants (.js, .ts, .jsx, .tsx)
- **Comprehensive Metadata** - Extracts classes, functions, exports, and import symbols from each file
- **Circular Dependency Detection** - Automatically detects and reports circular dependencies in your codebase
- **File Caching** - Caches parsed files based on modification time for faster subsequent runs
- **Interactive Visualization** - Powered by Cytoscape.js with force-directed layout for optimal node positioning
- **Enhanced Tooltips** - Hover over nodes to see file metadata (classes, functions, exports)
- **Real-time Statistics** - View total files, TypeScript/JavaScript counts, and dependency edge counts
- **Auto-open in Browser** - Generated HTML automatically opens for immediate viewing
- **Zero Configuration** - Works out of the box on any JavaScript or TypeScript project

## Installation

### Global Installation

```bash
npm install -g graphium-cli
```

### NPX (No Installation Required)

```bash
npx graphium-cli ./my-project
```

## Usage

### Basic Usage

```bash
graphium [project-path] [output-file]
```

### Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `project-path` | string | `process.cwd()` | Path to the project directory to analyze |
| `output-file` | string | `dependency.html` | Output HTML file path |

### Examples

**Analyze current directory:**
```bash
graphium
```

**Analyze specific project:**
```bash
graphium ./my-project
```

**Custom output filename:**
```bash
graphium ./my-project custom-graph.html
```

**Analyze and specify both:**
```bash
graphium /path/to/project /output/graph.html
```

## Output

The tool generates a standalone HTML file containing:

- **Interactive Network Graph** - Nodes represent files, edges represent dependencies with imported symbols
- **Project Statistics** - Total files, language breakdown, dependency count, circular dependency warnings
- **Color-coded Nodes** - TypeScript files (blue), JavaScript files (yellow)
- **Detailed Tooltips** - File path, type, classes, functions, and exports count
- **Dark Mode UI** - Professional dark theme optimized for readability

### Supported File Types

- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)

### Excluded Directories

The following directories are automatically excluded from scanning:
- `node_modules`
- `dist`, `out`, `build`
- `.next`, `coverage`
- `.git`, `.vscode`
- `libs`, `media`

### Import/Require Detection

Graphium analyzes the following import patterns using Babel AST parsing:

```javascript
// ES6 imports
import { Component } from './component';
import React from 'react';
import * as utils from './utils';

// CommonJS requires  
const utils = require('./utils');
const express = require('express');

// Dynamic imports
const module = await import('./module');
```

**Note:** Only relative imports (starting with `./` or `../`) create edges in the dependency graph. External packages are tracked but not visualized to focus on internal project structure.

## How It Works

1. **File Discovery** - Recursively scans project directory for `.js`, `.ts`, `.jsx`, `.tsx` files
2. **Babel AST Parsing** - Parses each file into an Abstract Syntax Tree for accurate code analysis
3. **Metadata Extraction** - Extracts imports, exports, classes, functions, and their symbols
4. **File Caching** - Caches parsed results based on file modification time for performance
5. **Dependency Resolution** - Resolves relative paths to actual files (handles index files, extension variants)
6. **Circular Dependency Detection** - Uses depth-first search to detect cycles in the dependency graph
7. **Graph Generation** - Creates Cytoscape.js network with nodes (files) and edges (dependencies)
8. **HTML Export** - Embeds graph data and metadata into standalone HTML template
9. **Auto-open** - Launches default browser to display the interactive visualization

## Interactive Features

- **Drag and Drop** - Rearrange nodes to explore connections
- **Click Highlighting** - Click a node to highlight it and its dependencies
- **Search/Filter** - Type to filter nodes by filename or path
- **Zoom and Pan** - Mouse wheel to zoom, click and drag background to pan
- **Reset View** - Restore original layout and zoom level
- **Fit to Screen** - Automatically fit all nodes in viewport
- **Export PNG** - Save graph as a high-resolution PNG image

## Requirements

- Node.js 14.0.0 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Development

### Clone and Build

```bash
git clone https://github.com/sedegah/Graphium.git
cd Graphium/graphium-npm
npm install
npm run build
```

### Run Locally

```bash
npm start
```

### Project Structure

```
graphium-npm/
├── src/
│   ├── cli.ts              # CLI entry point
│   └── graphGenerator.ts   # Core logic for parsing and graph generation
├── templates/
│   └── graph.html          # HTML template with Cytoscape visualization
├── dist/                   # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## Technical Details

### Dependencies

- **TypeScript** - Type-safe development
- **Cytoscape.js** - Graph visualization library (loaded via CDN in output)
- **Cytoscape COSE-Bilkent** - Force-directed layout algorithm

### Output File Size

Generated HTML files are typically 5-10 KB plus graph data (varies by project size).

## Troubleshooting

### Graph not opening automatically

If the browser doesn't open automatically (common in headless environments):

```
[INFO] View the graph at: file:///path/to/dependency.html
```

Copy the file path and open it manually in your browser.

### No files detected

Ensure your project contains `.js` or `.ts` files in non-ignored directories.

### Missing dependencies in graph

- Verify imports use relative paths (`./` or `../`)
- Check file extensions match (`.js`, `.ts`)
- External package imports are intentionally not shown

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License

Copyright (c) 2026 Kimathi Elikplim Sedegah

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Links

- NPM Package: https://www.npmjs.com/package/graphium-cli
- GitHub Repository: https://github.com/sedegah/Graphium
- Issues: https://github.com/sedegah/Graphium/issues
