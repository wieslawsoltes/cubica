import test from 'node:test';
import assert from 'node:assert/strict';
import { CubeState, FACE_NORMALS } from '../dist/modules/cube.js';
import { createGraphData, cubieOrientation, graphFocus } from '../dist/modules/graphs.js';
import { algorithms, lessons, algorithmPreviewSVG } from '../dist/modules/curriculum.js';

test('the complete 3×3 physical graph contains every visible cubie and adjacency', () => {
  const cube = new CubeState();
  const graph = createGraphData(cube, 'pieces');
  assert.equal(graph.nodes.length, 26);
  assert.equal(graph.edges.length, 48);
  assert.deepEqual(graph.stats, { pieces: 26, connections: 48, corners: 8, edges: 12, centers: 6 });
  const byId = new Map(cube.cubies.map(p => [p.id, p]));
  for (const edge of graph.edges) {
    const a = byId.get(edge.source), b = byId.get(edge.target);
    assert.equal(a.position.reduce((d, v, i) => d + Math.abs(v - b.position[i]), 0), 1);
  }
});

test('larger physical graphs retain every shell cubie', () => {
  for (let n = 2; n <= 7; n++) {
    const cube = new CubeState(n).applyAlgorithm('R U F2');
    const graph = createGraphData(cube, 'pieces');
    assert.equal(graph.nodes.length, n ** 3 - (n - 2) ** 3);
    assert.equal(graph.edges.length, 12 * (n - 1) ** 2);
    assert.equal(new Set(graph.nodes.map(n => n.id)).size, graph.nodes.length);
    assert.ok(graph.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));
  }
});

test('cross graph reports real D-edge progress', () => {
  const cube = new CubeState();
  assert.equal(createGraphData(cube, 'cross').stats.solved, 4);
  cube.applyMove('F');
  assert.equal(createGraphData(cube, 'cross').stats.solved, 3);
  cube.applyMove("F'");
  assert.equal(createGraphData(cube, 'cross').stats.solved, 4);
  assert.equal(createGraphData(new CubeState(2), 'cross').nodes.length, 0);
});

test('piece selection exposes exactly the physical neighbors, including on larger cubes', () => {
  for (const size of [2, 3, 4, 7]) {
    const cube = new CubeState(size).applyAlgorithm("R U F2 L'");
    const graph = createGraphData(cube, 'pieces');
    const original = structuredClone(graph);
    const signature = cube.signature();
    // Cover all physical kinds without relying on any particular node layout.
    const samples = [1, 2, 3].map(stickers => cube.cubies.find(p => p.stickers.length === stickers)).filter(Boolean);
    for (const piece of samples) {
      const expected = new Set(cube.cubies.filter(p => p.position.reduce((d, value, axis) => d + Math.abs(value - piece.position[axis]), 0) === 1).map(p => p.id));
      const focus = graphFocus(graph, { selectedPiece: piece.id });
      assert.deepEqual(focus.selected, new Set([piece.id]));
      assert.deepEqual(focus.neighbors, expected);
      assert.deepEqual(focus.emphasized, new Set([piece.id, ...expected]));
      assert.equal(focus.active, true);
    }
    assert.deepEqual(graph, original, 'selection must not alter cached graph data');
    assert.equal(cube.signature(), signature, 'selection must not turn the cube');
  }
});

test('cross targets and tracked edges share one exact physical selection', () => {
  const cube = new CubeState().applyAlgorithm("F R U'");
  const graph = createGraphData(cube, 'cross');
  const center = cube.cubies.find(p => p.stickers.length === 1 && p.stickers[0].color === 'D');
  const centerNode = graph.nodes.find(n => n.id === center.id);
  assert.deepEqual(centerNode.progress, { value: graph.stats.solved, total: 4 });
  assert.equal(centerNode.displayLabel, `${graph.stats.solved}/4`);
  for (const piece of cube.cubies.filter(p => p.stickers.length === 2 && p.stickers.some(s => s.color === 'D'))) {
    const focus = graphFocus(graph, { selectedPiece: piece.id });
    assert.deepEqual(focus.selected, new Set([piece.id, `target-${piece.id}`]));
    assert.deepEqual(focus.neighbors, new Set([center.id]));
    const tracked = graph.nodes.find(n => n.id === piece.id);
    const target = graph.nodes.find(n => n.id === `target-${piece.id}`);
    assert.equal(target.pieceId, tracked.pieceId);
    assert.equal(target.label, tracked.label, 'identity must remain stable when a tracked edge moves to another slot');
    assert.equal(target.solved, tracked.solved);
    const arrow = graph.edges.find(e => e.source === tracked.id && e.target === target.id);
    assert.equal(arrow.directed, true);
    assert.equal(arrow.dashed, !tracked.solved);
  }
});

