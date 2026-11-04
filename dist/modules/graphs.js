import { CubeState, COLORS, FACES, FACE_NORMALS, normalFace, faceIndex, invertAlgorithm } from './cube.js';

/* All diagrams below are projections of the live model. They are never static
 * illustrations pretending to describe a different cube state. */
// Graphs inherit the workbench palette rather than painting a light card into
// a dark workspace. Sticker colors always come from the authoritative model.
const INK = 'var(--graph-ink, #e5edf5)';
const MUTED = 'var(--graph-muted, #8e9bac)';
const LINE = 'var(--graph-line, #344352)';
const NODE = 'var(--graph-node, #16212c)';
const TARGET = 'var(--graph-target, #1b2935)';
const SELECTED = 'var(--graph-selected, #1d3b40)';
const ACCENT = 'var(--graph-accent, #6ce5d2)';
const PREVIEW = 'var(--graph-preview, #b6ec6a)';
const AMBER = 'var(--graph-warning, #ffc477)';
const SOLVED = 'var(--graph-solved, #81d3a1)';
const LABEL_BG = 'var(--graph-label-bg, #101923)';
const TAU = Math.PI * 2;
const FACE_ORDER = 'URFDLB';
const EDGE_SLOTS = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
const CORNER_SLOTS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
let diagramId = 0;
const mountedGraphs = new WeakMap();
const mountedNets = new WeakMap();
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-7);
const pointKey = a => a.join(',');

export function pieceLabel(piece) {
  return canonicalLabel(piece.stickers.map(s => s.color));
}

function canonicalLabel(faces) {
  const key = faces.slice().sort().join('');
  const conventional = [...EDGE_SLOTS, ...CORNER_SLOTS].find(s => s.split('').sort().join('') === key);
  return conventional || faces.slice().sort((a, b) => FACE_ORDER.indexOf(a) - FACE_ORDER.indexOf(b)).join('');
}

function slotLabel(position, size) {
  const h = (size - 1) / 2;
  const faces = [];
  if (position[1] === h) faces.push('U');
  if (position[0] === h) faces.push('R');
  if (position[2] === h) faces.push('F');
  if (position[1] === -h) faces.push('D');
  if (position[0] === -h) faces.push('L');
  if (position[2] === -h) faces.push('B');
  return canonicalLabel(faces);
}

function homeAligned(piece) {
  return same(piece.position, piece.home) && piece.stickers.every(s => same(s.normal, FACE_NORMALS[s.color]));
}

/** Put positions and sticker normals into the live color-center frame. Camera
 * rotations do not touch the model; x/y/z and slice turns do, so treating the
 * initial world axes as the color frame would incorrectly report a rotated
 * solved cube as 26 misplaced pieces. The three center normals form an exact
 * signed-permutation basis, making this conversion integer-only. */
function inCenterFrame(cube) {
  if (cube.size !== 3) return cube;
  const centers = Object.fromEntries(cube.cubies.filter(p => p.stickers.length === 1).map(p => [p.stickers[0].color, p.stickers[0].normal]));
  if (!centers.R || !centers.U || !centers.F) return cube;
  const basis = [centers.R, centers.U, centers.F];
  if (basis.every((v, axis) => v.every((component, i) => component === (i === axis ? 1 : 0)))) return cube;
  const project = v => basis.map(axis => axis.reduce((sum, component, i) => sum + component * v[i], 0));
  const normalized = cube.clone();
  for (const piece of normalized.cubies) {
    piece.position = project(piece.position);
    for (const sticker of piece.stickers) sticker.normal = project(sticker.normal);
  }
  // This derived view is a coordinate transform, not a played move sequence.
  normalized.history = null;
  return normalized;
}

function pieceNode(piece, size) {
  const label = pieceLabel(piece);
  const kind = ['core', 'center', 'edge', 'corner'][piece.stickers.length];
  return {
    id: piece.id, pieceId: piece.id, label,
    colors: piece.stickers.map(s => COLORS[s.color]),
    kind, solved: homeAligned(piece),
    slot: slotLabel(piece.position, size),
    description: `${label} ${kind}; currently at ${slotLabel(piece.position, size)}; ${homeAligned(piece) ? 'home and aligned' : 'away from its reference home'}`,
    piece,
  };
}

function layoutRing(nodes, cx, cy, radius, start = -Math.PI / 2) {
  nodes.forEach((node, i) => {
    const angle = start + TAU * i / nodes.length;
    node.x = cx + Math.cos(angle) * radius;
    node.y = cy + Math.sin(angle) * radius;
  });
}

