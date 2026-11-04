import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { Worker as NodeWorker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import {
  CubeState, FACES, FACE_NORMALS, parseAlgorithm, invertAlgorithm,
  getMoveSpec, generateScramble, simplifyAlgorithm, validateFacelets, crossStatus,
} from '../dist/modules/cube.js';
import { solveCube, solveCross, disposeSolver, solverFacelets } from '../dist/modules/solver.js';

const reference = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../dist/vendor/cubejs/cube.js', import.meta.url), 'utf8'), reference);
const ReferenceCube = reference.Cube;

function seeded(seed) {
  return () => {
    seed = Math.imul(seed ^ seed >>> 15, 1 | seed);
    seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed);
    return ((seed ^ seed >>> 14) >>> 0) / 4294967296;
  };
}

// Run the actual classic Worker file in a worker thread, with just the browser
// messaging/importScripts surface adapted. This tests protocol and cancellation
// without depending on a browser or on the UI implementation.
class BrowserWorker {
  constructor(url) {
    this.thread = new NodeWorker(`
      const {parentPort, workerData} = require('node:worker_threads');
      const fs = require('node:fs');
      const vm = require('node:vm');
      const path = require('node:path');
      const scope = {performance, console};
      scope.self = scope;
      scope.postMessage = value => parentPort.postMessage(value);
      const context = vm.createContext(scope);
      scope.importScripts = (...urls) => {
        for (const url of urls) vm.runInContext(fs.readFileSync(path.resolve(path.dirname(workerData), url), 'utf8'), context);
      };
      vm.runInContext(fs.readFileSync(workerData, 'utf8'), context);
      parentPort.on('message', data => scope.onmessage({data}));
    `, { eval: true, workerData: fileURLToPath(url) });
    this.thread.on('message', data => this.onmessage?.({ data }));
    this.thread.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
  }
  postMessage(value) { this.thread.postMessage(value); }
  terminate() { return this.thread.terminate(); }
}
globalThis.Worker = BrowserWorker;

test('notation expands groups, inverse groups, commutators, conjugates, and comments', () => {
  assert.deepEqual(parseAlgorithm("(R U R′ U′)2"), ['R', 'U', "R'", "U'", 'R', 'U', "R'", "U'"]);
  assert.deepEqual(parseAlgorithm('[R,U]'), ['R', 'U', "R'", "U'"]);
  assert.deepEqual(parseAlgorithm('[R:U2]'), ['R', 'U2', "R'"]);
  assert.deepEqual(parseAlgorithm("(R U)2'"), ["U'", "R'", "U'", "R'"]);
  assert.deepEqual(parseAlgorithm('r 2Rw 3Rw2 M\n// comment\nE'), ['Rw', 'Rw', '3Rw2', 'M', 'E']);
  assert.deepEqual(simplifyAlgorithm("R R U U' R R2'"), ['R']);
  assert.throws(() => parseAlgorithm('(R U'), /closing/);
  assert.throws(() => parseAlgorithm('R3'), /Unexpected/);
  assert.throws(() => parseAlgorithm('2R'), /wide/);
  assert.throws(() => parseAlgorithm('[R]'), /commutator/);
  assert.throws(() => parseAlgorithm('((((((((((((((R))))))))))))))'), /nest/);
  assert.throws(() => parseAlgorithm('((R U)100)100'), /Expanded/);
});

test('all supported cube sizes have exact piece and sticker counts', () => {
  for (let size = 2; size <= 7; size++) {
    const cube = new CubeState(size);
    assert.equal(cube.cubies.length, size ** 3 - (size - 2) ** 3);
    assert.equal(cube.cubies.reduce((n, c) => n + c.stickers.length, 0), 6 * size ** 2);
    assert.equal(cube.faceletString(), FACES.map(face => face.repeat(size ** 2)).join(''));
    assert.equal(cube.isSolved(), true);
  }
});

