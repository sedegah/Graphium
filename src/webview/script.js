// window.vscode is acquired in index.html
window.__graphiumBooted = true;

const COLORS = {
    ts: '#007acc',
    js: '#f1e05a',
    jsx: '#61dafb',
    tsx: '#007acc',
    edge: '#ffffff',
    cycle: '#f85149',
    text: '#ffffff'
};

const graphData = window.graphData || {};
const cycleData = window.cycleData || [];
const cyclePairs = new Set(cycleData.map((pair) => pair[0] + '->' + pair[1]));
const circularNodes = new Set();
cycleData.forEach((pair) => {
    if (pair && pair.length >= 2) {
        circularNodes.add(pair[0]);
        circularNodes.add(pair[1]);
    }
});

const nodeList = Object.keys(graphData).map((id) => {
    const data = graphData[id] || {};
    return {
        id,
        label: id.split('/').pop() || id,
        searchText: id.toLowerCase(),
        color: getExtColor(id),
        isCircular: circularNodes.has(id),
        classes: Array.isArray(data.classes) ? data.classes : [],
        functions: Array.isArray(data.functions) ? data.functions : []
    };
});

const localSet = new Set(nodeList.map((n) => n.id));
const edgeList = [];
Object.keys(graphData).forEach((source) => {
    const metadata = graphData[source] || {};
    const deps = Array.isArray(metadata.dependencies) ? metadata.dependencies : [];
    deps.forEach((dep) => {
        const depPath = typeof dep === 'string' ? dep : dep.path;
        if (localSet.has(depPath)) {
            edgeList.push({
                id: source + '->' + depPath,
                source,
                target: depPath,
                isCircular: cyclePairs.has(source + '->' + depPath)
            });
        }
    });
});

let cy = null;
let lastLayoutName = 'cose';
let fallbackApi = null;
const graphScale = {
    nodeCount: nodeList.length,
    edgeCount: edgeList.length
};
const perfMode = {
    large: graphScale.nodeCount > 220 || graphScale.edgeCount > 500,
    huge: graphScale.nodeCount > 550 || graphScale.edgeCount > 1400
};
let filterDebounceHandle = null;

function getExtColor(filename) {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return COLORS.ts;
    if (filename.endsWith('.js')) return COLORS.js;
    if (filename.endsWith('.jsx')) return COLORS.jsx;
    return '#8b949e';
}

function registerPluginsIfAvailable() {
    try {
        if (typeof window.cytoscape !== 'function') {
            return;
        }
        if (typeof window.cytoscapeFcose !== 'undefined') {
            window.cytoscape.use(window.cytoscapeFcose);
        }
        if (typeof window.cytoscapePopper !== 'undefined' && typeof window.Popper !== 'undefined') {
            window.cytoscape.use(window.cytoscapePopper(window.Popper));
        }
    } catch (e) {
        console.error('Plugin registration failed:', e);
    }
}