function topologyData(cube) {
  const nodes = cube.cubies.map(p => pieceNode(p, cube.size));
  const centers = nodes.filter(n => n.kind === 'center').sort((a, b) => a.id.localeCompare(b.id));
  const edges = nodes.filter(n => n.kind === 'edge').sort((a, b) => a.id.localeCompare(b.id));
  const corners = nodes.filter(n => n.kind === 'corner').sort((a, b) => a.id.localeCompare(b.id));
  if (centers.length > 24) {
    // A sunflower packing keeps all 150 center pieces of a 7×7 individually
    // visible rather than stacking them on a single overcrowded circle.
    centers.forEach((node, i) => {
      const radius = 100 * Math.sqrt((i + .5) / centers.length);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      node.x = 320 + radius * Math.cos(angle);
      node.y = 220 + radius * Math.sin(angle);
    });
  } else layoutRing(centers, 320, 220, cube.size <= 3 ? 62 : 75);
  layoutRing(edges, 320, 220, cube.size > 3 ? 143 : 132, -Math.PI / 2 + Math.PI / 12);
  layoutRing(corners, 320, 220, 190, -Math.PI / 2 + Math.PI / 8);
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].piece.position;
      const b = nodes[j].piece.position;
      if (Math.abs(a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0) - 1) < 1e-7) {
        links.push({ source: nodes[i].id, target: nodes[j].id });
      }
    }
  }
  return {
    title: 'Physical piece connections',
    subtitle: `Nodes are physical cubies; lines join face-adjacent cubies in the current state. ${cube.size === 3 ? 'Slots follow the live color centers. ' : 'Slots use the fixed original frame. '}Select a node to find it on the cube.`,
    nodes, edges: links,
    rings: [62, 132, 190],
    stats: { pieces: nodes.length, connections: links.length, corners: corners.length, edges: edges.length, centers: centers.length },
  };
}

function crossData(cube) {
  if (cube.size !== 3) {
    return { title: 'Cross training uses a 3×3', subtitle: cube.size === 2 ? 'A 2×2 has corners only. Choose the piece graph to study its eight corners.' : 'Reduce a larger cube to paired edges first, or switch to 3×3 for the four-edge cross graph.', nodes: [], edges: [], stats: { solved: 0, targets: 0 } };
  }
  const cross = cube.cubies.filter(p => p.stickers.length === 2 && p.stickers.some(s => s.color === 'D'));
  const center = cube.cubies.find(p => p.stickers.length === 1 && p.stickers[0].color === 'D');
  const nodes = [{ ...pieceNode(center, cube.size), x: 320, y: 220, radius: 29, secondary: 'D CROSS' }];
  const links = [];
  const destinations = { F: [320, 315], R: [415, 220], B: [320, 125], L: [225, 220] };
  const origins = { F: [320, 398], R: [498, 220], B: [320, 42], L: [142, 220] };
  let solved = 0;
  for (const piece of cross) {
    const other = piece.stickers.find(s => s.color !== 'D').color;
    const p = pieceNode(piece, cube.size);
    const [tx, ty] = destinations[other];
    const [px, py] = origins[other];
    const targetId = `target-${piece.id}`;
    const isSolved = homeAligned(piece);
    if (isSolved) solved++;
    nodes.push({ id: targetId, pieceId: piece.id, label: `D${other}`, colors: [COLORS.D, COLORS[other]], x: tx, y: ty, radius: 20, kind: 'target', slot: `D${other}`, solved: isSolved, secondary: 'HOME', description: `Home target for ${p.label}; ${isSolved ? 'matched and aligned' : `matching edge is currently at ${p.slot}`}` });
    nodes.push({ ...p, x: px, y: py, secondary: isSolved ? 'ALIGNED' : `at ${p.slot}`, radius: 23 });
    links.push({ source: center.id, target: targetId, accent: true });
    links.push({ source: piece.id, target: targetId, directed: true, accent: isSolved, dashed: !isSolved });
  }
  nodes[0].displayLabel = `${solved}/4`;
  nodes[0].progress = { value: solved, total: 4 };
  nodes[0].description = `D-color cross center; ${solved} of 4 edges are at home and aligned`;
  return {
    title: `${solved} of 4 cross edges solved`,
    subtitle: 'Outer circles are the four D-color edges. Arrows connect each piece to its home target, not a suggested move. Both stickers must match their centers. Slots follow the live D-color center.',
    nodes, edges: links, stats: { solved, targets: 4 },
  };
}

