import { CubeState, COLORS, FACES, FACE_NORMALS, normalFace, faceIndex, invertAlgorithm } from './cube.js';

/* All diagrams below are projections of the live model. They are never static
 * illustrations pretending to describe a different cube state. */
const INK = '#24413c';
const MUTED = '#87938c';
const LINE = '#d8e1d9';
const ACCENT = '#208a74';
const AMBER = '#c18733';
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
    title: 'Every piece. Every connection.',
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
  const nodes = [{ ...pieceNode(center, cube.size), x: 320, y: 220, label: 'D', radius: 25 }];
  const links = [];
  const destinations = { F: [320, 333], R: [433, 220], B: [320, 107], L: [207, 220] };
  const origins = { F: [320, 414], R: [514, 220], B: [320, 26], L: [126, 220] };
  let solved = 0;
  for (const piece of cross) {
    const other = piece.stickers.find(s => s.color !== 'D').color;
    const p = pieceNode(piece, cube.size);
    const [tx, ty] = destinations[other];
    const [px, py] = origins[other];
    const targetId = `target-${piece.id}`;
    const isSolved = homeAligned(piece);
    if (isSolved) solved++;
    nodes.push({ id: targetId, pieceId: piece.id, label: `D${other}`, colors: [COLORS.D, COLORS[other]], x: tx, y: ty, kind: 'target', solved: isSolved, description: `Home slot for D${other}; ${isSolved ? 'solved' : 'waiting for its matching edge'}` });
    nodes.push({ ...p, x: px, y: py, label: p.slot, secondary: `D${other}`, radius: 18 });
    links.push({ source: center.id, target: targetId, accent: true });
    links.push({ source: piece.id, target: targetId, directed: true, accent: isSolved, dashed: !isSolved });
  }
  return {
    title: `${solved} of 4 cross edges solved`,
    subtitle: 'Outer circles track the four D-color edges; arrows lead to their home targets. Slots follow the D-color center even after a whole-cube rotation. Both stickers must match their centers.',
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
    nodes, edges: links, rings: [55, 128, 190], cycleText,
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

function ringSegments(node, radius) {
  const colors = node.colors || [ACCENT];
  const perimeter = TAU * radius;
  return colors.map((color, i) => `<circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="none" stroke="${color}" stroke-width="3.6" stroke-dasharray="${perimeter / colors.length - 1.5} ${perimeter - perimeter / colors.length + 1.5}" stroke-dashoffset="${-i * perimeter / colors.length}" transform="rotate(-90 ${node.x} ${node.y})"/>`).join('');
}

/** Render one responsive, keyboard-accessible SVG and a concise explanation. */
export function renderGraph(container, { cube, mode = 'pieces', selectedPiece = null, onSelect, onMove } = {}) {
  mountedGraphs.get(container)?.();
  const data = createGraphData(cube, mode);
  const id = `cubica-diagram-${++diagramId}`;
  const lookup = new Map(data.nodes.map(n => [n.id, n]));
  const graphSize = data.nodes.length;
  const radius = graphSize > 130 ? 5 : graphSize > 70 ? 8 : graphSize > 35 ? 10 : 16;
  const rings = (data.rings || []).map(r => `<circle cx="320" cy="220" r="${r}" fill="none" stroke="${LINE}" stroke-dasharray="2 7" opacity=".55"/>`).join('');
  const lines = data.edges.map(edge => {
    const a = lookup.get(edge.source), b = lookup.get(edge.target);
    if (!a || !b) return '';
    const active = (a.pieceId && a.pieceId === selectedPiece) || (b.pieceId && b.pieceId === selectedPiece);
    const color = edge.orientation ? AMBER : edge.color || (active || edge.accent ? ACCENT : LINE);
    const ar = a.radius || radius;
    const br = b.radius || radius;
    if (a === b) {
      return `<path d="M${a.x - ar * .6},${a.y - ar * .8} C${a.x - ar * 2.5},${a.y - ar * 3.6} ${a.x + ar * 2.5},${a.y - ar * 3.6} ${a.x + ar * .6},${a.y - ar * .8}" fill="none" stroke="${color}" stroke-width="1.8" marker-end="url(#${id}-arrow)"/>`;
    }
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const x1 = a.x + dx / length * (ar + 4), y1 = a.y + dy / length * (ar + 4);
    const x2 = b.x - dx / length * (br + 5), y2 = b.y - dy / length * (br + 5);
    const curve = mode === 'cycles' ? 0.12 : 0;
    const mx = (x1 + x2) / 2 - dy * curve, my = (y1 + y2) / 2 + dx * curve;
    return `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="${active ? 2.5 : edge.accent ? 1.8 : 1.15}" ${edge.dashed ? 'stroke-dasharray="4 5"' : ''} ${edge.directed ? `marker-end="url(#${id}-arrow)"` : ''} opacity="${active ? 1 : .85}"/>${edge.label ? `<text x="${mx + 8}" y="${my - 6}" fill="${INK}" font-size="10" font-weight="600">${escape(edge.label)}</text>` : ''}`;
  }).join('');
  const circles = data.nodes.map((node, i) => {
    const r = node.radius || radius;
    const active = node.pieceId && node.pieceId === selectedPiece;
    const isRoot = node.id === 's0';
    const fill = active || isRoot ? '#e2f2e9' : node.kind === 'target' ? '#eff5ef' : '#fffefa';
    const fontSize = node.kind === 'state' ? 10 : node.label.length > 3 ? 8 : 10;
    const label = graphSize > 100 ? '' : `<text x="${node.x}" y="${node.y + 3.5}" text-anchor="middle" fill="${INK}" font-size="${fontSize}" font-weight="600">${escape(node.label)}</text>`;
    const badge = node.orientation && cube.size === 3 ? `<circle cx="${node.x + r}" cy="${node.y - r}" r="7" fill="${AMBER}"/><text x="${node.x + r}" y="${node.y - r + 2.7}" text-anchor="middle" font-size="8" fill="white">${node.orientation}</text>` : '';
    const status = node.piece && r >= 8 ? `<circle cx="${node.x + r * .76}" cy="${node.y + r * .76}" r="${Math.max(2.5, Math.min(4.2, r * .25))}" fill="${node.solved ? '#92b777' : '#d6ae66'}" stroke="#fffefa" stroke-width="1.3"/>` : '';
    return `<g data-node="${i}" tabindex="0" role="button" aria-label="${escape(node.description)}" style="cursor:pointer;outline:none" class="graph-node">${active ? `<circle cx="${node.x}" cy="${node.y}" r="${r + 6}" fill="none" stroke="${ACCENT}" stroke-width="1.5" opacity=".35"/>` : ''}<circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${fill}" stroke="${active ? ACCENT : '#e0e4dc'}" stroke-width="${active ? 2 : 1}"/>${ringSegments(node, r)}${label}${badge}${status}${node.secondary ? `<text x="${node.x}" y="${node.y + r + 15}" text-anchor="middle" fill="${MUTED}" font-size="10">${escape(node.secondary)} edge</text>` : ''}<title>${escape(node.description)}</title></g>`;
  }).join('');
  container.innerHTML = `<figure class="cube-graph" style="margin:0"><svg viewBox="0 0 640 460" role="group" aria-labelledby="${id}-title ${id}-description" style="display:block;width:100%;height:auto;max-height:440px;overflow:visible;font-family:inherit"><title id="${id}-title">${escape(data.title)}</title><desc id="${id}-description">${escape(data.subtitle)}</desc><defs><marker id="${id}-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1,1 L7,4 L1,7" fill="none" stroke="${INK}" stroke-width="1.5"/></marker></defs><style>.graph-node:focus-visible circle{stroke:#208a74;stroke-width:3}.graph-node:hover{filter:brightness(.96)}</style>${rings}${lines}${circles}${data.nodes.length ? '' : `<text x="320" y="205" text-anchor="middle" fill="${INK}" font-size="18">${escape(data.title)}</text>`}</svg><figcaption style="font-size:11px;line-height:1.6;color:#7b877f;margin:0 12px 4px;text-align:center">${escape(data.subtitle)}${data.cycleText ? `<span style="display:block;margin-top:6px;color:#42685d;font-family:monospace;font-size:10px">${escape(data.cycleText)}</span>` : ''}</figcaption></figure>`;
  const activate = event => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest?.('[data-node]');
    if (!target || !container.contains(target)) return;
    event.preventDefault();
    const node = data.nodes[Number(target.dataset.node)];
    if (node?.pieceId) onSelect?.(node.pieceId);
    else if (node?.action?.length && onMove) onMove(node.action.join(' '));
  };
  container.addEventListener('click', activate);
  container.addEventListener('keydown', activate);
  const cleanup = () => {
    container.removeEventListener('click', activate); container.removeEventListener('keydown', activate);
    if (mountedGraphs.get(container) === cleanup) mountedGraphs.delete(container);
  };
  mountedGraphs.set(container, cleanup);
  return cleanup;
}