test('face, slice, rotation, and wide move conventions match an independent established implementation', () => {
  for (const face of [...'URFDLBMESxyzurfdlb']) for (const suffix of ['', "'", '2']) {
    const token = face + suffix;
    const ours = new CubeState().applyMove(token).faceletString();
    const theirs = new ReferenceCube().move(token).asString();
    assert.equal(ours, theirs, `Convention mismatch for ${token}`);
  }
  let ours = new CubeState();
  let theirs = new ReferenceCube();
  const random = seeded(841);
  for (let i = 0; i < 200; i++) {
    const face = 'URFDLBMESxyzurfdlb'[Math.floor(random() * 18)];
    const token = face + ['', "'", '2'][Math.floor(random() * 3)];
    ours.applyMove(token); theirs.move(token);
    assert.equal(ours.faceletString(), theirs.asString());
    validateFacelets(ours.faceletString());
  }
});

test('turns form exact permutations: four turns, inverse sequences, snapshots, and rotations', () => {
  for (let size = 2; size <= 7; size++) {
    const initial = new CubeState(size);
    const moves = [...'URFDLBxyz', ...FACES.map(f => `${f}w`)];
    if (size % 2) moves.push(...'MES');
    if (size >= 3) moves.push('3Rw');
    for (const move of moves) {
      const cube = initial.clone().applyAlgorithm(Array(4).fill(move));
      assert.deepEqual(cube.cubies, initial.cubies, `${size}×${size} ${move}⁴`);
      assert.deepEqual(initial.clone().applyAlgorithm([move, ...invertAlgorithm(move)]).cubies, initial.cubies);
    }
    const scramble = generateScramble(size, 100, seeded(size * 431));
    const cube = initial.clone().applyAlgorithm(scramble);
    assert.equal(cube.isSolved(), false);
    const restored = CubeState.fromSnapshot(cube.snapshot());
    assert.equal(restored.signature(), cube.signature());
    assert.deepEqual(restored.history, scramble);
    cube.applyAlgorithm(invertAlgorithm(scramble));
    assert.deepEqual(cube.cubies, initial.cubies);
    const reoriented = initial.clone().applyAlgorithm('x y z');
    assert.equal(reoriented.isSolved(), true);
  }
});

test('invalid notation is atomic and cannot partially mutate a cube', () => {
  const cube = new CubeState(4);
  const before = cube.signature();
  assert.throws(() => cube.applyAlgorithm('R U M'), /middle slice/);
  assert.equal(cube.signature(), before);
  assert.throws(() => getMoveSpec('4Rw', 3), /needs 4 layers/);
});

test('physical cube import accepts legal facelets and rejects every reachability violation', () => {
  const solved = new CubeState().faceletString();
  const altered = (change) => { const array = [...solved]; change(array); return array.join(''); };
  assert.throws(() => CubeState.fromFacelets('U'.repeat(54)), /nine times/);
  assert.throws(() => CubeState.fromFacelets(altered(a => [a[5], a[10]] = [a[10], a[5]])), /edge flip/);
  assert.throws(() => CubeState.fromFacelets(altered(a => [a[8], a[9], a[20]] = [a[20], a[8], a[9]])), /corner twist/);
  assert.throws(() => CubeState.fromFacelets(altered(a => [a[9], a[20]] = [a[20], a[9]])), /impossible corner/);
  assert.throws(() => CubeState.fromFacelets(altered(a => { [a[5], a[7]] = [a[7], a[5]]; [a[10], a[19]] = [a[19], a[10]]; })), /parity/);
  assert.throws(() => CubeState.fromFacelets(altered(a => [a[13], a[40]] = [a[40], a[13]])), /center/);
  const cube = new CubeState().applyAlgorithm("M E' S2 x y R U2 B' F L2 D");
  assert.equal(CubeState.fromFacelets(cube.faceletString()).signature(), cube.signature());
  assert.equal(CubeState.fromFacelets(cube.facelets()).signature(), cube.signature());
  assert.equal(CubeState.fromFacelets(cube.facelets()).history, null);
});