/** Orientation uses the standard ordered facelets for each 3×3 cubie slot. */
export function cubieOrientation(piece, size = 3) {
  if (size !== 3 || piece.stickers.length === 1) return 0;
  const slotSet = slotLabel(piece.position, size).split('').sort().join('');
  const slots = piece.stickers.length === 3 ? CORNER_SLOTS : EDGE_SLOTS;
  const slot = slots.find(s => s.split('').sort().join('') === slotSet);
  if (!slot) return 0;
  const homeSet = pieceLabel(piece).split('').sort().join('');
  const homeSlot = slots.find(s => s.split('').sort().join('') === homeSet);
  if (!homeSlot) return 0;
  const reference = piece.stickers.find(s => s.color === homeSlot[0]);
  return Math.max(0, slot.indexOf(normalFace(reference.normal)));
}

function cyclesData(cube) {
  const nodes = cube.cubies.map(p => pieceNode(p, cube.size));
  const homeMap = new Map(nodes.map(n => [pointKey(n.piece.home), n]));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const destination = new Map();
  const links = [];
  for (const node of nodes) {
    const dest = homeMap.get(pointKey(node.piece.position));
    if (!dest) continue;
    destination.set(node.id, dest.id);
    node.orientation = cubieOrientation(node.piece, cube.size);
    node.description += node.kind === 'edge' ? `; orientation ${node.orientation ? 'flipped' : '0'}` : node.kind === 'corner' ? `; twist ${node.orientation}` : '';
    if (node.id !== dest.id) links.push({ source: node.id, target: dest.id, directed: true, accent: true });
    else if (!node.solved) links.push({ source: node.id, target: node.id, directed: true, orientation: true });
  }
  const visited = new Set();
  const cycles = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const cycle = [];
    let current = node.id;
    while (current && !visited.has(current)) {
      visited.add(current);
      cycle.push(current);
      current = destination.get(current);
    }
    if (cycle.length > 1) cycles.push(cycle);
  }
  const corners = nodes.filter(n => n.kind === 'corner');
  const edgeNodes = nodes.filter(n => n.kind === 'edge');
  const centerNodes = nodes.filter(n => n.kind === 'center');
  if (centerNodes.length > 24) {
    centerNodes.forEach((node, i) => {
      const radius = 95 * Math.sqrt((i + .5) / centerNodes.length);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      node.x = 320 + radius * Math.cos(angle);
      node.y = 220 + radius * Math.sin(angle);
    });
  } else layoutRing(centerNodes, 320, 220, 55);
  layoutRing(edgeNodes, 320, 220, 128);
  layoutRing(corners, 320, 220, 190, -Math.PI / 2 + Math.PI / 8);
  const cycleText = cycles.slice(0, 5).map(c => `(${c.map(id => byId.get(id).label).join(' → ')})`).join('  ');
  return {
    title: cycles.length ? `${cycles.length} permutation ${cycles.length === 1 ? 'cycle' : 'cycles'}` : 'Every piece is in its home slot',
    subtitle: `Arrows map each piece from its home slot to its current slot. ${cube.size === 3 ? 'Slots follow the live color-center frame. Amber badges show edge flips (1) or corner twists (1, 2).' : 'Slots use the fixed original frame; physically identical centers are tracked separately.'}`,
    nodes, edges: links, rings: [55, 128, 190], cycleText, cycles,
    stats: { cycles: cycles.length, moved: links.filter(e => e.source !== e.target).length, oriented: nodes.filter(n => n.orientation).length },
  };
}

const neighborhoodCache = new Map();
function stateData(cube) {
  // A deliberately bounded, honest induced neighborhood: all words of length
  // at most two in {R,U,F}, merged by their exact state signature.
  const key = cube.signature();
  if (neighborhoodCache.has(key)) return neighborhoodCache.get(key);
  const start = cube.clone();
  const root = { id: 's0', label: 'NOW', cube: start, depth: 0, moves: [], x: 320, y: 220, colors: [ACCENT], radius: 24, kind: 'state', description: 'The current cube state' };
  const nodes = [root];
  const stateMap = new Map([[key, root]]);
  const generators = ['R', 'U', 'F'];
  const links = [];
  const frontier = [root];
  while (frontier.length) {
    const node = frontier.shift();
    if (node.depth >= 2) continue;
    for (const move of generators) {
      const next = node.cube.clone().applyMove(move);
      const signature = next.signature();
      let target = stateMap.get(signature);
      if (!target) {
        const moves = [...node.moves, move];
        target = { id: `s${nodes.length}`, label: moves.join(' '), cube: next, depth: node.depth + 1, moves, colors: [COLORS[move]], kind: 'state', description: `State reached by ${moves.join(' ')} from the current cube`, action: moves };
        nodes.push(target);
        stateMap.set(signature, target);
        frontier.push(target);
      }
      links.push({ source: node.id, target: target.id, label: move, color: COLORS[move], directed: true });
    }
  }
  layoutRing(nodes.filter(n => n.depth === 1), 320, 220, 88);
  layoutRing(nodes.filter(n => n.depth === 2), 320, 220, 187, -Math.PI / 2 - TAU / 9);
  const data = {
    title: 'A neighborhood of the state graph',
    subtitle: 'A finite sample: moves R, U and F, up to depth 2. Each circle is a distinct whole-cube state. Select a state to play its path. This is not the full state space.',
    nodes, edges: links, rings: [88, 187],
    stats: { states: nodes.length, transitions: links.length, depth: 2, generators: 3 },
  };
  if (neighborhoodCache.size >= 10) neighborhoodCache.delete(neighborhoodCache.keys().next().value);
  neighborhoodCache.set(key, data);
  return data;
}

