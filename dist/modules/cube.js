/**
 * Cubica's exact, renderer-independent NxN cube model.
 *
 * Coordinates: +X right, +Y up, +Z front. All coordinates are integral or
 * half-integral; turns use signed permutations, never floating-point trig.
 * Facelets use the standard URFDLB layout accepted by the two-phase solver.
 */
export const FACES = Object.freeze(['U', 'R', 'F', 'D', 'L', 'B']);
export const COLORS = Object.freeze({
  U: '#f2eee5', R: '#ed655c', F: '#34b6a3',
  D: '#edc84d', L: '#f6a34c', B: '#5c8fe9',
});
export const FACE_NAMES = Object.freeze({ U: 'Up', R: 'Right', F: 'Front', D: 'Down', L: 'Left', B: 'Back' });
export const FACE_NORMALS = Object.freeze({
  U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1],
  D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1],
});
const MAX_MOVES = 10000;
const MOVE_RE = /^(?:(\d+)?([URFDLB])([wW])?|([urfdlb])|([MESxyz]))(2'?|'2?|)?$/;
const FACE_SPEC = { U: [1, 1], R: [0, 1], F: [2, 1], D: [1, -1], L: [0, -1], B: [2, -1] };

function assertSize(size) {
  if (!Number.isInteger(size) || size < 2 || size > 7) throw new RangeError('Choose a cube size from 2×2 through 7×7.');
}

function canonicalMove(token) {
  const match = MOVE_RE.exec(String(token));
  if (!match) throw new SyntaxError(`Invalid move “${token}”. Use U R F D L B, wide moves, M E S, or x y z.`);
  const [, prefix, face, wide, lowercase, other, suffix] = match;
  if (prefix && !wide) throw new SyntaxError(`A layer count needs wide notation: write ${prefix}${face}w.`);
  let base = other || (lowercase ? `${lowercase.toUpperCase()}w` : `${prefix || ''}${face}${wide ? 'w' : ''}`);
  if (base.startsWith('2') && base.endsWith('w')) base = base.slice(1);
  if (prefix && (!Number.isSafeInteger(Number(prefix)) || Number(prefix) < 2 || Number(prefix) > 7)) {
    throw new RangeError('Wide moves must turn between 2 and 7 layers.');
  }
  return base + (suffix?.includes('2') ? '2' : suffix ? "'" : '');
}

