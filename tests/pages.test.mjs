import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const DIST = new URL('../dist/', import.meta.url);
const ORIGIN = 'https://wieslawsoltes.github.io';
const swSource = await readFile(new URL('sw.js', DIST), 'utf8');
const keyFor = value => typeof value === 'string' ? value : value.url;

// Run the actual service worker with origin-wide in-memory CacheStorage.
// Browser-only event plumbing is replaced; its URL and Response semantics are real.
function worker(scopePath, storage = new Map()) {
  const scope = `${ORIGIN}${scopePath}`;
  const handlers = new Map();
  const installed = [];
  let skipped = false;
  let claimed = false;
  let network = async () => { throw new Error('Offline'); };
  let failWrites = false;
  const cacheStorage = {
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) {
            installed.push(url);
            entries.set(url, new Response(`cached:${url}`));
          }
        },
        async put(request, response) {
          if (failWrites) throw new Error('Storage quota exceeded');
          entries.set(keyFor(request), response.clone());
        },
        async match(request) { return entries.get(keyFor(request))?.clone(); },
      };
    },
    async keys() { return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); },
    async match() { throw new Error('Origin-wide cache reads are forbidden'); },
  };
  vm.runInNewContext(swSource, {
    URL, Response, caches: cacheStorage,
    fetch: request => network(request),
    self: {
      registration: { scope },
      location: new URL('sw.js', scope),
      addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
  }, { filename: 'dist/sw.js' });
  async function dispatch(type, request) {
    const lifetime = [];
    let response;
    handlers.get(type)({
      request,
      waitUntil: promise => lifetime.push(promise),
      respondWith: promise => { response = promise; },
    });
    const result = await response;
    while (lifetime.length) await Promise.all(lifetime.splice(0));
    return result;
  }
  return {
    scope, storage, installed,
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    request: (path, options = {}) => dispatch('fetch', {
      url: new URL(path, scope).href, method: 'GET', mode: 'cors', ...options,
    }),
    setNetwork: implementation => { network = implementation; },
    failCacheWrites: () => { failWrites = true; },
    get skipped() { return skipped; },
    get claimed() { return claimed; },
  };
}

test('offline install resolves every precache resource within root and project scopes', async () => {
  for (const scope of ['/', '/cubica/', '/nested/cubica/']) {
    const app = worker(scope);
    await app.install();
    assert.equal(app.skipped, true);
    assert.equal(new Set(app.installed).size, app.installed.length);
    for (const resource of app.installed) {
      assert.ok(resource.startsWith(app.scope), `${resource} escapes ${app.scope}`);
      const relative = resource.slice(app.scope.length) || 'index.html';
      assert.equal((await stat(new URL(relative, DIST))).isFile(), true, resource);
    }
    assert.ok(app.installed.includes(`${app.scope}modules/solver-worker.js`));
    assert.ok(app.installed.includes(`${app.scope}vendor/cubejs/solve.js`));
  }
});

test('activation and offline reads are isolated from sibling Pages projects', async () => {
  const storage = new Map();
  const app = worker('/cubica/', storage);
  const sibling = worker('/cubica-preview/', storage);
  await app.install();
  const current = [...storage.keys()][0];
  await sibling.install();
  const other = [...storage.keys()].find(name => name !== current);
  const obsolete = current.replace(/v\d+$/, 'v0');
  assert.notEqual(obsolete, current);
  storage.set(obsolete, new Map());
  storage.set('cubica-offline-v1', new Map());
  storage.set('unrelated-app', new Map());
  await app.activate();
  assert.equal(app.claimed, true);
  assert.equal(storage.has(obsolete), false);
  assert.deepEqual([...storage.keys()].sort(), [current, other, 'cubica-offline-v1', 'unrelated-app'].sort());

  const ownEntries = storage.get(current);
  ownEntries.delete(`${app.scope}app.js`);
  storage.get(other).set(`${app.scope}app.js`, new Response('foreign script'));
  assert.equal((await app.request('app.js')).type, 'error');
  assert.match(await (await sibling.request('app.js')).text(), /^cached:/);
});

test('offline navigation, modules, worker and solver vendor load from their scoped cache', async () => {
  const app = worker('/cubica/');
  await app.install();
  for (const path of ['./', 'index.html', 'app.js', 'modules/cube.js', 'modules/solver-worker.js', 'vendor/cubejs/cube.js', 'vendor/cubejs/solve.js']) {
    const response = await app.request(path, { mode: path === './' ? 'navigate' : 'cors' });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), `cached:${new URL(path, app.scope).href}`);
  }
  const entries = [...app.storage.values()][0];
  entries.delete(app.scope);
  assert.equal(await (await app.request('./', { mode: 'navigate' })).text(), `cached:${app.scope}index.html`);
  entries.delete(`${app.scope}index.html`);
  assert.equal((await app.request('./', { mode: 'navigate' })).type, 'error');
});