export function createGraphData(cube, mode = 'pieces') {
  if (!cube || !Array.isArray(cube.cubies)) throw new TypeError('A live CubeState is required.');
  if (mode === 'states') return stateData(cube);
  const framed = inCenterFrame(cube);
  if (mode === 'cross') return crossData(framed);
  if (mode === 'cycles') return cyclesData(framed);
  return topologyData(framed);
}

/** Resolve a graph selection without mutating the graph or the cube.
 * Cross targets deliberately share their physical edge's pieceId, so selecting
 * either endpoint emphasizes both representations. A selected permutation also
 * keeps its entire cycle visible; immediate neighbors remain separately useful
 * to an inspector. Unknown IDs never dim a graph accidentally. */
export function graphFocus(data, { selectedPiece = null, highlightedPieces = [] } = {}) {
  if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) throw new TypeError('Graph nodes and edges are required.');
  const requested = new Set(Array.isArray(highlightedPieces) || highlightedPieces instanceof Set ? highlightedPieces : []);
  const selected = new Set(data.nodes.filter(n => n.pieceId != null && n.pieceId === selectedPiece).map(n => n.id));
  const highlighted = new Set(data.nodes.filter(n => n.pieceId != null && requested.has(n.pieceId)).map(n => n.id));
  const neighbors = new Set();
  for (const edge of data.edges) {
    if (selected.has(edge.source) && !selected.has(edge.target)) neighbors.add(edge.target);
    if (selected.has(edge.target) && !selected.has(edge.source)) neighbors.add(edge.source);
  }
  const cycle = new Set((data.cycles || []).filter(ids => ids.some(id => selected.has(id))).flat());
  const emphasized = new Set([...selected, ...neighbors, ...cycle, ...highlighted]);
  return { selected, neighbors, highlighted, cycle, emphasized, active: emphasized.size > 0 };
}

function nodeRadius(node, count) {
  if (node.radius) return node.radius;
  if (count > 130) return node.kind === 'corner' ? 14 : node.kind === 'edge' ? 6.5 : 5;
  if (count > 70) return node.kind === 'corner' ? 16 : node.kind === 'edge' ? 10 : 6;
  if (count > 35) return node.kind === 'corner' ? 17 : node.kind === 'edge' ? 12 : 8;
  return 18;
}

function ringSegments(node, radius) {
  const colors = node.colors || [ACCENT];
  const perimeter = TAU * radius;
  const stroke = Math.min(node.kind === 'target' ? 2 : 3.2, radius * .23);
  return colors.map((color, i) => `<circle class="graph-color-ring" cx="${node.x}" cy="${node.y}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${perimeter / colors.length - 1.5} ${perimeter - perimeter / colors.length + 1.5}" stroke-dashoffset="${-i * perimeter / colors.length}" transform="rotate(-90 ${node.x} ${node.y})" pointer-events="none"/>`).join('');
}

function rememberDiagramFocus(container) {
  const active = container.ownerDocument?.activeElement;
  const focused = active && container.contains(active) ? active.closest?.('[data-diagram-item]') : null;
  const previous = focused || container.querySelector('[data-diagram-item][tabindex="0"]');
  return { key: previous?.dataset.focusKey, restore: !!focused };
}

