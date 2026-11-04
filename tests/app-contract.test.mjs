import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveTime, formatTime, formatAverage, trimmedAverage,
  sessionStats, inspectionPenalty, csvForSolves,
} from '../dist/modules/practice.js';
import { CubeState, FACES, FACE_NORMALS, parseAlgorithm } from '../dist/modules/cube.js';
import { algorithms, lessons } from '../dist/modules/curriculum.js';

const attempt = (ms, penalty = 'none') => ({ ms, penalty });
const attempts = values => values.map(ms => attempt(ms));

test('inspection penalties include the exact 15 and 17 second boundaries', () => {
  assert.equal(inspectionPenalty(0), 'none');
  assert.equal(inspectionPenalty(14999.999), 'none');
  assert.equal(inspectionPenalty(15000), 'plus2');
  assert.equal(inspectionPenalty(16999.999), 'plus2');
  assert.equal(inspectionPenalty(17000), 'dnf');
  assert.equal(inspectionPenalty(60000), 'dnf');
});

test('single times truncate and averages round to centiseconds, including minute carry', () => {
  assert.equal(formatTime(12349.99), '12.34');
  assert.equal(formatAverage(12349.99), '12.35');
  assert.equal(formatTime(59999.99), '59.99');
  assert.equal(formatAverage(59999.99), '1:00.00');
  assert.equal(formatTime(0), '0.00');
  assert.equal(formatAverage(0), '0.00');
  for (const formatter of [formatTime, formatAverage]) {
    assert.equal(formatter(Infinity), 'DNF');
    assert.equal(formatter(null), '—');
    assert.equal(formatter(undefined), '—');
    assert.equal(formatter(NaN), '—');
  }
  assert.equal(formatAverage(trimmedAverage(attempts([10000, 10000, 10010, 10010, 10020]), 5)), '10.01');
});

test('averages apply penalties before trimming and use recorded single precision', () => {
  assert.equal(effectiveTime(attempt(9000, 'plus2')), 11000);
  assert.equal(effectiveTime(attempt(9000, 'dnf')), Infinity);
  const penalized = [attempt(9000, 'plus2'), ...attempts([10000, 10500, 12000, 14000])];
  assert.equal(formatAverage(trimmedAverage(penalized, 5)), '11.17');
  // Displayed singles are 10.00, 10.01, 10.01, 10.02, and 10.03. The middle
  // three average to 10.0133, so hidden millisecond precision must not add .01.
  assert.equal(formatAverage(trimmedAverage(attempts([10009, 10019, 10019, 10029, 10039]), 5)), '10.01');
  assert.equal(trimmedAverage(attempts([1000, 1000, 10000, 11000, 12000, 13000, 14000]), 5), 12000);
});

test('one DNF is removed, two DNFs invalidate ao5 and ao12', () => {
  assert.equal(trimmedAverage([...attempts([10000, 11000, 12000, 13000]), attempt(9000, 'dnf')], 5), 12000);
  assert.equal(trimmedAverage([...attempts([10000, 11000, 12000]), attempt(9000, 'dnf'), attempt(8000, 'dnf')], 5), Infinity);
  assert.equal(trimmedAverage(attempts(Array.from({ length: 12 }, (_, i) => (i + 1) * 1000)), 12), 6500);
  const twelve = attempts(Array.from({ length: 12 }, (_, i) => (i + 1) * 1000));
  twelve[0].penalty = 'dnf';
  assert.equal(trimmedAverage(twelve, 12), 7500);
  twelve[1].penalty = 'dnf';
  assert.equal(trimmedAverage(twelve, 12), Infinity);
  assert.equal(trimmedAverage(attempts([1000, 2000, 3000, 4000]), 5), null);
});

test('session summary distinguishes no data, a zero time, and unsuccessful attempts', () => {
  assert.deepEqual(sessionStats([]), { count: 0, best: null, mean: null, ao5: null, ao12: null });
  const stats = sessionStats([attempt(5000, 'dnf'), attempt(0), attempt(1000, 'plus2')]);
  assert.equal(stats.count, 3);
  assert.equal(stats.best, 0);
  assert.equal(stats.mean, 1500);
  assert.equal(sessionStats([attempt(5000, 'dnf')]).best, null);
});