test('only this deployment’s known GET resources are intercepted', async () => {
  const app = worker('/cubica/');
  let requests = 0;
  app.setNetwork(async () => { requests++; return new Response('network'); });
  for (const path of ['/app.js', '/cubica-preview/app.js', 'missing.js', '__qa/check', 'https://example.com/cubica/app.js']) {
    assert.equal(await app.request(path), undefined, path);
  }
  assert.equal(await app.request('app.js', { method: 'POST' }), undefined);
  assert.equal(requests, 0);
});

test('query-bearing assets use canonical cache entries without accumulating variants', async () => {
  const app = worker('/cubica/');
  await app.install();
  assert.equal(await (await app.request('app.js?version=123')).text(), `cached:${app.scope}app.js`);
  app.setNetwork(async request => {
    assert.equal(request.url, `${app.scope}app.js?version=456`);
    return new Response('updated script');
  });
  assert.equal(await (await app.request('app.js?version=456')).text(), 'updated script');
  const entries = [...app.storage.values()][0];
  assert.equal(await entries.get(`${app.scope}app.js`).clone().text(), 'updated script');
  assert.equal([...entries.keys()].some(url => url.includes('?')), false);
});

test('network responses survive cache write failures and HTTP errors do not replace cached assets', async () => {
  const app = worker('/cubica/');
  await app.install();
  app.setNetwork(async () => new Response('Unavailable', { status: 503 }));
  assert.equal((await app.request('app.js')).status, 503);
  const entries = [...app.storage.values()][0];
  assert.equal(await entries.get(`${app.scope}app.js`).clone().text(), `cached:${app.scope}app.js`);
  app.failCacheWrites();
  app.setNetwork(async () => new Response('fresh script'));
  assert.equal(await (await app.request('app.js')).text(), 'fresh script');
});

test('entry point, module imports, workers and CSS resources stay inside /cubica/ without runtime CDNs', async () => {
  const app = worker('/cubica/');
  await app.install();
  const precache = new Set(app.installed);
  const visited = new Set();
  const pending = ['index.html'];
  async function resource(reference, parent) {
    if (reference.startsWith('#') || reference.startsWith('data:')) return;
    const url = new URL(reference, `${app.scope}${parent}`);
    assert.ok(url.href.startsWith(app.scope), `${parent} depends on out-of-scope resource ${reference}`);
    const relative = url.pathname.slice(new URL(app.scope).pathname.length);
    assert.equal((await stat(new URL(relative, DIST))).isFile(), true, reference);
    // The service worker uses canonical paths for both versioned and plain URLs.
    url.search = '';
    url.hash = '';
    if (relative !== 'sw.js') assert.ok(precache.has(url.href), `${relative} is missing from offline precache`);
    pending.push(relative);
  }
  while (pending.length) {
    const file = pending.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const source = await readFile(new URL(file, DIST), 'utf8');
    if (file.endsWith('.html')) {
      assert.doesNotMatch(source, /<iframe\b/i);
      for (const match of source.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)) await resource(match[1], file);
      for (const match of source.matchAll(/<script\s+type="importmap">([\s\S]*?)<\/script>/g)) {
        const map = JSON.parse(match[1]);
        for (const [specifier, reference] of Object.entries(map.imports)) {
          assert.equal(new URL(specifier, app.scope).pathname, new URL(reference, app.scope).pathname);
          assert.ok(new URL(reference, app.scope).searchParams.get('v'), 'Mapped UI modules carry a release version');
          await resource(reference, file);
        }
      }
    } else if (file.endsWith('.js')) {
      for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g)) await resource(match[1], file);
      for (const match of source.matchAll(/new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)) await resource(match[1], file);
      for (const call of source.matchAll(/\bimportScripts\(([^)]+)\)/g)) {
        for (const match of call[1].matchAll(/["']([^"']+)["']/g)) await resource(match[1], file);
      }
    } else if (file.endsWith('.css')) {
      for (const match of source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) await resource(match[1], file);
      assert.doesNotMatch(source, /@import\s+["']https?:/);
    }
  }
  assert.ok(visited.has('sw.js'), 'Service worker is resolved relative to the application');
  assert.ok(visited.has('modules/solver-worker.js'), 'Solver worker is included in the dependency graph');
  assert.ok(visited.has('vendor/cubejs/cube.js'));
  assert.ok(visited.has('vendor/cubejs/solve.js'));
  assert.equal((await readdir(fileURLToPath(new URL('../', DIST)))).includes('.openai'), false);
});