test('next-turn highlighting remains independent from a pinned piece and includes fixed face centers', () => {
  const cube = new CubeState().applyAlgorithm("R U F2 D'");
  const graph = createGraphData(cube, 'pieces');
  const affected = new Set(cube.cubies.filter(p => p.position[0] === 1).map(p => p.id));
  const selected = cube.cubies.find(p => p.position[0] === -1 && p.stickers.length === 2).id;
  const focus = graphFocus(graph, { selectedPiece: selected, highlightedPieces: affected });
  assert.equal(affected.size, 9);
  assert.deepEqual(focus.selected, new Set([selected]));
  assert.deepEqual(focus.highlighted, affected);
  assert.equal(focus.highlighted.has(selected), false);
  const rightCenter = cube.cubies.find(p => p.position[0] === 1 && p.stickers.length === 1);
  assert.ok(focus.highlighted.has(rightCenter.id));
  assert.deepEqual(graphFocus(graph, { selectedPiece: selected, highlightedPieces: [...affected] }), focus);
  assert.ok([...focus.selected, ...focus.neighbors, ...affected].every(id => focus.emphasized.has(id)));

  const cross = createGraphData(cube, 'cross');
  const crossFocus = graphFocus(cross, { highlightedPieces: affected });
  assert.deepEqual(crossFocus.highlighted, new Set(cross.nodes.filter(n => affected.has(n.pieceId)).map(n => n.id)));
});

test('selecting a permutation keeps its complete directed cycle visible', () => {
  const cube = new CubeState().applyMove('R');
  const graph = createGraphData(cube, 'cycles');
  assert.equal(graph.cycles.length, 2);
  for (const cycle of graph.cycles) {
    assert.equal(cycle.length, 4);
    const selected = cycle[0];
    const focus = graphFocus(graph, { selectedPiece: selected });
    assert.deepEqual(focus.cycle, new Set(cycle));
    assert.deepEqual(focus.emphasized, new Set(cycle));
    assert.equal(focus.neighbors.size, 2);
    for (let i = 0; i < cycle.length; i++) {
      assert.ok(graph.edges.some(edge => edge.source === cycle[i] && edge.target === cycle[(i + 1) % cycle.length] && edge.directed));
    }
    assert.ok(graph.nodes.filter(n => !focus.emphasized.has(n.id)).every(n => !cycle.includes(n.id)));
  }
});

test('stale piece IDs and whole-state diagrams never create a false piece focus', () => {
  const cube = new CubeState().applyMove('F');
  for (const mode of ['pieces', 'cross', 'cycles', 'states']) {
    const focus = graphFocus(createGraphData(cube, mode), { selectedPiece: 'missing-piece', highlightedPieces: ['missing-piece'] });
    assert.equal(focus.active, false);
    assert.equal(focus.emphasized.size, 0);
  }
  const states = createGraphData(cube, 'states');
  assert.equal(graphFocus(states, { selectedPiece: cube.cubies[0].id, highlightedPieces: cube.cubies.map(p => p.id) }).active, false);
  assert.equal(graphFocus(createGraphData(cube), { highlightedPieces: 'not-an-id-list' }).active, false);
});

test('3×3 diagrams retain a solved state through every whole-cube rotation', () => {
  for (const rotations of ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'", 'x y z2']) {
    const cube = new CubeState().applyAlgorithm(rotations);
    assert.ok(cube.isSolved());
    assert.equal(createGraphData(cube, 'cross').stats.solved, 4, rotations);
    const cycles = createGraphData(cube, 'cycles');
    assert.equal(cycles.stats.cycles, 0, rotations);
    assert.equal(cycles.stats.oriented, 0, rotations);
    assert.equal(cycles.edges.length, 0, rotations);
    assert.ok(createGraphData(cube, 'pieces').nodes.every(n => n.solved), rotations);
  }
});

test('rotating a scrambled cube preserves center-relative graphs, including M and wide moves', () => {
  for (const scramble of ["R U F2 D'", "M U M' U2", "Rw U Rw' F", "S E R U2 M'"]) {
    const cube = new CubeState().applyAlgorithm(scramble);
    const beforeCross = createGraphData(cube, 'cross').stats;
    const beforeCycles = createGraphData(cube, 'cycles');
    const beforeMap = beforeCycles.nodes.map(n => [n.id, n.orientation, n.solved, n.slot]);
    for (const rotation of ['x', 'y', "z'"]) {
      cube.applyMove(rotation);
      assert.deepEqual(createGraphData(cube, 'cross').stats, beforeCross, `${scramble} ${rotation}`);
      const after = createGraphData(cube, 'cycles');
      assert.deepEqual(after.stats, beforeCycles.stats, `${scramble} ${rotation}`);
      assert.deepEqual(after.nodes.map(n => [n.id, n.orientation, n.solved, n.slot]), beforeMap);
    }
  }
});