// One Tab stop per diagram, with geometric arrow-key navigation. Keeping the
// logical focus key before a redraw avoids dropping keyboard focus when a
// selected piece is toggled off or a turn updates the same SVG container.
function bindDiagram(container, items, { onActivate, onClear, focus, selectedKey } = {}) {
  const elements = [...container.querySelectorAll('[data-diagram-item]')];
  const find = key => key == null ? -1 : items.findIndex(item => item.key === key);
  let current = find(focus.restore ? focus.key : selectedKey);
  if (current < 0) current = find(focus.key);
  if (current < 0) current = 0;
  const setTabStop = index => {
    current = index;
    elements.forEach((element, i) => element.setAttribute('tabindex', i === index ? '0' : '-1'));
  };
  const focusAt = index => {
    if (index < 0 || index >= elements.length) return;
    setTabStop(index);
    elements[index].focus?.({ preventScroll: true });
  };
  const itemAt = event => {
    const target = event.target.closest?.('[data-diagram-item]');
    return target && container.contains(target) ? Number(target.dataset.diagramItem) : -1;
  };
  const activate = event => {
    const index = itemAt(event);
    if (!items[index]) return;
    event.preventDefault();
    focusAt(index);
    onActivate?.(items[index]);
  };
  const keydown = event => {
    const index = itemAt(event);
    if (!items[index]) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
      activate(event);
      return;
    }
    if (event.key === 'Escape' && onClear) {
      event.preventDefault(); event.stopPropagation(); onClear();
      return;
    }
    const vector = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!vector && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); event.stopPropagation();
    if (!vector) { focusAt(event.key === 'Home' ? 0 : items.length - 1); return; }
    const origin = items[index];
    let best = index, distance = Infinity;
    items.forEach((item, i) => {
      const dx = item.x - origin.x, dy = item.y - origin.y;
      const forward = dx * vector[0] + dy * vector[1];
      if (forward < .01) return;
      // Prefer the next node in the intended direction, rather than skipping
      // across the diagram to a closer node mostly above or below the cursor.
      const perpendicular = Math.abs(dx * vector[1] - dy * vector[0]);
      const score = Math.hypot(dx, dy) + perpendicular * 1.6;
      if (score < distance) { distance = score; best = i; }
    });
    focusAt(best);
  };
  const focusin = event => { const index = itemAt(event); if (items[index]) setTabStop(index); };
  container.addEventListener('click', activate);
  container.addEventListener('keydown', keydown);
  container.addEventListener('focusin', focusin);
  setTabStop(current);
  if (focus.restore && find(focus.key) >= 0) focusAt(find(focus.key));
  return () => {
    container.removeEventListener('click', activate);
    container.removeEventListener('keydown', keydown);
    container.removeEventListener('focusin', focusin);
  };
}

/** Render a live graph. Selection follows physical identity; highlightedPieces
 * is a separate overlay for pieces affected by a pending move. Both arrays and
 * Sets are accepted. compact uses a tighter view box for a workbench dock. */