function renderWithCytoscape(container) {
    if (typeof window.cytoscape !== 'function') {
        return false;
    }

    const elements = [];
    nodeList.forEach((node) => {
        elements.push({ data: node });
    });
    edgeList.forEach((edge) => {
        elements.push({ data: edge });
    });

    const canUseFcose = typeof window.cytoscapeFcose !== 'undefined';
    lastLayoutName = canUseFcose ? 'fcose' : 'cose';
    if (perfMode.large) {
        lastLayoutName = 'cose';
    }

    cy = window.cytoscape({
        container,
        elements,
        pixelRatio: 1,
        hideEdgesOnViewport: perfMode.large,
        textureOnViewport: perfMode.large,
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)',
                    'label': 'data(label)',
                    'color': COLORS.text,
                    'font-size': '11px',
                    'min-zoomed-font-size': perfMode.large ? 11 : 7,
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 8,
                    'width': 25,
                    'height': 25,
                    'border-width': 2,
                    'border-color': '#ffffff'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.5,
                    'line-color': COLORS.edge,
                    'target-arrow-color': COLORS.edge,
                    'target-arrow-shape': 'triangle',
                    'curve-style': perfMode.huge ? 'haystack' : 'bezier',
                    'opacity': 0.8
                }
            },
            {
                selector: 'node[?isCircular]',
                style: {
                    'border-width': 2,
                    'border-color': COLORS.cycle
                }
            },
            {
                selector: 'edge[?isCircular]',
                style: {
                    'line-color': COLORS.cycle,
                    'target-arrow-color': COLORS.cycle,
                    'width': 2,
                    'opacity': 1
                }
            }
        ],
        layout: {
            name: lastLayoutName,
            fit: true,
            padding: 40,
            animate: !perfMode.large
        }
    });

    cy.on('tap', 'node', (evt) => {
        window.vscode.postMessage({ command: 'openFile', text: evt.target.id() });
    });

    if (typeof window.tippy === 'function' && !perfMode.large) {
        cy.nodes().forEach((node) => {
            const data = node.data();
            const classCount = Array.isArray(data.classes) ? data.classes.length : 0;
            const functionCount = Array.isArray(data.functions) ? data.functions.length : 0;
            const content = '<div class="tt-simple">'
                + '<div class="tt-title">' + data.label + '</div>'
                + '<div style="color:#768390; font-size:11px;">' + data.id + '</div>'
                + '<hr style="border:0; border-top:1px solid #30363d; margin: 8px 0;">'
                + '<div style="font-size:11px;">Classes: ' + classCount + '<br>Functions: ' + functionCount + '</div>'
                + '</div>';

            try {
                const tip = window.tippy(document.createElement('div'), {
                    getReferenceClientRect: node.popperRef().getBoundingClientRect,
                    content,
                    allowHTML: true,
                    interactive: true,
                    appendTo: document.body
                });
                node.on('mouseover', () => tip.show());
                node.on('mouseout', () => tip.hide());
            } catch (e) {
                console.error('Tooltip creation failed:', e);
            }
        });
    }

    return true;
}

function renderFallbackSvg(container) {
    const width = Math.max(container.clientWidth || 900, 900);
    const height = Math.max(container.clientHeight || 600, 600);

    const xmlns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(xmlns, 'svg');
    svg.setAttribute('xmlns', xmlns);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    svg.style.background = '#111111';

    const defs = document.createElementNS(xmlns, 'defs');
    const marker = document.createElementNS(xmlns, 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrowPath = document.createElementNS(xmlns, 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', '#ffffff');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(150, Math.min(width, height) * 0.35);

    const positions = new Map();
    nodeList.forEach((node, idx) => {
        const angle = (idx / Math.max(nodeList.length, 1)) * Math.PI * 2;
        positions.set(node.id, {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        });
    });

    const edgeRefs = [];
    edgeList.forEach((edge) => {
        const src = positions.get(edge.source);
        const dst = positions.get(edge.target);
        if (!src || !dst) return;
        const line = document.createElementNS(xmlns, 'line');
        line.setAttribute('x1', String(src.x));
        line.setAttribute('y1', String(src.y));
        line.setAttribute('x2', String(dst.x));
        line.setAttribute('y2', String(dst.y));
        line.setAttribute('stroke', edge.isCircular ? COLORS.cycle : COLORS.edge);
        line.setAttribute('stroke-width', edge.isCircular ? '2.2' : '1.4');
        line.setAttribute('opacity', '0.8');
        line.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(line);
        edgeRefs.push({ edge, line });
    });

    const nodeRefs = [];
    nodeList.forEach((node) => {
        const p = positions.get(node.id);
        if (!p) return;

        const g = document.createElementNS(xmlns, 'g');
        g.style.cursor = 'pointer';

        const circle = document.createElementNS(xmlns, 'circle');
        circle.setAttribute('cx', String(p.x));
        circle.setAttribute('cy', String(p.y));
        circle.setAttribute('r', '12');
        circle.setAttribute('fill', node.color);
        circle.setAttribute('stroke', node.isCircular ? COLORS.cycle : '#ffffff');
        circle.setAttribute('stroke-width', node.isCircular ? '2.5' : '1.8');

        const label = document.createElementNS(xmlns, 'text');
        label.setAttribute('x', String(p.x));
        label.setAttribute('y', String(p.y + 24));
        label.setAttribute('fill', '#ffffff');
        label.setAttribute('font-size', '11');
        label.setAttribute('text-anchor', 'middle');
        label.textContent = node.label;

        g.appendChild(circle);
        g.appendChild(label);

        g.addEventListener('click', () => {
            window.vscode.postMessage({ command: 'openFile', text: node.id });
        });

        const title = document.createElementNS(xmlns, 'title');
        title.textContent = node.id;
        g.appendChild(title);

        svg.appendChild(g);
        nodeRefs.push({ node, g });
    });

    container.innerHTML = '';
    container.appendChild(svg);

    const applyFilter = (raw) => {
        const value = (raw || '').toLowerCase();
        const visible = new Set();

        nodeRefs.forEach((entry) => {
            const hit = !value || entry.node.id.toLowerCase().indexOf(value) >= 0;
            entry.g.style.display = hit ? '' : 'none';
            if (hit) visible.add(entry.node.id);
        });

        edgeRefs.forEach((entry) => {
            const show = !value || (visible.has(entry.edge.source) || visible.has(entry.edge.target));
            entry.line.style.display = show ? '' : 'none';
        });
    };

    const exportPng = () => {
        const serialized = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#111111';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0);
                    const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
                    window.vscode.postMessage({ command: 'saveImage', data: b64 });
                }
            } finally {
                URL.revokeObjectURL(url);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            console.error('Fallback export failed');
        };

        img.src = url;
    };

    return {
        applyFilter,
        reset: () => applyFilter(''),
        exportPng
    };
}

