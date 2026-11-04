/**
 * Exact, read-only diagnostics for the solve workspace.
 *
 * These are measurements of the current state, not a human-method solver.
 * A two-phase solution is allowed to undo a milestone on its way to solved.
 * On a 3×3, all color/slot diagnostics use the six live color centers, so a
 * whole-cube rotation never invents misplaced pieces or changes CFOP progress.
 * Larger puzzles retain physical reference identities, as the piece graph does.
 */
import { COLORS, FACES, FACE_NAMES, FACE_NORMALS, normalFace, parseAlgorithm, getMoveSpec, rotateVector, describeMove } from './cube.js';

const COLOR_NAMES = Object.freeze({ U: 'White', R: 'Red', F: 'Green', D: 'Yellow', L: 'Orange', B: 'Blue' });
const EDGE_SLOTS = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
const CORNER_SLOTS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
const SLOT_LABELS = new Map([...EDGE_SLOTS, ...CORNER_SLOTS].map(label => [[...label].sort().join(''), label]));
const PAIRS = [['FR', 'DFR'], ['FL', 'DLF'], ['BL', 'DBL'], ['BR', 'DRB']];
const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const same = (a, b) => a.every((value, index) => value === b[index]);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const kindOf = piece => ['core', 'center', 'edge', 'corner'][piece.stickers.length];

function requireCube(cube) {
  if (!cube || !Array.isArray(cube.cubies) || !Number.isInteger(cube.size) || cube.size < 2 || cube.size > 7) {
    throw new TypeError('A live cube from 2×2 through 7×7 is required.');
  }
}

function labelFor(colors) {
  const label = SLOT_LABELS.get([...colors].sort().join(''));
  return label || [...colors].sort((a, b) => FACES.indexOf(a) - FACES.indexOf(b)).join('');
}

function slotFor(position, size) {
  const h = (size - 1) / 2;
  return labelFor(FACES.filter(face => dot(position, FACE_NORMALS[face]) === h));
}

/** Return only a coordinate transform, without cloning histories or cubies. */
function frameFor(cube) {
  let basis = IDENTITY;
  const centered = cube.size === 3;
  if (centered) {
    const centers = new Map(cube.cubies.filter(piece => piece.stickers.length === 1)
      .map(piece => [piece.stickers[0].color, piece.stickers[0].normal]));
    if (!centers.has('R') || !centers.has('U') || !centers.has('F')) {
      throw new Error('The 3×3 state is missing its color-center frame.');
    }
    basis = [centers.get('R'), centers.get('U'), centers.get('F')];
  }
  return {
    frame: centered ? 'centers' : 'reference',
    frameDescription: centered
      ? 'Slots and orientation follow the live color centers; rotating the whole cube does not change progress.'
      : 'Slots track original physical piece identities. Rotations and exchanges of identical-color pieces can change these reference counts without changing whether the faces are solved.',
    project: vector => basis.map(axis => dot(axis, vector)),
  };
}

function framedPiece(piece, frame) {
  return {
    id: piece.id,
    home: [...piece.home],
    position: frame.project(piece.position),
    stickers: piece.stickers.map(sticker => ({ color: sticker.color, normal: frame.project(sticker.normal) })),
  };
}

/** The same ordered-facelet convention used by the 3×3 permutation graph. */
function orientationOf(piece, size) {
  if (size > 3) return null;
  if (piece.stickers.length === 1) return 0;
  const slots = piece.stickers.length === 3 ? CORNER_SLOTS : EDGE_SLOTS;
  const home = labelFor(piece.stickers.map(sticker => sticker.color));
  const slot = slotFor(piece.position, size);
  if (!slots.includes(home) || !slots.includes(slot)) return null;
  const reference = piece.stickers.find(sticker => sticker.color === home[0]);
  const index = slot.indexOf(normalFace(reference.normal));
  return index < 0 ? null : index;
}

function statusOf(piece, size) {
  const inPlace = same(piece.position, piece.home);
  const stickersAligned = piece.stickers.every(sticker => same(sticker.normal, FACE_NORMALS[sticker.color]));
  const orientation = orientationOf(piece, size);
  return {
    inPlace,
    oriented: orientation === null ? stickersAligned : orientation === 0,
    stickersAligned,
    solved: inPlace && stickersAligned,
    orientation,
  };
}

const unavailable = () => ({ available: false, matched: 0, total: 0, solved: false, pieceIds: [] });

/**
 * Summarize piece state and cumulative, yellow-D-first CFOP milestones.
 *
 * Raw matched counts are independent diagnostics. `solved` on each phase and
 * `milestones[].complete` include all preceding phases; OLL or PLL therefore
 * cannot appear complete while an earlier layer is broken. `pieces.oriented`
 * uses cubie flip/twist coordinates on 2×2/3×3, not sticker-color matching.
 */
