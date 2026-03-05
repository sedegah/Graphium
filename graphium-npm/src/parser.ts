import * as fs from 'fs';
import * as path from 'path';
import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';

export interface Dependency {
    path: string;
    symbols: string[];
}

export interface FileMetadata {
    dependencies: Dependency[];
    exports: string[];
    classes: string[];
    functions: string[];
}

export function parseFileForDependencies(filePath: string, rootPath: string): FileMetadata {
    const code = fs.readFileSync(filePath, 'utf-8');

    const ast = babelParser.parse(code, {
        sourceType: 'module',
        plugins: [
            'typescript',
            'jsx'
        ]
    });

    const metadata: FileMetadata = {
        dependencies: [],
        exports: [],
        classes: [],
        functions: []
    };

    const absoluteDir = path.dirname(filePath);

    // Helper to resolve and record dependency
    const addDependency = (importPath: string, symbols: string[] = []) => {
        let resolvedPath = importPath;
        if (importPath.startsWith('.')) {
            let absoluteImport = path.resolve(absoluteDir, importPath);

            if (!path.extname(absoluteImport)) {
                if (fs.existsSync(absoluteImport + '.ts')) absoluteImport += '.ts';
                else if (fs.existsSync(absoluteImport + '.js')) absoluteImport += '.js';
                else if (fs.existsSync(absoluteImport + '.tsx')) absoluteImport += '.tsx';
                else if (fs.existsSync(absoluteImport + '.jsx')) absoluteImport += '.jsx';
                else if (fs.existsSync(path.join(absoluteImport, 'index.ts'))) absoluteImport = path.join(absoluteImport, 'index.ts');
                else if (fs.existsSync(path.join(absoluteImport, 'index.js'))) absoluteImport = path.join(absoluteImport, 'index.js');
            }

            resolvedPath = path.relative(rootPath, absoluteImport).replace(/\\/g, '/');
        }

        const existing = metadata.dependencies.find(d => d.path === resolvedPath);
        if (existing) {
            existing.symbols = Array.from(new Set([...existing.symbols, ...symbols]));
        } else {
            metadata.dependencies.push({ path: resolvedPath, symbols });
        }
    };

    traverse(ast, {
        ImportDeclaration(pathNode: any) {
            const symbols: string[] = [];
            pathNode.node.specifiers.forEach((spec: any) => {
                if (spec.type === 'ImportSpecifier') {
                    symbols.push(spec.imported.name);
                } else if (spec.type === 'ImportDefaultSpecifier') {
                    symbols.push('default');
                } else if (spec.type === 'ImportNamespaceSpecifier') {
                    symbols.push('*');
                }
            });
            addDependency(pathNode.node.source.value, symbols);
        },
        CallExpression(pathNode: any) {
            if (pathNode.node.callee.type === 'Import' ||
                (pathNode.node.callee.type === 'Identifier' && pathNode.node.callee.name === 'require')) {
                const arg = pathNode.node.arguments[0];
                if (arg && arg.type === 'StringLiteral') {
                    addDependency(arg.value);
                }
            }
        },
        ExportNamedDeclaration(pathNode: any) {
            if (pathNode.node.declaration) {
                if (pathNode.node.declaration.type === 'FunctionDeclaration') {
                    metadata.exports.push(pathNode.node.declaration.id.name);
                    metadata.functions.push(pathNode.node.declaration.id.name);
                } else if (pathNode.node.declaration.type === 'ClassDeclaration') {
                    metadata.exports.push(pathNode.node.declaration.id.name);
                    metadata.classes.push(pathNode.node.declaration.id.name);
                } else if (pathNode.node.declaration.type === 'VariableDeclaration') {
                    pathNode.node.declaration.declarations.forEach((decl: any) => {
                        if (decl.id && decl.id.name) {
                            metadata.exports.push(decl.id.name);
                        }
                    });
                }
            } else if (pathNode.node.specifiers) {
                pathNode.node.specifiers.forEach((spec: any) => {
                    if (spec.exported && spec.exported.name) {
                        metadata.exports.push(spec.exported.name);
                    }
                });
            }
        },
        ExportDefaultDeclaration(pathNode: any) {
            metadata.exports.push('default');
            if (pathNode.node.declaration.type === 'FunctionDeclaration' && pathNode.node.declaration.id) {
                metadata.functions.push(pathNode.node.declaration.id.name);
            } else if (pathNode.node.declaration.type === 'ClassDeclaration' && pathNode.node.declaration.id) {
                metadata.classes.push(pathNode.node.declaration.id.name);
            }
        },
        ClassDeclaration(pathNode: any) {
            if (pathNode.node.id && pathNode.node.id.name && !metadata.classes.includes(pathNode.node.id.name)) {
                metadata.classes.push(pathNode.node.id.name);
            }
        },
        FunctionDeclaration(pathNode: any) {
            if (pathNode.node.id && pathNode.node.id.name && !metadata.functions.includes(pathNode.node.id.name)) {
                metadata.functions.push(pathNode.node.id.name);
            }
        }
    });

    // Remove duplicates
    metadata.exports = Array.from(new Set(metadata.exports));
    metadata.classes = Array.from(new Set(metadata.classes));
    metadata.functions = Array.from(new Set(metadata.functions));

    return metadata;
}
