import test from 'node:test';
import assert from 'node:assert/strict';
import { CubeState, crossStatus, invertAlgorithm } from '../dist/modules/cube.js';
import { createGraphData } from '../dist/modules/graphs.js';
import { analyzeCube, inspectPiece, analyzeMove } from '../dist/modules/insights.js';

function orientationGroup() {
  const result = [[]], seen = new Set([new CubeState().signature()]);
  for (let index = 0; index < result.length; index++) {
    for (const move of ['x', 'y']) {
      const path = [...result[index], move];
      const key = new CubeState().applyAlgorithm(path).signature();
      if (!seen.has(key)) { seen.add(key); result.push(path); }
    }
  }
  assert.equal(result.length, 24);
  return result;
}

function geometry(piece) {
  return { position: piece.position, stickers: piece.stickers };
}

test('solved 3×3 diagnostics expose all pieces, eight F2L pieces, and a complete solve', () => {
  const cube = new CubeState();
  const before = cube.snapshot();
  const state = analyzeCube(cube);
  assert.equal(state.solved, true);
  assert.deepEqual(state.pieces, {
    total: 26, solved: 26, positioned: 26, oriented: 26,
    movableTotal: 20, movableSolved: 20, corners: 8, edges: 12, centers: 6,
  });
  assert.deepEqual(state.stickers, { total: 54, aligned: 54 });
  assert.equal(state.cross.matched, 4);
  assert.equal(state.f2l.matched, 4);
  assert.equal(new Set(state.f2l.pieceIds).size, 8);
  assert.equal(state.oll.matched, 8);
  assert.equal(state.pll.matched, 8);
  assert.ok(state.milestones.every(milestone => milestone.complete));
  assert.equal(state.stage.id, 'solved');
  assert.deepEqual(cube.snapshot(), before);
});

test('CFOP milestones diagnose the state and require all earlier milestones', () => {
  const brokenBottom = analyzeCube(new CubeState().applyMove('D'));
  assert.equal(brokenBottom.cross.matched, 0);
  assert.equal(brokenBottom.oll.matched, 8, 'Upper orientation can be intact while lower layers are broken');
  assert.equal(brokenBottom.pll.matched, 8, 'Last-layer pieces can be placed while the D layer is broken');
  assert.ok(brokenBottom.milestones.every(milestone => !milestone.complete));
  assert.equal(brokenBottom.oll.solved, false);
  assert.equal(brokenBottom.pll.solved, false);
  assert.equal(brokenBottom.stage.id, 'cross');

  const missingPair = analyzeCube(new CubeState().applyAlgorithm("R U R'"));
  assert.equal(missingPair.cross.solved, true);
  assert.equal(missingPair.f2l.matched, 3);
  assert.equal(missingPair.stage.id, 'f2l');

  const orientLastLayer = analyzeCube(new CubeState().applyAlgorithm(invertAlgorithm("R U R' U R U2 R'")));
  assert.equal(orientLastLayer.f2l.solved, true);
  assert.equal(orientLastLayer.oll.solved, false);
  assert.equal(orientLastLayer.stage.id, 'oll');

  const alignLastLayer = analyzeCube(new CubeState().applyMove('U'));
  assert.equal(alignLastLayer.oll.solved, true);
  assert.equal(alignLastLayer.pll.matched, 0);
  assert.equal(alignLastLayer.stage.id, 'pll');
});

test('3×3 metrics and selected-piece diagnostics are invariant under all 24 cube orientations', () => {
  for (const moves of ['', "R U F2 D'", "M U M' U2", "Rw U Rw' F", "S E R U2 M'"]) {
    const cube = new CubeState().applyAlgorithm(moves);
    const expected = analyzeCube(cube);
    const inspections = cube.cubies.map(piece => inspectPiece(cube, piece.id));
    assert.equal(expected.cross.matched, crossStatus(cube, 'D').matched);
    for (const orientation of orientationGroup()) {
      const rotated = cube.clone().applyAlgorithm(orientation);
      assert.deepEqual(analyzeCube(rotated), expected, `${moves}; rotation ${orientation.join(' ')}`);
      for (const before of inspections) {
        const after = inspectPiece(rotated, before.id);
        for (const key of ['label', 'kind', 'homeSlot', 'currentSlot', 'position', 'home', 'inPlace', 'oriented', 'solved', 'status', 'orientation', 'orientationLabel', 'neighborIds', 'description']) {
          assert.deepEqual(after[key], before[key], `${moves}; ${before.label}; ${key}`);
        }
        assert.deepEqual(after.stickers.map(({ worldFace, ...sticker }) => sticker), before.stickers.map(({ worldFace, ...sticker }) => sticker));
      }
    }
  }
});