function boot() {
    const container = document.getElementById('cy');
    if (!container) {
        console.error('Graph container #cy not found');
        return;
    }

    if (nodeList.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: #8b949e;">No JS/TS files found to visualize.</div>';
        return;
    }

    registerPluginsIfAvailable();

    try {
        const ok = renderWithCytoscape(container);
        if (!ok) {
            fallbackApi = renderFallbackSvg(container);
        }
    } catch (e) {
        console.error('Cytoscape initialization failed:', e);
        fallbackApi = renderFallbackSvg(container);
    }
}

boot();

const filterInput = document.getElementById('filter');
const resetButton = document.getElementById('reset');
const exportButton = document.getElementById('export');

filterInput.addEventListener('input', (e) => {
    const val = (e.target && e.target.value ? e.target.value : '').toLowerCase();
    if (filterDebounceHandle) {
        window.clearTimeout(filterDebounceHandle);
    }
    filterDebounceHandle = window.setTimeout(() => {
        if (cy) {
            cy.batch(() => {
                if (!val) {
                    cy.elements().show();
                } else {
                    cy.elements().hide();
                    const matches = cy.nodes().filter((n) => {
                        const searchText = n.data('searchText') || n.id().toLowerCase();
                        return searchText.indexOf(val) >= 0;
                    });
                    matches.show();
                    matches.connectedEdges().show();
                }
            });
            return;
        }
        if (fallbackApi) {
            fallbackApi.applyFilter(val);
        }
    }, 120);
});

resetButton.addEventListener('click', () => {
    filterInput.value = '';
    if (cy) {
        cy.elements().show();
        cy.layout({ name: lastLayoutName, animate: !perfMode.large, fit: true, padding: 40 }).run();
        return;
    }
    if (fallbackApi) {
        fallbackApi.reset();
    }
});

function triggerExport() {
    if (cy) {
        const b64 = cy.png({ output: 'base64', full: true });
        window.vscode.postMessage({ command: 'saveImage', data: b64 });
        return;
    }
    if (fallbackApi) {
        fallbackApi.exportPng();
    }
}

exportButton.addEventListener('click', triggerExport);

window.addEventListener('message', (event) => {
    const payload = event && event.data ? event.data : null;
    if (!payload || payload.command !== 'triggerExport') {
        return;
    }
    triggerExport();
});