export function renderGraph(container, { cube, mode = 'pieces', selectedPiece = null, highlightedPieces = [], compact = false, onSelect, onMove } = {}) {
  const previousFocus = rememberDiagramFocus(container);
  mountedGraphs.get(container)?.();
  const data = createGraphData(cube, mode);
  const focus = graphFocus(data, { selectedPiece, highlightedPieces });
  const id = `cubica-diagram-${++diagramId}`;
  const lookup = new Map(data.nodes.map(n => [n.id, n]));
  const count = data.nodes.length;
  const markers = new Map();
  const arrow = color => {
    if (!markers.has(color)) markers.set(color, `${id}-arrow-${markers.size}`);
    return `url(#${markers.get(color)})`;
  };
  const rings = (data.rings || []).map(r => `<circle class="graph-orbit" cx="320" cy="220" r="${r}" fill="none" stroke="${LINE}" stroke-dasharray="2 8" opacity=".5"/>`).join('');
  const lines = data.edges.map(edge => {
    const a = lookup.get(edge.source), b = lookup.get(edge.target);
    if (!a || !b) return '';
    const selected = focus.selected.has(a.id) || focus.selected.has(b.id);
    const highlighted = focus.highlighted.has(a.id) && focus.highlighted.has(b.id);
    const related = focus.cycle.has(a.id) && focus.cycle.has(b.id);
    const muted = focus.active && !selected && !highlighted && !related;
    const color = edge.orientation ? AMBER : selected || related ? ACCENT : highlighted ? PREVIEW : edge.color || (edge.accent ? SOLVED : LINE);
    const ar = nodeRadius(a, count), br = nodeRadius(b, count);
    const classes = ['graph-edge', selected && 'is-selected', highlighted && 'is-affected', related && 'is-related', muted && 'is-muted'].filter(Boolean).join(' ');
    const width = selected ? 2.5 : highlighted || related ? 2 : edge.accent ? 1.7 : 1.25;
    let path, label = '';
    if (a === b) {
      const loopRadius = ar + 5;
      path = `M${a.x - loopRadius * .65},${a.y - loopRadius * .75} C${a.x - ar * 2.2},${a.y - ar * 2.75} ${a.x + ar * 2.2},${a.y - ar * 2.75} ${a.x + loopRadius * .65},${a.y - loopRadius * .75}`;
    } else {
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      const x1 = a.x + dx / length * (ar + 5), y1 = a.y + dy / length * (ar + 5);
      const x2 = b.x - dx / length * (br + 6), y2 = b.y - dy / length * (br + 6);
      const curve = mode === 'cycles' ? .17 : 0;
      const mx = (x1 + x2) / 2 - dy * curve, my = (y1 + y2) / 2 + dx * curve;
      path = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
      if (edge.label) label = `<g class="graph-edge-label"><rect x="${mx + 1}" y="${my - 17}" width="18" height="17" rx="4" fill="${LABEL_BG}"/><text x="${mx + 10}" y="${my - 4}" text-anchor="middle" fill="${INK}" font-size="11" font-weight="650">${escape(edge.label)}</text></g>`;
    }
    return `<g class="${classes}" data-source="${escape(edge.source)}" data-target="${escape(edge.target)}" pointer-events="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" ${edge.dashed ? 'stroke-dasharray="4 5"' : ''} ${edge.directed ? `marker-end="${arrow(color)}"` : ''}/>${label}</g>`;
  }).join('');
  const circles = data.nodes.map((node, i) => {
    const r = nodeRadius(node, count);
    const active = focus.selected.has(node.id);
    const affected = focus.highlighted.has(node.id);
    const neighbor = focus.neighbors.has(node.id) || focus.cycle.has(node.id) && !active;
    const muted = focus.active && !focus.emphasized.has(node.id);
    const isRoot = node.id === 's0';
    const fill = active || isRoot ? SELECTED : node.kind === 'target' ? TARGET : NODE;
    const displayLabel = node.displayLabel || node.label;
    const fontSize = node.progress ? 17 : r < 12 ? 8 : node.kind === 'state' ? 11 : displayLabel.length > 3 ? 10 : 12;
    const label = count <= 100 || r >= 12 || active ? `<text class="graph-node-label" x="${node.x}" y="${node.y + fontSize * .35}" text-anchor="middle" fill="${INK}" font-size="${fontSize}" font-weight="650" pointer-events="none">${escape(displayLabel)}</text>` : '';
    const badge = node.orientation && cube.size === 3 ? `<g class="graph-orientation-badge" pointer-events="none"><circle cx="${node.x + r}" cy="${node.y - r}" r="7.5" fill="${AMBER}"/><text x="${node.x + r}" y="${node.y - r + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#111923">${node.orientation}</text></g>` : '';
    const status = (node.piece || node.kind === 'target') && r >= 8 ? `<circle class="graph-home-status" cx="${node.x + r * .76}" cy="${node.y + r * .76}" r="${Math.max(3, Math.min(4.5, r * .25))}" fill="${node.solved ? SOLVED : MUTED}" stroke="${NODE}" stroke-width="1.6" pointer-events="none"/>` : '';
    const progressRadius = r + 8, perimeter = TAU * progressRadius;
    const progress = node.progress ? `<g class="graph-cross-progress" pointer-events="none"><circle cx="${node.x}" cy="${node.y}" r="${progressRadius}" fill="none" stroke="${LINE}" stroke-width="3"/><circle cx="${node.x}" cy="${node.y}" r="${progressRadius}" fill="none" stroke="${SOLVED}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${perimeter * node.progress.value / node.progress.total} ${perimeter}" opacity="${node.progress.value > 0 ? 1 : 0}" transform="rotate(-90 ${node.x} ${node.y})"/></g>` : '';
    const classes = ['graph-node', active && 'is-selected', neighbor && 'is-neighbor', affected && 'is-affected', muted && 'is-muted'].filter(Boolean).join(' ');
    const description = `${node.description}${affected ? '; affected by the next turn' : ''}`;
    return `<g data-node="${i}" data-node-id="${escape(node.id)}" data-piece-id="${escape(node.pieceId || '')}" data-diagram-item="${i}" data-focus-key="${escape(node.id)}" tabindex="-1" role="button" ${node.pieceId ? `aria-pressed="${active}"` : ''} ${node.kind === 'state' && !node.action?.length ? 'aria-disabled="true"' : ''} aria-label="${escape(description)}" class="${classes}"><circle class="graph-hit-area" cx="${node.x}" cy="${node.y}" r="${count > 70 ? r + 4 : Math.max(r + 5, 23)}" fill="transparent"/>${progress}<circle class="graph-focus-ring" cx="${node.x}" cy="${node.y}" r="${r + (node.progress ? 13 : 9)}" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0" pointer-events="none"/>${active ? `<circle class="graph-selection-ring" cx="${node.x}" cy="${node.y}" r="${r + 5}" fill="none" stroke="${ACCENT}" stroke-width="2" pointer-events="none"/>` : ''}${affected ? `<circle class="graph-preview-ring" cx="${node.x}" cy="${node.y}" r="${r + (active ? 9 : 5)}" fill="none" stroke="${PREVIEW}" stroke-width="1.7" stroke-dasharray="3 3" pointer-events="none"/>` : ''}<circle class="graph-node-shell" cx="${node.x}" cy="${node.y}" r="${r}" fill="${fill}" stroke="${active ? ACCENT : LINE}" stroke-width="${active ? 2 : 1}"/>${ringSegments(node, node.kind === 'target' ? r - 3 : r)}${label}${badge}${status}${node.secondary ? `<text class="graph-node-caption" x="${node.x}" y="${node.y + r + (node.progress ? 22 : 16)}" text-anchor="middle" fill="${MUTED}" font-size="9.5" font-weight="550" letter-spacing=".45" pointer-events="none">${escape(node.secondary)}</text>` : ''}<title>${escape(description)}</title></g>`;
  }).join('');
  const defs = [...markers].map(([color, markerId]) => `<marker id="${markerId}" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1 7 4 1 7Z" fill="${color}"/></marker>`).join('');
  const keyboardHelp = 'Use arrow keys to move between nodes, Enter or Space to select, and Escape to clear a piece selection.';
  container.innerHTML = `<figure class="cube-graph${compact ? ' is-compact' : ''}"><svg class="graph-svg graph-mode-${escape(mode)}" viewBox="${compact ? '100 0 440 455' : '70 -10 500 480'}" role="group" aria-labelledby="${id}-title ${id}-description"><title id="${id}-title">${escape(data.title)}</title><desc id="${id}-description">${escape(data.subtitle)} ${keyboardHelp}</desc><defs>${defs}</defs><style>.cube-graph{margin:0}:where(.cube-graph .graph-svg){display:block;width:100%;height:auto;overflow:visible;font-family:inherit}.cube-graph .graph-node{cursor:pointer;outline:none;transition:opacity .14s}.cube-graph .graph-edge{opacity:.78;transition:opacity .14s}.cube-graph .graph-edge.is-muted{opacity:.13}.cube-graph .graph-edge.is-selected,.cube-graph .graph-edge.is-affected,.cube-graph .graph-edge.is-related{opacity:1}.cube-graph .graph-node.is-muted{opacity:.27}.cube-graph .graph-node:hover,.cube-graph .graph-node:focus-visible{opacity:1;filter:brightness(1.1)}.cube-graph .graph-node:focus-visible .graph-focus-ring{opacity:1}.cube-graph .graph-node-label{font-variant-numeric:tabular-nums}.cube-graph .graph-caption{font-size:12px;line-height:1.6;color:${MUTED};margin:8px 12px 0}.cube-graph .graph-cycle-code{display:block;margin-top:8px;color:${INK};font-family:ui-monospace,monospace;font-size:11px}.cube-graph.is-compact .graph-caption{display:none}</style>${rings}${lines}${circles}${data.nodes.length ? '' : `<text x="320" y="210" text-anchor="middle" fill="${INK}" font-size="17">${escape(data.title)}</text>`}</svg><figcaption class="graph-caption">${escape(data.subtitle)}${data.cycleText ? `<span class="graph-cycle-code">${escape(data.cycleText)}</span>` : ''}</figcaption></figure>`;
  const unbind = bindDiagram(container, data.nodes.map(node => ({ ...node, key: node.id })), {
    focus: previousFocus,
    selectedKey: focus.selected.values().next().value,
    onActivate: node => {
      if (node.pieceId) onSelect?.(node.pieceId);
      else if (node.action?.length) onMove?.(node.action.join(' '));
    },
    onClear: selectedPiece && onSelect ? () => onSelect(null) : null,
  });
  const cleanup = () => {
    unbind();
    if (mountedGraphs.get(container) === cleanup) mountedGraphs.delete(container);
  };
  mountedGraphs.set(container, cleanup);
  return cleanup;
}

