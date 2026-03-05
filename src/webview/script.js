// window.vscode is acquired in index.html

// Register plugins (required for rendering)
try {
    if (typeof window.cytoscapeFcose !== 'undefined') {
        cytoscape.use(window.cytoscapeFcose);
    }
    if (typeof window.cytoscapePopper !== 'undefined') {
        // In UMD/Local, cytoscapePopper is a factory that needs the Popper library
        cytoscape.use(window.cytoscapePopper(window.Popper));
    }
} catch (e) {
    console.error('Plugin registration failed:', e);
}

const COLORS = {
    ts: '#007acc',
    js: '#f1e05a',
    jsx: '#61dafb',
    tsx: '#007acc',
    edge: '#ffffff',
    cycle: '#f85149',
    text: '#ffffff'
};

const getExtColor = (filename) => {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return COLORS.ts;
    if (filename.endsWith('.js')) return COLORS.js;
    if (filename.endsWith('.jsx')) return COLORS.jsx;
    return '#8b949e';
};

// V2: Building elements manually in JS from the dependencyMap
const elements = [];
const graphData = window.graphData || {};
const cycleData = window.cycleData || [];

Object.keys(graphData).forEach(id => {
    const data = graphData[id];
    elements.push({
        data: {
            id,
            label: id.split('/').pop(),
            color: getExtColor(id),
            isCircular: cycleData.some(c => c[0] === id || c[1] === id),
            ...data
        }
    });
});

Object.keys(graphData).forEach(source => {
    const metadata = graphData[source];
    if (metadata.dependencies) {
        metadata.dependencies.forEach(dep => {
            const depPath = typeof dep === 'string' ? dep : dep.path;
            if (graphData[depPath]) { // Only draw if target exists
                const isCircular = cycleData.some(c => c[0] === source && c[1] === depPath);
                elements.push({
                    data: {
                        id: `${source}->${depPath}`,
                        source: source,
                        target: depPath,
                        isCircular: isCircular
                    }
                });
            }
        });
    }
});

let cy;
try {
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)',
                    'label': 'data(label)',
                    'color': COLORS.text,
                    'font-size': '11px',
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
                    'curve-style': 'bezier',
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
            name: 'fcose',
            quality: 'default',
            fit: true,
            padding: 50,
            animate: true,
            nodeSeparation: 75,
            idealEdgeLength: 100
        }
    });

    // Simple tooltips
    cy.nodes().forEach(node => {
        const data = node.data();
        const content = `
            <div class="tt-simple">
                <div class="tt-title">${data.label}</div>
                <div style="color:#768390; font-size:11px;">${data.id}</div>
                <hr style="border:0; border-top:1px solid #30363d; margin: 8px 0;">
                <div style="font-size:11px;">
                    Classes: ${data.classes?.length || 0}<br>
                    Functions: ${data.functions?.length || 0}
                </div>
            </div>
        `;

        try {
            const tip = tippy(document.createElement('div'), {
                getReferenceClientRect: node.popperRef().getBoundingClientRect,
                content: content,
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

} catch (e) {
    console.error('Cytoscape initialization failed:', e);
}

if (cy) {
    cy.on('tap', 'node', (evt) => {
        vscode.postMessage({ command: 'openFile', text: evt.target.id() });
    });
}

document.getElementById('filter').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    if (!val) {
        cy.elements().show();
    } else {
        cy.elements().hide();
        const matches = cy.nodes().filter(n => n.id().toLowerCase().includes(val));
        matches.show();
        matches.connectedEdges().show();
    }
});

document.getElementById('reset').addEventListener('click', () => {
    document.getElementById('filter').value = '';
    cy.elements().show();
    cy.layout({ name: 'fcose', animate: true }).run();
});

document.getElementById('export').addEventListener('click', () => {
    const b64 = cy.png({ output: 'base64', full: true });
    vscode.postMessage({ command: 'saveImage', data: b64 });
});