/** Clickable unfolded net with one hit target for every physical facelet. */
export function renderCubeNet(container, cube, { selectedPiece = null, onSelect, labels = true } = {}) {
  mountedNets.get(container)?.();
  const size = cube.size;
  const facelets = cube.facelets();
  const cell = 20;
  const unit = size * cell;
  const gap = 8;
  const faceWidth = unit + gap;
  const margin = 18;
  const width = margin * 2 + 4 * faceWidth - gap;
  const height = margin * 2 + 3 * faceWidth - gap;
  const layout = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  const facePieces = Object.fromEntries(FACES.map(f => [f, Array(size * size)]));
  for (const piece of cube.cubies) {
    for (const sticker of piece.stickers) {
      const face = normalFace(sticker.normal);
      facePieces[face][faceIndex(face, piece.position, size)] = piece;
    }
  }
  const tiles = Object.entries(layout).map(([face, [col, row]]) => {
    const x0 = margin + col * faceWidth, y0 = margin + row * faceWidth;
    return facelets[face].map((color, i) => {
      const piece = facePieces[face][i];
      const x = x0 + (i % size) * cell, y = y0 + Math.floor(i / size) * cell;
      const selected = piece?.id === selectedPiece;
      const text = labels && size % 2 === 1 && i === (size * size - 1) / 2 ? face : '';
      return `<g data-piece="${escape(piece?.id || '')}" role="button" tabindex="0" aria-label="${escape(`${face} face, row ${Math.floor(i / size) + 1}, column ${i % size + 1}: ${piece ? pieceLabel(piece) : color} piece`)}" style="cursor:pointer;outline:none" class="net-tile"><rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="3" fill="${COLORS[color]}" stroke="${selected ? INK : color === 'U' ? '#d9d9cf' : 'transparent'}" stroke-width="${selected ? 2.5 : 1}"/>${text ? `<text x="${x + 9}" y="${y + 12.5}" text-anchor="middle" font-size="9" font-weight="600" fill="${INK}" style="pointer-events:none">${text}</text>` : ''}<title>${escape(`${face}: ${piece ? pieceLabel(piece) : color}`)}</title></g>`;
    }).join('');
  }).join('');
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="Unfolded ${size} by ${size} cube net. Faces U, L, F, R, B and D. Select any sticker to inspect its piece." style="display:block;width:100%;height:auto;max-height:250px;font-family:inherit"><style>.net-tile:focus-visible rect{stroke:#24413c;stroke-width:3}.net-tile:hover rect{stroke:#24413c;stroke-width:1.5}</style>${tiles}</svg>`;
  const activate = event => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest?.('[data-piece]');
    if (!target || !container.contains(target) || !target.dataset.piece) return;
    event.preventDefault();
    onSelect?.(target.dataset.piece);
  };
  container.addEventListener('click', activate);
  container.addEventListener('keydown', activate);
  const cleanup = () => {
    container.removeEventListener('click', activate); container.removeEventListener('keydown', activate);
    if (mountedNets.get(container) === cleanup) mountedNets.delete(container);
  };
  mountedNets.set(container, cleanup);
  return cleanup;
}

export function algorithmCaseCube(moves, size = 3) {
  return new CubeState(size).applyAlgorithm(invertAlgorithm(moves));
}