test('snapshot validation rejects malformed geometry and never trusts mismatched history', () => {
  const cube = new CubeState().applyAlgorithm('R U F');
  const snapshot = cube.snapshot();
  snapshot.history = ['R'];
  assert.equal(CubeState.fromSnapshot(snapshot).history, null);
  const duplicate = cube.snapshot();
  duplicate.cubies[1].position = [...duplicate.cubies[0].position];
  assert.throws(() => CubeState.fromSnapshot(duplicate));
  const nan = cube.snapshot(); nan.cubies[0].position[0] = NaN;
  assert.throws(() => CubeState.fromSnapshot(nan), /lattice/);
  const colors = cube.snapshot(); colors.cubies[0].stickers[0].color = 'Z';
  assert.throws(() => CubeState.fromSnapshot(colors), /sticker color/);
});

test('worker solves random imported 3×3 and arbitrary 2×2 states without history', { timeout: 120000 }, async () => {
  const phases = new Set();
  try {
    for (let index = 0; index < 8; index++) {
      const size = index < 5 ? 3 : 2;
      const cube = new CubeState(size).applyAlgorithm(generateScramble(size, size === 3 ? 25 : 15, seeded(110 + index)));
      if (size === 3 && index % 2) cube.applyAlgorithm("x M' y2");
      const imported = size === 3 ? CubeState.fromFacelets(cube.facelets()) : cube.clone();
      imported.history = null;
      const before = imported.signature();
      const result = await solveCube(imported, { onProgress: p => phases.add(p.phase) });
      assert.match(result.method, /phase/);
      assert.ok(result.moves.length <= 22);
      assert.equal(imported.signature(), before, 'Solving must not mutate the live cube');
      assert.equal(imported.clone().applyAlgorithm(result.moves).isSolved(), true);
      assert.equal(solverFacelets(imported).length, 54);
    }
    assert.ok(phases.has('prepare'));
    assert.ok(phases.has('search'));
    assert.ok(phases.has('complete'));
  } finally { disposeSolver(); }
});

test('larger cube solutions are explicitly labeled, verified history reversals', async () => {
  for (let size = 4; size <= 7; size++) {
    const cube = new CubeState(size).applyAlgorithm(generateScramble(size, 35, seeded(size * 71)));
    const result = await solveCube(cube);
    assert.equal(result.method, 'Verified history reversal');
    assert.equal(cube.clone().applyAlgorithm(result.moves).isSolved(), true);
    cube.history = null;
    await assert.rejects(solveCube(cube), /move history/);
  }
});

test('cross planner spans exactly 190,080 states, diameter eight, and solves every target color', { timeout: 30000 }, async () => {
  try {
    for (const color of FACES) {
      const cube = new CubeState().applyAlgorithm(generateScramble(3, 24, seeded(color.charCodeAt(0) * 81)));
      cube.applyAlgorithm("x y M");
      const result = await solveCross(cube, { color });
      assert.equal(result.stateCount, 190080);
      assert.equal(result.diameter, 8);
      assert.equal(result.optimal, true);
      assert.ok(result.moves.length <= 8);
      assert.equal(crossStatus(cube.clone().applyAlgorithm(result.moves), color).solved, true);
    }
    for (const [sequence, expectedLength] of [['', 0], ['D', 1], ['R D', 2]]) {
      const result = await solveCross(new CubeState().applyAlgorithm(sequence));
      assert.equal(result.moves.length, expectedLength);
    }
  } finally { disposeSolver(); }
});

test('active worker search can be cancelled without corrupting a subsequent solve', { timeout: 120000 }, async () => {
  const cube = new CubeState().applyAlgorithm('R U R\' F2 D L');
  const controller = new AbortController();
  const aborted = solveCube(cube, { signal: controller.signal });
  controller.abort();
  await assert.rejects(aborted, error => error.name === 'AbortError');
  try {
    const solved = await solveCube(cube);
    assert.equal(cube.clone().applyAlgorithm(solved.moves).isSolved(), true);
  } finally { disposeSolver(); }
});
