import { CubeState, FACES, validateFacelets, invertAlgorithm, simplifyAlgorithm, crossStatus } from './cube.js';

let worker = null;
let current = null;
const queue = [];
let requestId = 0;
let ready = false;

function abortError() { return new DOMException('The solve was cancelled.', 'AbortError'); }

function finish(job, error, result) {
  clearTimeout(job.timeout);
  job.signal?.removeEventListener('abort', job.abort);
  if (error) job.reject(error);
  else job.resolve(result);
}

function destroyWorker() {
  worker?.terminate();
  worker = null;
  ready = false;
}

function runNext() {
  if (current || !queue.length) return;
  current = queue.shift();
  const job = current;
  if (job.signal?.aborted) {
    current = null;
    finish(job, abortError());
    runNext();
    return;
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('./solver-worker.js', import.meta.url), { name: 'Cubica two-phase solver' });
      worker.onmessage = event => {
        const message = event.data;
        if (!current || message.id !== current.id) return;
        if (message.type === 'progress') {
          if (message.phase === 'ready') ready = true;
          current.onProgress?.({ phase: message.phase, progress: message.progress, message: message.message });
        } else {
          const completed = current;
          current = null;
          if (message.type === 'error') finish(completed, new Error(message.message));
          else finish(completed, null, message.result);
          runNext();
        }
      };
      worker.onerror = event => {
        event.preventDefault?.();
        const failed = current;
        current = null;
        destroyWorker();
        if (failed) finish(failed, new Error(event.message || 'The solver worker could not start. Reload and try again.'));
        runNext();
      };
    } catch (error) {
      current = null;
      finish(job, error);
      runNext();
      return;
    }
  }
  job.onProgress?.({ phase: 'prepare', progress: 0, message: job.type === 'cross' ? 'Preparing the optimal cross planner…' : ready ? 'Searching for a solution…' : 'Preparing the offline solver…' });
  job.timeout = setTimeout(() => {
    if (current !== job) return;
    current = null;
    destroyWorker();
    finish(job, new Error('The search exceeded two minutes. The cube is unchanged; try again on a faster device.'));
    runNext();
  }, 120000);
  worker.postMessage({ id: job.id, type: job.type, facelets: job.facelets, targetFace: job.targetFace });
}

function enqueue(type, facelets, { onProgress, signal, targetFace } = {}) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const job = { id: ++requestId, type, facelets, onProgress, signal, targetFace, resolve, reject };
    job.abort = () => {
      if (current === job) {
        current = null;
        destroyWorker();
      } else {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
      }
      finish(job, abortError());
      runNext();
    };
    signal?.addEventListener('abort', job.abort, { once: true });
    queue.push(job);
    runNext();
  });
}

/**
 * Embed a 2×2's corners in a legal 3×3. The virtual edges are solved except for
 * a compensating edge swap when corner parity is odd. Any resulting outer-turn
 * solution solves those same corners on the physical 2×2.
 */
export function solverFacelets(cube) {
  if (cube.size === 3) return validateFacelets(cube.faceletString()).normalized;
  if (cube.size !== 2) throw new Error('The two-phase solver supports 2×2 and 3×3 cubes.');
  const faces = cube.facelets();
  const text = FACES.flatMap(face => Array(9).fill(face));
  const cornerIndices = [0, 2, 6, 8];
  for (let face = 0; face < 6; face++) for (let corner = 0; corner < 4; corner++) {
    text[face * 9 + cornerIndices[corner]] = faces[FACES[face]][corner];
  }
  const tuples = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
  const identities = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'].map(s => [...s].sort().join(''));
  const permutation = tuples.map(tuple => identities.indexOf(tuple.map(index => text[index]).sort().join('')));
  if (permutation.some(index => index < 0) || new Set(permutation).size !== 8) throw new Error('The pocket cube contains impossible corner pieces.');
  let parity = 0;
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (permutation[i] > permutation[j]) parity ^= 1;
  if (parity) {
    [text[5], text[7]] = [text[7], text[5]];
    [text[10], text[19]] = [text[19], text[10]];
  }
  return validateFacelets(text.join('')).normalized;
}

/**
 * Solve any legal 3×3 or 2×2 independently of history, in a dedicated Worker.
 * Larger cubes use a verified inverse of their recorded move history.
 * The result is validated on a cloned model before being returned to the UI.
 */
export async function solveCube(cube, { onProgress, signal, history } = {}) {
  if (!(cube instanceof CubeState)) throw new TypeError('solveCube expects a CubeState instance.');
  if (signal?.aborted) throw abortError();
  const started = performance.now();
  const state = cube.clone();
  if (state.isSolved()) return { moves: [], method: 'Already solved', elapsedMs: 0 };
  let result;
  if (state.size <= 3) {
    const facelets = solverFacelets(state);
    result = await enqueue('solve', facelets, { onProgress, signal });
    if (state.size === 2) result.method = 'Two-phase search on a corner embedding';
  } else {
    const recorded = history || state.history;
    if (!Array.isArray(recorded)) throw new Error('For 4×4–7×7, guided replay needs the move history. Start from Reset and scramble in the studio.');
    const replay = new CubeState(state.size).applyAlgorithm(recorded);
    if (replay.signature() !== state.signature()) throw new Error('The recorded moves do not match this cube. Reset and scramble to create a replayable state.');
    result = { moves: simplifyAlgorithm(invertAlgorithm(recorded)), method: 'Verified history reversal' };
  }
  const verification = state.clone().applyAlgorithm(result.moves);
  if (!verification.isSolved()) throw new Error('Solution verification failed. The cube has been left unchanged.');
  onProgress?.({ phase: 'complete', progress: 1, message: `Verified ${result.moves.length} moves.` });
  return { ...result, elapsedMs: performance.now() - started };
}

/** Exact shortest 3×3 cross in the half-turn metric (R2 counts as one turn). */
export async function solveCross(cube, { color = 'D', onProgress, signal } = {}) {
  if (!(cube instanceof CubeState) || cube.size !== 3) throw new Error('The cross planner is available for the 3×3 cube.');
  if (!FACES.includes(color)) throw new Error('Choose a valid cross color.');
  if (signal?.aborted) throw abortError();
  const started = performance.now();
  const state = cube.clone();
  const { normalized, centers } = validateFacelets(state.faceletString());
  const targetFace = FACES[centers.indexOf(color)];
  const result = await enqueue('cross', normalized, { onProgress, signal, targetFace });
  const verification = state.clone().applyAlgorithm(result.moves);
  if (!crossStatus(verification, color).solved) throw new Error('Cross solution verification failed. The cube is unchanged.');
  onProgress?.({ phase: 'complete', progress: 1, message: `Optimal cross: ${result.moves.length} ${result.moves.length === 1 ? 'turn' : 'turns'}.` });
  return { ...result, color, targetFace, elapsedMs: performance.now() - started };
}

/** Optional idle preparation; this never blocks the main UI thread. */
export function warmupSolver(options = {}) { return enqueue('warmup', null, options); }

export function disposeSolver() {
  const active = current;
  current = null;
  destroyWorker();
  if (active) finish(active, abortError());
  while (queue.length) finish(queue.shift(), abortError());
}