/** An unfolded net uses the same physical IDs and next-turn overlay as the
 * graph. Face labels remain visible on even cubes; a single roving Tab stop
 * avoids hundreds of sequential Tab presses on a larger puzzle. */
export function renderCubeNet(container, cube, { selectedPiece = null, highlightedPieces = [], onSelect, labels = true } = {}) {
  const previousFocus = rememberDiagramFocus(container);
  mountedNets.get(container)?.();
  const size = cube.size;
  const facelets = cube.facelets();
  const highlighted = new Set(Array.isArray(highlightedPieces) || highlightedPieces instanceof Set ? highlightedPieces : []);
  const hasSelection = cube.cubies.some(p => p.id === selectedPiece);
  const hasPreview = cube.cubies.some(p => highlighted.has(p.id));
  const cell = 20, unit = size * cell, gap = labels ? 14 : 8, margin = labels ? 18 : 8;
  const faceWidth = unit + gap;
  const width = margin * 2 + 4 * faceWidth - gap;
  const height = margin * 2 + 3 * faceWidth - gap;
  const layout = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  const facePieces = Object.fromEntries(FACES.map(f => [f, Array(size * size)]));
  for (const piece of cube.cubies) for (const sticker of piece.stickers) {
    const face = normalFace(sticker.normal);
    facePieces[face][faceIndex(face, piece.position, size)] = piece;
  }
  const items = [];
  const tiles = Object.entries(layout).map(([face, [col, row]]) => {
    const x0 = margin + col * faceWidth, y0 = margin + row * faceWidth;
    const caption = labels ? `<text class="net-face-caption" x="${x0 + (unit - 2) / 2}" y="${y0 - 5}" text-anchor="middle" fill="${MUTED}" font-size="9" font-weight="650" letter-spacing="1">${face}</text>` : '';
    return caption + facelets[face].map((color, i) => {
      const piece = facePieces[face][i];
      const x = x0 + (i % size) * cell, y = y0 + Math.floor(i / size) * cell;
      const selected = piece?.id === selectedPiece;
      const affected = highlighted.has(piece?.id);
      const muted = (hasSelection || hasPreview) && !selected && !affected;
      const key = `${face}:${i}`, index = items.length;
      items.push({ key, x: x + cell / 2, y: y + cell / 2, pieceId: piece?.id });
      const classes = ['net-tile', selected && 'is-selected', affected && 'is-affected', muted && 'is-muted'].filter(Boolean).join(' ');
      const description = `${face} face, row ${Math.floor(i / size) + 1}, column ${i % size + 1}: ${piece ? pieceLabel(piece) : color} piece${affected ? '; affected by the next turn' : ''}`;
      return `<g data-piece="${escape(piece?.id || '')}" data-facelet="${key}" data-diagram-item="${index}" data-focus-key="${key}" role="button" tabindex="-1" aria-pressed="${selected}" aria-label="${escape(description)}" class="${classes}"><rect class="net-sticker" x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="3" fill="${COLORS[color]}" stroke="${selected ? ACCENT : affected ? PREVIEW : LINE}" stroke-width="${selected ? 2.5 : affected ? 2 : .6}" ${affected && !selected ? 'stroke-dasharray="3 2"' : ''}/><rect class="net-focus-ring" x="${x - 2}" y="${y - 2}" width="${cell + 2}" height="${cell + 2}" rx="4" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0" pointer-events="none"/><title>${escape(description)}</title></g>`;
    }).join('');
  }).join('');
  container.innerHTML = `<svg class="cube-net-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="Unfolded ${size} by ${size} cube net. Faces U, L, F, R, B and D. Select a sticker to inspect its physical piece. Arrow keys move focus; Enter or Space selects; Escape clears selection."><style>:where(.cube-net-svg){display:block;width:100%;height:auto;font-family:inherit}.cube-net-svg .net-tile{cursor:pointer;outline:none;transition:opacity .14s}.cube-net-svg .net-tile.is-muted{opacity:.32}.cube-net-svg .net-tile:hover,.cube-net-svg .net-tile:focus-visible{opacity:1}.cube-net-svg .net-tile:focus-visible .net-focus-ring{opacity:1}.cube-net-svg .net-tile:hover .net-sticker{stroke:${INK};stroke-width:1.7}</style>${tiles}</svg>`;
  const unbind = bindDiagram(container, items, {
    focus: previousFocus,
    selectedKey: items.find(item => item.pieceId === selectedPiece)?.key,
    onActivate: item => { if (item.pieceId) onSelect?.(item.pieceId); },
    onClear: selectedPiece && onSelect ? () => onSelect(null) : null,
  });
  const cleanup = () => {
    unbind();
    if (mountedNets.get(container) === cleanup) mountedNets.delete(container);
  };
  mountedNets.set(container, cleanup);
  return cleanup;
}

export function algorithmCaseCube(moves, size = 3) {
  return new CubeState(size).applyAlgorithm(invertAlgorithm(moves));
}