export function analyzeCube(cube) {
  requireCube(cube);
  const frame = frameFor(cube);
  const pieces = cube.cubies.map(piece => {
    const framed = framedPiece(piece, frame);
    return { ...framed, ...statusOf(framed, cube.size), kind: kindOf(framed), label: labelFor(framed.stickers.map(sticker => sticker.color)) };
  });
  const movable = pieces.filter(piece => piece.stickers.length > 1);
  const solved = cube.isSolved();
  const result = {
    size: cube.size,
    solved,
    frame: frame.frame,
    frameDescription: frame.frameDescription,
    pieces: {
      total: pieces.length,
      solved: pieces.filter(piece => piece.solved).length,
      positioned: pieces.filter(piece => piece.inPlace).length,
      oriented: pieces.filter(piece => piece.oriented).length,
      movableTotal: movable.length,
      movableSolved: movable.filter(piece => piece.solved).length,
      corners: pieces.filter(piece => piece.kind === 'corner').length,
      edges: pieces.filter(piece => piece.kind === 'edge').length,
      centers: pieces.filter(piece => piece.kind === 'center').length,
    },
    stickers: {
      total: 6 * cube.size * cube.size,
      aligned: pieces.reduce((sum, piece) => sum + piece.stickers.filter(sticker => same(sticker.normal, FACE_NORMALS[sticker.color])).length, 0),
    },
    cross: { ...unavailable(), color: 'D' },
    f2l: { ...unavailable(), pairs: [] },
    oll: unavailable(),
    pll: unavailable(),
    milestones: [],
    stage: null,
  };

  if (cube.size !== 3) {
    result.stage = solved
      ? { id: 'solved', label: 'Solved', description: 'All six faces are uniform. Reference-slot counts still track individual physical pieces.' }
      : cube.size === 2
        ? { id: 'corners', label: 'Solve the corners', description: 'A 2×2 has eight corners and no edge cross. Inspect a corner, practice a case, or generate a verified corner solution.' }
        : { id: 'reduction', label: 'Centers and edge pairs', description: 'Larger-cube study starts with centers and paired edges before 3×3 reduction. Automatic solving here replays a verified inverse of recorded moves.' };
    return result;
  }

  const byLabel = new Map(pieces.map(piece => [piece.label, piece]));
  const crossPieces = EDGE_SLOTS.filter(label => label.includes('D')).map(label => byLabel.get(label));
  const crossMatched = crossPieces.filter(piece => piece.solved).length;
  result.cross = {
    available: true, color: 'D', matched: crossMatched, total: 4,
    solved: crossMatched === 4, pieceIds: crossPieces.map(piece => piece.id),
  };
  const pairs = PAIRS.map(([edgeLabel, cornerLabel]) => {
    const edge = byLabel.get(edgeLabel), corner = byLabel.get(cornerLabel);
    return {
      id: edgeLabel,
      label: `${cornerLabel} + ${edgeLabel}`,
      pieceIds: [corner.id, edge.id],
      cornerSolved: corner.solved,
      edgeSolved: edge.solved,
      solved: corner.solved && edge.solved,
    };
  });
  const f2lMatched = pairs.filter(pair => pair.solved).length;
  result.f2l = {
    available: true, matched: f2lMatched, total: 4,
    solved: result.cross.solved && f2lMatched === 4,
    pairs, pieceIds: pairs.flatMap(pair => pair.pieceIds),
  };
  const lastLayer = pieces.filter(piece => piece.stickers.length > 1 && piece.stickers.some(sticker => sticker.color === 'U'));
  const ollMatched = lastLayer.filter(piece => same(piece.stickers.find(sticker => sticker.color === 'U').normal, FACE_NORMALS.U)).length;
  result.oll = {
    available: true, matched: ollMatched, total: 8,
    solved: result.f2l.solved && ollMatched === 8, pieceIds: lastLayer.map(piece => piece.id),
  };
  const pllMatched = lastLayer.filter(piece => piece.inPlace).length;
  result.pll = {
    available: true, matched: pllMatched, total: 8,
    solved: result.oll.solved && pllMatched === 8, pieceIds: lastLayer.map(piece => piece.id),
  };

  const definitions = [
    ['cross', 'Cross', 'Match the four yellow D edges to their side centers.'],
    ['f2l', 'F2L', 'Place four matching corner–edge pairs while preserving the cross.'],
    ['oll', 'OLL', 'Face all eight U-color stickers toward the U center while preserving the first two layers.'],
    ['pll', 'PLL', 'Place the eight last-layer pieces in their matching slots without changing their orientation.'],
  ];
  result.milestones = definitions.map(([id, label, description]) => {
    const phase = result[id];
    return { id, label, available: true, matched: phase.matched, total: phase.total, complete: phase.solved, description, pieceIds: [...phase.pieceIds] };
  });
  const next = result.milestones.find(milestone => !milestone.complete);
  result.stage = next
    ? { id: next.id, label: next.label, description: next.description }
    : { id: 'solved', label: 'Solved', description: 'Every piece matches its color-center frame. All six faces are solved.' };
  return result;
}

/**
 * Inspect one physical ID shared by the cube, graph and unfolded net.
 * `face`/`currentSlot` use the diagnostic frame; `worldFace`/`worldSlot` retain
 * the actual move axes. Every returned array is detached from the live model.
 */