test('CSV retains raw measurements, penalties, puzzle size, and correctly escaped context', () => {
  const csv = csvForSolves([{ ms: 12349.123, penalty: 'plus2', size: 3, date: '2026-11-04T12:00:00Z', scramble: 'R U "case", F' }]);
  assert.match(csv, /^Solve,Time,RawMilliseconds,Penalty,Size,Date,Scramble\r\n/);
  assert.ok(csv.includes('"14.34","12349.123","plus2","3"'));
  assert.ok(csv.endsWith('"R U ""case"", F"'));
});

function assertFirstTwoLayers(cube, label) {
  const faces = cube.facelets();
  assert.ok(faces.D.every(color => color === 'D'), `${label}: lower face`);
  for (const face of ['R', 'F', 'L', 'B']) assert.ok(faces[face].slice(3).every(color => color === face), `${label}: ${face} lower layers`);
  for (const face of FACES) assert.equal(faces[face][4], face, `${label}: ${face} center frame`);
}

test('the full OLL and PLL catalogs preserve their defining cube invariants', () => {
  const oll = algorithms.filter(record => record.family === 'OLL');
  const pll = algorithms.filter(record => record.family === 'PLL');
  assert.equal(oll.length, 57);
  assert.equal(pll.length, 21);
  assert.deepEqual(oll.map(record => record.caseNumber).sort((a, b) => a - b), Array.from({ length: 57 }, (_, i) => i + 1));
  assert.equal(new Set(pll.map(record => record.caseName)).size, 21);
  const orientationCases = new Set();
  for (const record of [...oll, ...pll]) {
    const prepared = new CubeState(record.size).applyAlgorithm(record.setup);
    assertFirstTwoLayers(prepared, record.name);
    if (record.family === 'PLL') assert.ok(prepared.facelets().U.every(color => color === 'U'), `${record.name}: upper orientation`);
    else {
      const signatures = [];
      const rotated = prepared.clone();
      for (let turn = 0; turn < 4; turn++) {
        signatures.push(rotated.faceletString().replace(/[^U]/g, '.'));
        rotated.applyMove('U');
      }
      const signature = signatures.sort()[0];
      assert.ok(!orientationCases.has(signature), `${record.name} duplicates another OLL orientation case`);
      orientationCases.add(signature);
    }
    assert.ok(prepared.applyAlgorithm(record.moves).isSolved(), `${record.name}: prepared playback`);
  }
});

test('foundational trigger and commutator descriptions match their complete piece effects', () => {
  const trigger = algorithms.find(record => record.id === 'right-trigger');
  assert.ok(new CubeState().applyAlgorithm(`(${trigger.moves})6`).isSolved());
  const commutator = algorithms.find(record => record.id === 'corner-commutator');
  const cube = new CubeState().applyAlgorithm(commutator.moves);
  const changed = cube.cubies.filter(piece => !piece.position.every((value, axis) => value === piece.home[axis]) || piece.stickers.some(sticker => !sticker.normal.every((value, axis) => value === FACE_NORMALS[sticker.color][axis])));
  assert.equal(changed.length, 3);
  assert.ok(changed.every(piece => piece.stickers.length === 3));
});

test('all lesson demos use valid notation for their puzzle and their prepared cases finish correctly', () => {
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, lessons.length);
  assert.equal(new Set(algorithms.map(algorithm => algorithm.id)).size, algorithms.length);
  let demos = 0;
  for (const lesson of lessons) for (const step of lesson.steps) {
    if (!step.algorithm) continue;
    const size = step.size || lesson.size || 3;
    const cube = new CubeState(size).applyAlgorithm(step.setup);
    assert.ok(parseAlgorithm(step.algorithm).length > 0);
    cube.applyAlgorithm(step.algorithm);
    assert.ok(cube.isSolved(), `${lesson.id}: ${step.title}`);
    demos++;
  }
  assert.ok(demos > 20);
});
