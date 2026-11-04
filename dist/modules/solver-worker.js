/* Classic worker: vendor files are local, audited MIT sources. No network calls. */
importScripts('../vendor/cubejs/cube.js', '../vendor/cubejs/solve.js');

let initialized = false;
const crossTables = new Map();
let edgeTransitions = null;
const edgeNames = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
const moveNames = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(face => [face, `${face}2`, `${face}'`]);

function progress(id, phase, value, message) {
  self.postMessage({ id, type: 'progress', phase, progress: value, message });
}

function initialize(id) {
  if (initialized) return;
  const moveTables = ['twist', 'flip', 'FRtoBR', 'URFtoDLF', 'URtoDF', 'URtoUL', 'UBtoDF', 'mergeURtoDF'];
  const pruningTables = ['sliceTwist', 'sliceFlip', 'sliceURFtoDLFParity', 'sliceURtoDFParity'];
  for (let i = 0; i < moveTables.length; i++) {
    progress(id, 'prepare', 0.4 * i / moveTables.length, `Building move table ${i + 1} of ${moveTables.length}…`);
    self.Cube.computeMoveTables(moveTables[i]);
  }
  for (let i = 0; i < pruningTables.length; i++) {
    progress(id, 'prepare', 0.4 + 0.5 * i / pruningTables.length, `Building search guide ${i + 1} of ${pruningTables.length}…`);
    self.Cube.computePruningTables(pruningTables[i]);
  }
  initialized = true;
  progress(id, 'ready', 0.9, 'Offline solver ready.');
}

function transitions() {
  if (edgeTransitions) return edgeTransitions;
  edgeTransitions = moveNames.map(move => {
    const cube = new self.Cube().move(move);
    const table = new Uint8Array(24);
    for (let piece = 0; piece < 12; piece++) {
      const next = cube.ep.indexOf(piece);
      for (let orientation = 0; orientation < 2; orientation++) table[piece * 2 + orientation] = next * 2 + ((orientation + cube.eo[next]) % 2);
    }
    return table;
  });
  return edgeTransitions;
}

function crossTable(id, targetFace) {
  if (crossTables.has(targetFace)) return crossTables.get(targetFace);
  const pieces = edgeNames.flatMap((name, index) => name.includes(targetFace) ? [index] : []);
  if (pieces.length !== 4) throw new Error('Choose a valid target face.');
  const encode = values => ((values[0] * 24 + values[1]) * 24 + values[2]) * 24 + values[3];
  const goal = encode(pieces.map(piece => piece * 2));
  const distances = new Uint8Array(24 ** 4).fill(255);
  const queue = new Uint32Array(190080);
  queue[0] = goal;
  distances[goal] = 0;
  let head = 0, tail = 1, diameter = 0;
  const moves = transitions();
  while (head < tail) {
    const key = queue[head++];
    const a = key / 13824 | 0, b = key / 576 % 24 | 0, c = key / 24 % 24 | 0, d = key % 24;
    const distance = distances[key] + 1;
    for (const move of moves) {
      const next = ((move[a] * 24 + move[b]) * 24 + move[c]) * 24 + move[d];
      if (distances[next] !== 255) continue;
      distances[next] = distance;
      queue[tail++] = next;
      diameter = Math.max(diameter, distance);
    }
    if (head % 20000 === 0) progress(id, 'cross-table', head / 190080 * 0.9, `Mapping cross positions: ${head.toLocaleString()} of 190,080…`);
  }
  if (tail !== 190080) throw new Error('Cross database validation failed.');
  const table = { distances, pieces, encode, stateCount: tail, diameter };
  crossTables.set(targetFace, table);
  return table;
}

function shortestCross(id, facelets, targetFace) {
  const table = crossTable(id, targetFace);
  const cube = self.Cube.fromString(facelets);
  let codes = table.pieces.map(piece => {
    const position = cube.ep.indexOf(piece);
    return position * 2 + cube.eo[position];
  });
  const moves = [];
  let distance = table.distances[table.encode(codes)];
  if (distance === 255) throw new Error('The cross state is not reachable.');
  const transition = transitions();
  while (distance > 0) {
    let found = false;
    for (let move = 0; move < moveNames.length; move++) {
      const next = codes.map(code => transition[move][code]);
      if (table.distances[table.encode(next)] !== distance - 1) continue;
      moves.push(moveNames[move]);
      codes = next;
      distance--;
      found = true;
      break;
    }
    if (!found) throw new Error('The cross path could not be verified.');
  }
  return { moves, method: 'Optimal cross pattern database', optimal: true, metric: 'HTM', stateCount: table.stateCount, diameter: table.diameter };
}

self.onmessage = event => {
  const { id, type, facelets, targetFace } = event.data;
  try {
    if (type === 'cross') {
      if (!/^[URFDLB]{54}$/.test(facelets)) throw new Error('Invalid cross solver input.');
      const result = shortestCross(id, facelets, targetFace);
      self.postMessage({ id, type: 'result', result });
      return;
    }
    initialize(id);
    if (type === 'warmup') {
      self.postMessage({ id, type: 'result', result: { ready: true } });
      return;
    }
    if (type !== 'solve' || !/^[URFDLB]{54}$/.test(facelets)) throw new Error('Invalid solver input.');
    progress(id, 'search', 0.92, 'Searching both phases of the cube…');
    const cube = self.Cube.fromString(facelets);
    const algorithm = cube.solve(22);
    if (algorithm == null) throw new Error('No solution was found within the configured search depth.');
    const moves = algorithm.trim().split(/\s+/).filter(Boolean);
    if (!cube.clone().move(moves.join(' ')).isSolved()) throw new Error('The solver could not verify its result.');
    self.postMessage({ id, type: 'result', result: { moves, method: 'Kociemba two-phase search' } });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error.message || String(error) });
  }
};