export function inspectPiece(cube, pieceId) {
  requireCube(cube);
  const source = cube.cubies.find(piece => piece.id === pieceId);
  if (!source) return null;
  const frame = frameFor(cube);
  const piece = framedPiece(source, frame);
  const state = statusOf(piece, cube.size);
  const kind = kindOf(piece);
  const label = labelFor(piece.stickers.map(sticker => sticker.color));
  const currentSlot = slotFor(piece.position, cube.size);
  const homeSlot = slotFor(piece.home, cube.size);
  const status = state.solved ? 'solved' : state.inPlace ? 'misoriented' : 'misplaced';
  const orientationLabel = state.orientation === null
    ? state.stickersAligned ? 'Sticker directions aligned' : 'Sticker directions differ'
    : kind === 'center' ? 'Color-center reference'
      : kind === 'edge' ? state.orientation === 0 ? 'No edge flip' : 'Flipped edge'
        : state.orientation === 0 ? 'No corner twist' : `Corner twist +${state.orientation}`;
  const description = state.solved
    ? `${label} ${kind} is in its home slot with all stickers aligned.`
    : state.inPlace
      ? `${label} ${kind} is in its ${homeSlot} home slot, but its sticker orientation still needs to change.`
      : `${label} ${kind} is in ${currentSlot}; its home slot is ${homeSlot}.${state.orientation ? ` ${orientationLabel}.` : ''}`;
  return {
    id: source.id, label, kind,
    homeSlot, currentSlot, worldSlot: slotFor(source.position, cube.size),
    position: [...piece.position], worldPosition: [...source.position], home: [...piece.home],
    inPlace: state.inPlace, oriented: state.oriented, solved: state.solved,
    status, orientation: state.orientation, orientationLabel,
    stickers: piece.stickers.map((sticker, index) => ({
      color: sticker.color, hex: COLORS[sticker.color], name: COLOR_NAMES[sticker.color],
      face: normalFace(sticker.normal), worldFace: normalFace(source.stickers[index].normal),
      aligned: same(sticker.normal, FACE_NORMALS[sticker.color]),
    })),
    neighborIds: cube.cubies.filter(other => other.id !== source.id
      && other.position.reduce((sum, component, axis) => sum + Math.abs(component - source.position[axis]), 0) === 1)
      .map(other => other.id).sort(),
    description,
    frame: frame.frame,
    frameDescription: frame.frameDescription,
  };
}

/**
 * Preview exactly one legal turn without mutating the cube or its history.
 * `affectedIds` are all layer-selected pieces, including a stationary face
 * center. `changedIds` are pieces whose position or sticker directions change.
 * Whole-cube rotations therefore affect every piece without implying progress.
 */
export function analyzeMove(cube, move) {
  requireCube(cube);
  if (move == null || move === '') return null;
  const tokens = parseAlgorithm(move);
  if (!tokens.length) return null;
  if (tokens.length !== 1) throw new RangeError('Move inspection requires exactly one turn.');
  const spec = getMoveSpec(tokens[0], cube.size);
  const token = spec.token;
  const base = token.replace(/[2']$/, '');
  const kind = /^[xyz]$/.test(base) ? 'rotation' : /^[MES]$/.test(base) ? 'slice' : base.endsWith('w') ? 'wide' : 'face';
  const face = kind === 'rotation' ? { x: 'R', y: 'U', z: 'F' }[base]
    : kind === 'slice' ? { M: 'L', E: 'D', S: 'F' }[base]
      : base.match(/[URFDLB]/)[0];
  const halfTurn = token.endsWith('2');
  const direction = halfTurn ? 'half' : token.endsWith("'") ? 'counterclockwise' : 'clockwise';
  const affected = cube.cubies.filter(piece => spec.layers.includes(piece.position[spec.axis]));
  const changed = affected.filter(piece => !same(piece.position, rotateVector(piece.position, spec.axis, spec.turns))
    || piece.stickers.some(sticker => !same(sticker.normal, rotateVector(sticker.normal, spec.axis, spec.turns))));
  return {
    token, kind, face, faceName: FACE_NAMES[face],
    axis: spec.axis, axisName: 'XYZ'[spec.axis], layerCount: spec.layers.length,
    direction, directionLabel: halfTurn ? '180° half turn' : `${direction} quarter turn`,
    angle: halfTurn ? 180 : 90, wholeCube: spec.layers.length === cube.size,
    affectedIds: affected.map(piece => piece.id), changedIds: changed.map(piece => piece.id),
    count: affected.length, changedCount: changed.length,
    counts: {
      corners: affected.filter(piece => piece.stickers.length === 3).length,
      edges: affected.filter(piece => piece.stickers.length === 2).length,
      centers: affected.filter(piece => piece.stickers.length === 1).length,
      stickers: affected.reduce((sum, piece) => sum + piece.stickers.length, 0),
    },
    explanation: describeMove(token, cube.size),
  };
}