test('the inspector agrees with graph IDs and distinguishes a placed but flipped edge', () => {
  const data = new CubeState().snapshot();
  for (const label of ['FU', 'BU']) {
    const piece = data.cubies.find(piece => piece.stickers.map(sticker => sticker.color).sort().join('') === label);
    [piece.stickers[0].normal, piece.stickers[1].normal] = [piece.stickers[1].normal, piece.stickers[0].normal];
  }
  data.history = null;
  const cube = CubeState.fromSnapshot(data);
  const graph = createGraphData(cube, 'cycles');
  for (const node of graph.nodes) {
    const inspection = inspectPiece(cube, node.pieceId);
    assert.equal(inspection.label, node.label);
    assert.equal(inspection.currentSlot, node.slot);
    assert.equal(inspection.solved, node.solved);
    assert.equal(inspection.orientation, node.orientation);
  }
  const flipped = cube.cubies.find(piece => piece.stickers.length === 2 && piece.stickers.some(sticker => sticker.color === 'U') && piece.stickers.some(sticker => sticker.color === 'F'));
  const inspection = inspectPiece(cube, flipped.id);
  assert.equal(inspection.inPlace, true);
  assert.equal(inspection.oriented, false);
  assert.equal(inspection.solved, false);
  assert.equal(inspection.status, 'misoriented');
  assert.equal(inspection.orientation, 1);
  assert.equal(inspection.orientationLabel, 'Flipped edge');
  assert.equal(analyzeCube(cube).stage.id, 'oll');
  assert.equal(inspectPiece(cube, 'missing'), null);
});

test('inspection returns detached arrays and world directions without mutating a cube', () => {
  const cube = new CubeState().applyAlgorithm('F x');
  const before = cube.snapshot();
  const uf = cube.cubies.find(piece => piece.stickers.length === 2 && piece.stickers.some(sticker => sticker.color === 'U') && piece.stickers.some(sticker => sticker.color === 'F'));
  const info = inspectPiece(cube, uf.id);
  assert.equal(info.homeSlot, 'UF');
  assert.equal(info.currentSlot, 'FR');
  assert.equal(info.status, 'misplaced');
  assert.equal(info.orientation, 1);
  for (const sticker of info.stickers) assert.equal(typeof sticker.worldFace, 'string');
  info.position[0] = 500;
  info.worldPosition[0] = 500;
  info.home[0] = 500;
  info.stickers[0].color = 'B';
  info.neighborIds.length = 0;
  assert.deepEqual(cube.snapshot(), before);
});

test('face-turn impact counts every layer-selected piece while excluding unchanged centers from changed IDs', () => {
  for (let size = 2; size <= 7; size++) {
    const cube = new CubeState(size);
    for (const token of ['R', "U'", 'F2']) {
      const impact = analyzeMove(cube, token);
      assert.equal(impact.count, size * size);
      assert.equal(impact.changedCount, size * size - size % 2);
      assert.deepEqual(impact.counts, {
        corners: 4, edges: 4 * (size - 2), centers: (size - 2) ** 2, stickers: size * size + 4 * size,
      });
      assert.equal(impact.layerCount, 1);
      assert.equal(impact.wholeCube, false);
    }
  }
  const cube = new CubeState();
  assert.equal(analyzeMove(cube, 'R').count, 9);
  assert.equal(analyzeMove(cube, 'R').changedCount, 8);
  assert.equal(analyzeMove(cube, 'M').count, 8);
  assert.equal(analyzeMove(cube, 'M').changedCount, 8);
  assert.equal(analyzeMove(cube, 'x').count, 26);
  assert.equal(analyzeMove(cube, 'x').changedCount, 24);
  assert.equal(analyzeMove(cube, '3Rw').wholeCube, true);
  assert.equal(analyzeMove(cube, "r'").token, "Rw'");
});

test('predicted move impacts match actual geometry for turns, wide moves, slices and rotations', () => {
  for (let size = 2; size <= 7; size++) {
    const cube = new CubeState(size).applyAlgorithm("R U F2 L' D");
    const before = cube.snapshot();
    const tokens = ['R', "L'", 'B2', 'Rw', 'Uw2', "Fw'", `${size}Rw`, 'x', "y'", 'z2'];
    if (size % 2) tokens.push('M', "E'", 'S2');
    for (const token of tokens) {
      const impact = analyzeMove(cube, token);
      const after = cube.clone().applyMove(token);
      const changed = after.cubies.filter(piece => JSON.stringify(geometry(piece)) !== JSON.stringify(geometry(cube.cubies.find(p => p.id === piece.id)))).map(piece => piece.id);
      assert.deepEqual(impact.changedIds.sort(), changed.sort(), `${size}×${size} ${token}`);
      assert.ok(changed.every(id => impact.affectedIds.includes(id)), token);
      assert.equal(impact.affectedIds.length, new Set(impact.affectedIds).size);
      assert.equal(impact.angle, token.endsWith('2') ? 180 : 90);
    }
    assert.deepEqual(cube.snapshot(), before);
  }
});

test('unsupported milestones and invalid moves fail honestly without changing live state', () => {
  for (const size of [2, 4, 5, 6, 7]) {
    const cube = new CubeState(size);
    assert.equal(analyzeCube(cube).stage.id, 'solved');
    cube.applyMove('R');
    const state = analyzeCube(cube);
    assert.equal(state.frame, 'reference');
    assert.equal(state.milestones.length, 0);
    for (const phase of ['cross', 'f2l', 'oll', 'pll']) {
      assert.equal(state[phase].available, false);
      assert.equal(state[phase].solved, false);
      assert.equal(state[phase].total, 0);
    }
    assert.equal(state.stage.id, size === 2 ? 'corners' : 'reduction');
  }
  const cube = new CubeState(4);
  const before = cube.snapshot();
  for (const token of ['M', 'E', 'S', '5Rw', 'R U', 'invalid']) assert.throws(() => analyzeMove(cube, token));
  assert.equal(analyzeMove(cube, null), null);
  assert.equal(analyzeMove(cube, ''), null);
  assert.deepEqual(cube.snapshot(), before);
});