test('cycle graphs distinguish a face turn from a three-corner commutator', () => {
  assert.equal(createGraphData(new CubeState(), 'cycles').edges.length, 0);
  const face = createGraphData(new CubeState().applyMove('R'), 'cycles');
  assert.equal(face.stats.cycles, 2);
  assert.equal(face.stats.moved, 8);
  const commutator = createGraphData(new CubeState().applyAlgorithm("[R U R', D]"), 'cycles');
  assert.equal(commutator.stats.cycles, 1);
  assert.equal(commutator.stats.moved, 3);
  for (const edge of commutator.edges) assert.equal(commutator.nodes.find(n => n.id === edge.source).kind, 'corner');
});

test('orientation badges obey legal 3×3 twist and flip invariants', () => {
  // Fixed deterministic sequences exercise all axes without a flaky RNG.
  const cube = new CubeState();
  const moves = ['R', 'U2', "F'", 'L', 'B2', "D'", 'F', "R'", 'B', 'L2'];
  for (let i = 0; i < 100; i++) {
    cube.applyMove(moves[i % moves.length]);
    const twist = cube.cubies.filter(p => p.stickers.length === 3).reduce((s, p) => s + cubieOrientation(p), 0);
    const flip = cube.cubies.filter(p => p.stickers.length === 2).reduce((s, p) => s + cubieOrientation(p), 0);
    assert.equal(twist % 3, 0);
    assert.equal(flip % 2, 0);
  }
});

test('state neighborhood contains exactly the states represented by its paths', () => {
  const cube = new CubeState().applyAlgorithm("R U F2 D'");
  const graph = createGraphData(cube, 'states');
  assert.equal(graph.nodes.length, 13);
  assert.equal(graph.edges.length, 12);
  assert.equal(new Set(graph.nodes.map(n => n.cube.signature())).size, 13);
  for (const node of graph.nodes) assert.equal(cube.clone().applyAlgorithm(node.moves).signature(), node.cube.signature());
  assert.match(graph.subtitle, /not the full state space/);
});

test('all 57 OLL orientations are distinct up to U alignment and preserve F2L', () => {
  const catalog = algorithms.filter(a => a.family === 'OLL');
  assert.equal(catalog.length, 57);
  const patterns = new Set();
  for (const record of catalog) {
    const cube = new CubeState().applyAlgorithm(record.setup);
    assertLowerPiecesHome(cube, record.id);
    const rotations = [];
    for (let i = 0; i < 4; i++) {
      rotations.push(Object.values(cube.facelets()).flat().map(c => c === 'U' ? '1' : '0').join(''));
      cube.applyMove('U');
    }
    patterns.add(rotations.sort()[0]);
    assert.ok(cube.applyAlgorithm(record.moves).isSolved(), record.id);
  }
  assert.equal(patterns.size, 57);
});

test('all 21 PLL cases preserve F2L and upper orientation', () => {
  const catalog = algorithms.filter(a => a.family === 'PLL');
  assert.equal(catalog.length, 21);
  for (const record of catalog) {
    const cube = new CubeState().applyAlgorithm(record.setup);
    assertLowerPiecesHome(cube, record.id);
    assert.ok(cube.facelets().U.every(c => c === 'U'), record.id);
    assert.ok(cube.applyAlgorithm(record.moves).isSolved(), record.id);
  }
});

test('all guided cases parse and replay to a solved cube at their declared size', () => {
  assert.equal(lessons.length, 25);
  assert.equal(new Set(lessons.map(l => l.id)).size, lessons.length);
  for (const record of [...algorithms, ...lessons]) {
    const moves = record.moves || record.algorithm;
    if (!moves) continue;
    const cube = new CubeState(record.size || 3).applyAlgorithm(record.setup).applyAlgorithm(moves);
    assert.ok(cube.isSolved(), record.id);
  }
  for (const record of algorithms) {
    const svg = algorithmPreviewSVG(record);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(!svg.includes('undefined'));
  }
});

function assertLowerPiecesHome(cube, label) {
  for (const piece of cube.cubies.filter(p => p.home[1] < 1 || p.stickers.length === 1)) {
    assert.deepEqual(piece.position, piece.home, label);
    for (const sticker of piece.stickers) assert.deepEqual(sticker.normal, FACE_NORMALS[sticker.color], label);
  }
}