/** Parse notation, repetitions, commutators [A,B], and conjugates [A:B]. */
export function parseAlgorithm(algorithm) {
  if (Array.isArray(algorithm)) {
    if (algorithm.length > MAX_MOVES) throw new RangeError(`An algorithm may contain at most ${MAX_MOVES} moves.`);
    return algorithm.map(token => canonicalMove(String(token).replace(/[’′]/g, "'")));
  }
  if (typeof algorithm !== 'string') throw new TypeError('An algorithm must be a string or an array of moves.');
  if (algorithm.length > 100000) throw new RangeError('The algorithm is too long.');
  const source = algorithm.replace(/[’′]/g, "'").replace(/\/\/[^\n]*|#[^\n]*/g, '').replace(/[·•]/g, ' ');
  let at = 0;
  const skip = () => { while (/\s/.test(source[at] || '') && at < source.length) at++; };
  const append = (target, moves) => {
    if (target.length + moves.length > MAX_MOVES) throw new RangeError(`Expanded algorithms may contain at most ${MAX_MOVES} moves.`);
    target.push(...moves);
  };
  const inverse = moves => moves.slice().reverse().map(invertMove);
  function groupSuffix(moves) {
    skip();
    let countText = '';
    while (/\d/.test(source[at] || '')) countText += source[at++];
    const count = countText ? Number(countText) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('Repeat a group between 1 and 100 times.');
    let inverseGroup = false;
    if (source[at] === "'") { inverseGroup = true; at++; }
    const unit = inverseGroup ? inverse(moves) : moves;
    const result = [];
    for (let i = 0; i < count; i++) append(result, unit);
    return result;
  }
  function sequence(stops = '', depth = 0) {
    if (depth > 12) throw new RangeError('Notation groups may nest at most 12 levels.');
    const moves = [];
    while (true) {
      skip();
      if (at >= source.length || stops.includes(source[at])) return moves;
      const char = source[at];
      if (char === '(') {
        at++;
        const inner = sequence(')', depth + 1);
        if (source[at++] !== ')') throw new SyntaxError('A repeated group is missing its closing parenthesis.');
        append(moves, groupSuffix(inner));
      } else if (char === '[') {
        at++;
        const left = sequence(',:]', depth + 1);
        const separator = source[at++];
        if (separator !== ',' && separator !== ':') throw new SyntaxError('Use [A,B] for a commutator or [A:B] for a conjugate.');
        const right = sequence(']', depth + 1);
        if (source[at++] !== ']') throw new SyntaxError('The commutator is missing its closing bracket.');
        if (!left.length || !right.length) throw new SyntaxError('Both parts of a commutator must contain moves.');
        append(moves, groupSuffix(separator === ',' ? [...left, ...right, ...inverse(left), ...inverse(right)] : [...left, ...right, ...inverse(left)]));
      } else {
        const match = /^(?:(?:\d+)?[URFDLB][wW]?|[urfdlbMESxyz])(?:2'?|'2?)?/.exec(source.slice(at));
        if (!match) throw new SyntaxError(`Unexpected “${char}” at character ${at + 1}.`);
        append(moves, [canonicalMove(match[0])]);
        at += match[0].length;
      }
    }
  }
  const result = sequence();
  skip();
  if (at !== source.length) throw new SyntaxError(`Unexpected notation at character ${at + 1}.`);
  return result;
}

export function invertMove(token) {
  const move = canonicalMove(token);
  return move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`;
}

export function invertAlgorithm(algorithm) {
  return parseAlgorithm(algorithm).reverse().map(invertMove);
}

/** Cancel adjacent inverse turns and combine consecutive turns of one layer. */
export function simplifyAlgorithm(algorithm) {
  const result = [];
  for (const move of parseAlgorithm(algorithm)) {
    const base = move.replace(/[2']$/, '');
    const exponent = move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1;
    const last = result.at(-1);
    if (last && last.base === base) {
      last.exponent = (last.exponent + exponent) % 4;
      if (!last.exponent) result.pop();
    } else result.push({ base, exponent });
  }
  return result.map(({ base, exponent }) => base + (exponent === 2 ? '2' : exponent === 3 ? "'" : ''));
}

/** Right-hand rotation specification, independent of visual implementation. */
export function getMoveSpec(token, size = 3) {
  assertSize(size);
  const move = canonicalMove(token);
  const base = move.replace(/[2']$/, '');
  const power = move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
  const half = (size - 1) / 2;
  const coordinates = Array.from({ length: size }, (_, i) => i - half);
  if ('xyz'.includes(base)) {
    return { axis: 'xyz'.indexOf(base), layers: coordinates, turns: -power, token: move };
  }
  if ('MES'.includes(base)) {
    if (size % 2 === 0) throw new RangeError(`${base} requires a single middle slice. Use wide moves on an even-layer cube.`);
    return { axis: { M: 0, E: 1, S: 2 }[base], layers: [0], turns: (base === 'S' ? -1 : 1) * power, token: move };
  }
  const match = /^(\d+)?([URFDLB])(w)?$/.exec(base);
  const [, width, face, wide] = match;
  const count = wide ? Number(width || 2) : 1;
  if (count > size) throw new RangeError(`${move} needs ${count} layers; this is a ${size}×${size} cube.`);
  const [axis, sign] = FACE_SPEC[face];
  return {
    axis,
    layers: Array.from({ length: count }, (_, i) => sign * (half - i)),
    turns: -sign * power,
    token: move,
  };
}

export function rotateVector(vector, axis, turns) {
  let [x, y, z] = vector;
  for (let i = 0, n = ((turns % 4) + 4) % 4; i < n; i++) {
    if (axis === 0) [y, z] = [-z, y];
    else if (axis === 1) [x, z] = [z, -x];
    else [x, y] = [-y, x];
  }
  return [x || 0, y || 0, z || 0];
}

export function normalFace(normal) {
  if (normal[1] === 1) return 'U';
  if (normal[0] === 1) return 'R';
  if (normal[2] === 1) return 'F';
  if (normal[1] === -1) return 'D';
  if (normal[0] === -1) return 'L';
  return 'B';
}

export function faceIndex(face, position, size) {
  const [x, y, z] = position;
  const h = (size - 1) / 2;
  let row, column;
  switch (face) {
    case 'U': row = z + h; column = x + h; break;
    case 'R': row = h - y; column = h - z; break;
    case 'F': row = h - y; column = x + h; break;
    case 'D': row = h - z; column = x + h; break;
    case 'L': row = h - y; column = z + h; break;
    case 'B': row = h - y; column = h - x; break;
  }
  return row * size + column;
}

const CORNER_FACELETS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const CORNER_COLORS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
const EDGE_FACELETS = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const EDGE_COLORS = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

function permutationParity(permutation) {
  let parity = 0;
  for (let i = 0; i < permutation.length; i++) for (let j = i + 1; j < permutation.length; j++) {
    if (permutation[i] > permutation[j]) parity ^= 1;
  }
  return parity;
}

/** Validate every 3×3 reachability invariant, including a rotated center frame. */
export function validateFacelets(input) {
  const text = typeof input === 'string' ? input.replace(/\s/g, '').toUpperCase() : FACES.map(face => input?.[face]?.join('') || '').join('');
  if (!/^[URFDLB]{54}$/.test(text)) throw new Error('Enter 54 facelets in URFDLB order, using U R F D L B as colors.');
  for (const color of FACES) if ([...text].filter(c => c === color).length !== 9) throw new Error('Each color must occur exactly nine times.');
  const centers = FACES.map((_, index) => text[index * 9 + 4]);
  if (new Set(centers).size !== 6) throw new Error('The six centers must have six different colors.');
  const location = Object.fromEntries(centers.map((color, index) => [color, FACES[index]]));
  const direction = color => FACE_NORMALS[location[color]];
  const opposite = (a, b) => direction(a).every((v, index) => v === -direction(b)[index]);
  const [rx, ry, rz] = direction('R');
  const [ux, uy, uz] = direction('U');
  const cross = [ry * uz - rz * uy, rz * ux - rx * uz, rx * uy - ry * ux];
  if (!opposite('U', 'D') || !opposite('R', 'L') || !opposite('F', 'B') || !cross.every((v, index) => v === direction('F')[index])) {
    throw new Error('The center colors must keep the cube’s original opposite pairs and handedness.');
  }
  const normalized = [...text].map(color => location[color]).join('');
  function readPieces(indices, expected, name) {
    const permutation = [], orientations = [];
    for (const facelets of indices) {
      const colors = facelets.map(index => normalized[index]);
      let found = false;
      for (let piece = 0; piece < expected.length && !found; piece++) {
        for (let orientation = 0; orientation < colors.length; orientation++) {
          if ([...expected[piece]].every((color, index) => color === colors[(index + orientation) % colors.length])) {
            permutation.push(piece);
            orientations.push(orientation);
            found = true;
            break;
          }
        }
      }
      if (!found) throw new Error(`An impossible ${name} was found. Check its sticker colors and order.`);
    }
    if (new Set(permutation).size !== indices.length) throw new Error(`A ${name} is duplicated or missing.`);
    return { permutation, orientations };
  }
  const corners = readPieces(CORNER_FACELETS, CORNER_COLORS, 'corner');
  const edges = readPieces(EDGE_FACELETS, EDGE_COLORS, 'edge');
  if (corners.orientations.reduce((sum, value) => sum + value, 0) % 3 !== 0) throw new Error('A corner twist makes this state impossible. Corner twists must sum to a multiple of three.');
  if (edges.orientations.reduce((sum, value) => sum + value, 0) % 2 !== 0) throw new Error('An edge flip makes this state impossible. Flipped edges must occur in pairs.');
  if (permutationParity(corners.permutation) !== permutationParity(edges.permutation)) throw new Error('The edge and corner permutations have different parity. A single pair of swapped pieces cannot be solved with legal turns.');
  return { text, normalized, centers, corners, edges };
}

export class CubeState {
  constructor(size = 3) {
    assertSize(size);
    this.size = size;
    this.reset();
  }

  reset(size = this.size) {
    assertSize(size);
    this.size = size;
    this.cubies = [];
    this.history = [];
    const h = (size - 1) / 2;
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) for (let k = 0; k < size; k++) {
      const position = [i - h, j - h, k - h];
      const stickers = [];
      for (const face of FACES) {
        const normal = FACE_NORMALS[face];
        const axis = normal.findIndex(component => component !== 0);
        if (position[axis] === normal[axis] * h) stickers.push({ color: face, normal: [...normal] });
      }
      if (stickers.length) this.cubies.push({ id: `${i}-${j}-${k}`, home: [...position], position, stickers });
    }
    return this;
  }

  clone() {
    const copy = Object.create(CubeState.prototype);
    copy.size = this.size;
    copy.cubies = this.cubies.map(c => ({
      id: c.id, home: [...c.home], position: [...c.position],
      stickers: c.stickers.map(s => ({ color: s.color, normal: [...s.normal] })),
    }));
    copy.history = this.history ? [...this.history] : null;
    return copy;
  }

  applyMove(token) {
    const spec = getMoveSpec(token, this.size);
    for (const cubie of this.cubies) {
      if (!spec.layers.includes(cubie.position[spec.axis])) continue;
      cubie.position = rotateVector(cubie.position, spec.axis, spec.turns);
      for (const sticker of cubie.stickers) sticker.normal = rotateVector(sticker.normal, spec.axis, spec.turns);
    }
    if (this.history) this.history.push(spec.token);
    return this;
  }

  applyAlgorithm(algorithm) {
    const moves = parseAlgorithm(algorithm);
    // Validate the whole algorithm before applying it, so invalid input is atomic.
    for (const move of moves) getMoveSpec(move, this.size);
    for (const move of moves) this.applyMove(move);
    return this;
  }

  facelets() {
    const faces = Object.fromEntries(FACES.map(face => [face, Array(this.size * this.size)]));
    for (const cubie of this.cubies) for (const sticker of cubie.stickers) {
      const face = normalFace(sticker.normal);
      faces[face][faceIndex(face, cubie.position, this.size)] = sticker.color;
    }
    return faces;
  }

  faceletString() {
    const faces = this.facelets();
    return FACES.map(face => faces[face].join('')).join('');
  }

  isSolved() {
    return Object.values(this.facelets()).every(face => face.every(color => color === face[0]));
  }

  signature() { return `${this.size}:${this.faceletString()}`; }

  snapshot() {
    return { version: 1, size: this.size, cubies: this.clone().cubies, history: this.history ? [...this.history] : null };
  }

  /** Structural validation is strict; the solver also checks 3×3 reachability. */
  static fromSnapshot(data) {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || data.version !== 1) throw new Error('This is not a supported Cubica cube snapshot.');
    assertSize(data.size);
    const result = new CubeState(data.size);
    const canonical = new Map(result.cubies.map(c => [c.id, c]));
    if (!Array.isArray(data.cubies) || data.cubies.length !== canonical.size) throw new Error('The snapshot has missing or extra pieces.');
    const h = (data.size - 1) / 2;
    const positions = new Set();
    const ids = new Set();
    const coordinate = value => Number.isFinite(value) && value >= -h && value <= h && Number.isInteger(value + h);
    result.cubies = data.cubies.map(c => {
      const original = canonical.get(c?.id);
      if (!original || ids.has(c.id)) throw new Error('The snapshot contains an unknown or duplicate piece.');
      ids.add(c.id);
      if (!Array.isArray(c.position) || c.position.length !== 3 || !c.position.every(coordinate) || !c.position.some(v => Math.abs(v) === h)) {
        throw new Error('A piece position is outside the cube lattice.');
      }
      if (!Array.isArray(c.home) || c.home.join(',') !== original.home.join(',')) throw new Error('A piece has an invalid home position.');
      const orbit = vector => vector.map(Math.abs).sort((a, b) => a - b).join(',');
      if (orbit(c.position) !== orbit(original.home)) throw new Error('A piece is outside its legal rotation orbit.');
      const positionKey = c.position.join(',');
      if (positions.has(positionKey)) throw new Error('Two pieces occupy the same position.');
      positions.add(positionKey);
      if (!Array.isArray(c.stickers) || c.stickers.length !== original.stickers.length) throw new Error('A piece has the wrong number of stickers.');
      const colors = new Set(original.stickers.map(s => s.color));
      const normals = new Set();
      const stickers = c.stickers.map(s => {
        if (!colors.delete(s?.color)) throw new Error('A piece contains an invalid or duplicate sticker color.');
        if (!Array.isArray(s.normal) || s.normal.length !== 3 || !s.normal.every(n => Number.isInteger(n) && Math.abs(n) <= 1) || s.normal.reduce((sum, n) => sum + Math.abs(n), 0) !== 1) {
          throw new Error('Sticker normals must be exact cube face directions.');
        }
        const normalKey = s.normal.join(',');
        if (normals.has(normalKey)) throw new Error('Two stickers occupy the same side of a piece.');
        normals.add(normalKey);
        const axis = s.normal.findIndex(n => n !== 0);
        if (c.position[axis] !== s.normal[axis] * h) throw new Error('A sticker points inside the cube.');
        return { color: s.color, normal: [...s.normal] };
      });
      return { id: c.id, home: [...original.home], position: [...c.position], stickers };
    });
    if (result.size === 3) validateFacelets(result.faceletString());
    result.history = null;
    // History is accepted only if replaying it independently reconstructs this state.
    if (Array.isArray(data.history) && data.history.length <= MAX_MOVES) {
      try {
        const history = parseAlgorithm(data.history);
        const replay = new CubeState(data.size).applyAlgorithm(history);
        if (replay.signature() === result.signature()) result.history = history;
      } catch { /* A snapshot is still usable without trusted history. */ }
    }
    return result;
  }

  /** Import a standard 54-character facelet string without depending on history. */
  static fromFacelets(input) {
    const { text } = validateFacelets(input);
    const result = new CubeState(3);
    const pieces = new Map(result.cubies.map(c => [c.stickers.map(s => s.color).sort().join(''), c]));
    const seen = new Set();
    const reconstructed = [];
    for (const location of result.cubies) {
      const stickers = location.stickers.map(sticker => {
        const face = normalFace(sticker.normal);
        const index = FACES.indexOf(face) * 9 + faceIndex(face, location.position, 3);
        return { color: text[index], normal: [...sticker.normal] };
      });
      const key = stickers.map(s => s.color).sort().join('');
      const original = pieces.get(key);
      if (!original || seen.has(original.id)) throw new Error('These facelets contain an impossible or duplicated piece.');
      seen.add(original.id);
      reconstructed.push({ id: original.id, home: [...original.home], position: [...location.position], stickers });
    }
    result.cubies = reconstructed;
    result.history = null;
    return result;
  }
}

/** Practice scrambles are random move sequences, not official random-state scrambles. */
export function generateScramble(size = 3, length = size === 2 ? 11 : size === 3 ? 20 : 10 * size, random = Math.random) {
  assertSize(size);
  if (!Number.isInteger(length) || length < 0 || length > 500) throw new RangeError('Choose a scramble length between 0 and 500.');
  const moves = [];
  let previousAxis = -1;
  for (let i = 0; i < length; i++) {
    let face;
    do { face = FACES[Math.min(5, Math.floor(random() * 6))]; } while (FACE_SPEC[face][0] === previousAxis);
    previousAxis = FACE_SPEC[face][0];
    let base = face;
    if (size > 3 && random() < 0.33) {
      const width = 2 + Math.floor(random() * Math.max(1, Math.floor(size / 2) - 1));
      base = (width > 2 ? width : '') + face + 'w';
    }
    moves.push(base + ['', '2', "'"][Math.min(2, Math.floor(random() * 3))]);
  }
  return moves;
}

export function describeMove(token, size = 3) {
  const move = canonicalMove(token);
  const base = move.replace(/[2']$/, '');
  const suffix = move.endsWith('2') ? 'a half turn (180°)' : move.endsWith("'") ? 'a quarter turn counterclockwise' : 'a quarter turn clockwise';
  if ('xyz'.includes(base)) return `Rotate the whole cube ${suffix}, as viewed from the ${ { x: 'right', y: 'top', z: 'front' }[base] }.`;
  if ('MES'.includes(base)) return `Turn the ${ { M: 'middle vertical', E: 'equatorial', S: 'standing' }[base] } slice ${suffix}, as viewed from the ${ { M: 'left', E: 'bottom', S: 'front' }[base] }.`;
  const face = base.match(/[URFDLB]/)[0];
  const spec = getMoveSpec(move, size);
  return `Turn the ${spec.layers.length > 1 ? `${spec.layers.length} ${FACE_NAMES[face].toLowerCase()} layers` : `${FACE_NAMES[face].toLowerCase()} face`} ${suffix}, looking directly at that face.`;
}

/** Four matching edges, including their adjacent center colors. */
export function crossStatus(cube, color = 'D') {
  if (cube.size !== 3 || !FACES.includes(color)) return { solved: false, matched: 0, total: 4, color, pieces: [] };
  const centers = Object.fromEntries(cube.cubies.filter(c => c.stickers.length === 1).map(c => [c.stickers[0].color, c.stickers[0].normal]));
  const pieces = cube.cubies.filter(c => c.stickers.length === 2 && c.stickers.some(s => s.color === color)).map(c => ({
    id: c.id,
    solved: c.stickers.every(s => s.normal.every((component, axis) => component === centers[s.color]?.[axis])),
  }));
  const matched = pieces.filter(piece => piece.solved).length;
  return { solved: matched === 4, matched, total: 4, color, pieces };
}
