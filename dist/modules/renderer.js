/**
 * Cubica's dependency-free, demand-driven 3D renderer.
 *
 * The model remains authoritative: animateMove() previews a layer transform,
 * then its caller commits that move and calls setCube(). Rendering never mutates
 * the cube. Native WebGPU is preferred; the same camera and geometry drive an
 * explicitly reported Canvas 3D fallback when a GPU adapter is unavailable.
 */

const PALETTE = {
  U: '#f2eee5', R: '#ed655c', F: '#34b6a3',
  D: '#edc84d', L: '#f6a34c', B: '#5c8fe9',
};
const DARK_PALETTE = {
  U: '#f4f7fc', R: '#f46b64', F: '#2dcca4',
  D: '#f3d363', L: '#ffa755', B: '#6aa5ff',
};
const SELECTION = '#62dbf4';
const AFFECTED = '#c2ee81';
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const normalize = (v) => {
  const d = Math.hypot(...v) || 1;
  return [v[0] / d, v[1] / d, v[2] / d];
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const colorMap = palette => Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, rgb(value)]));
const THEMES = {
  light: { colors: colorMap(PALETTE), body: '#26312f', bodyRGB: rgb('#26312f'), shadow: [24, 48, 39] },
  dark: { colors: colorMap(DARK_PALETTE), body: '#1b2633', bodyRGB: rgb('#1b2633'), shadow: [3, 8, 15] },
};
const SELECTION_RGB = rgb(SELECTION), AFFECTED_RGB = rgb(AFFECTED);
const mixColor = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const IDENTITY_BASIS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function rotate(v, axis, angle) {
  if (!angle) return [...v];
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 0) return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  if (axis === 1) return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

function basisForNormal(n) {
  const v = Math.abs(n[1]) > 0.5 ? [0, 0, -Math.sign(n[1])] : [0, 1, 0];
  return [cross(v, n), v, [...n]];
}

function transform(basis, p) {
  return [0, 1, 2].map((i) => basis[0][i] * p[0] + basis[1][i] * p[1] + basis[2][i] * p[2]);
}

function matrix(basis, center, scale) {
  return [
    basis[0][0] * scale, basis[0][1] * scale, basis[0][2] * scale, 0,
    basis[1][0] * scale, basis[1][1] * scale, basis[1][2] * scale, 0,
    basis[2][0] * scale, basis[2][1] * scale, basis[2][2] * scale, 0,
    center[0] * scale, center[1] * scale, center[2] * scale, 1,
  ];
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
      + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

function lookAt(eye, target) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function perspective(fov, aspect, near = 0.1, far = 80) {
  const f = 1 / Math.tan(fov / 2);
  return new Float32Array([
    f / aspect, 0, 0, 0, 0, f, 0, 0,
    0, 0, far / (near - far), -1, 0, 0, near * far / (near - far), 0,
  ]);
}

function project(p, vp, width, height) {
  const x = p[0], y = p[1], z = p[2];
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  return [
    ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w * 0.5 + 0.5) * width,
    (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w * 0.5) * height,
    (vp[2] * x + vp[6] * y + vp[10] * z + vp[14]) / w,
  ];
}

function roundedPerimeter(half, radius, segments = 6, z = 0) {
  const points = [];
  const centers = [[half - radius, half - radius], [-half + radius, half - radius],
    [-half + radius, -half + radius], [half - radius, -half + radius]];
  for (let c = 0; c < 4; c++) for (let j = 0; j <= segments; j++) {
    const angle = (c + j / segments) * Math.PI / 2;
    points.push([centers[c][0] + Math.cos(angle) * radius,
      centers[c][1] + Math.sin(angle) * radius, z]);
  }
  return points;
}

function roundedBodyMesh() {
  const h = 0.484, r = 0.054;
  const knots = [-h, -h + r * 0.3, -h + r, h - r, h - r * 0.3, h];
  const vertices = [];
  const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const add = (p) => {
    const q = p.map((v) => clamp(v, -h + r, h - r));
    const n = normalize(sub(p, q));
    vertices.push(q[0] + n[0] * r, q[1] + n[1] * r, q[2] + n[2] * r, ...n);
  };
  for (const n of normals) {
    const basis = basisForNormal(n);
    for (let y = 0; y < knots.length - 1; y++) for (let x = 0; x < knots.length - 1; x++) {
      const a = transform(basis, [knots[x], knots[y], h]);
      const b = transform(basis, [knots[x + 1], knots[y], h]);
      const c = transform(basis, [knots[x + 1], knots[y + 1], h]);
      const d = transform(basis, [knots[x], knots[y + 1], h]);
      [a, b, c, a, c, d].forEach(add);
    }
  }
  return new Float32Array(vertices);
}

function stickerMesh() {
  const vertices = [], top = roundedPerimeter(0.446, 0.067, 6, 0.503);
  const bevel = roundedPerimeter(0.454, 0.075, 6, 0.491);
  const bottom = roundedPerimeter(0.454, 0.075, 6, 0.479);
  const add = (p, n) => vertices.push(...p, ...n);
  const sideNormal = (p, z = 0) => {
    const inner = 0.454 - 0.075;
    return normalize([p[0] - clamp(p[0], -inner, inner), p[1] - clamp(p[1], -inner, inner), z]);
  };
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    add([0, 0, 0.503], [0, 0, 1]); add(top[i], [0, 0, 1]); add(top[j], [0, 0, 1]);
    const ni = sideNormal(bevel[i], 0.095), nj = sideNormal(bevel[j], 0.095);
    add(bevel[i], ni); add(bevel[j], nj); add(top[j], nj);
    add(bevel[i], ni); add(top[j], nj); add(top[i], ni);
    const si = sideNormal(bevel[i]), sj = sideNormal(bevel[j]);
    add(bottom[i], si); add(bottom[j], sj); add(bevel[j], sj);
    add(bottom[i], si); add(bevel[j], sj); add(bevel[i], si);
  }
  return new Float32Array(vertices);
}

const MAIN_SHADER = /* wgsl */`
struct Camera {
  viewProjection: mat4x4<f32>,
  eye: vec4<f32>,
  settings: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: Camera;
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) m0: vec4<f32>,
  @location(3) m1: vec4<f32>,
  @location(4) m2: vec4<f32>,
  @location(5) m3: vec4<f32>,
  @location(6) color: vec4<f32>,
  @location(7) material: vec4<f32>,
};
struct VertexOutput {
  @builtin(position) clip: vec4<f32>,
  @location(0) world: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec4<f32>,
  @location(3) material: vec4<f32>,
  @location(4) local: vec3<f32>,
};
@vertex fn vs(input: VertexInput) -> VertexOutput {
  let model = mat4x4<f32>(input.m0, input.m1, input.m2, input.m3);
  let world = model * vec4<f32>(input.position, 1.0);
  var out: VertexOutput;
  out.clip = camera.viewProjection * world;
  out.world = world.xyz;
  out.normal = normalize((model * vec4<f32>(input.normal, 0.0)).xyz);
  out.color = input.color;
  out.material = input.material;
  out.local = input.position;
  return out;
}
@fragment fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
  let n = normalize(input.normal);
  let v = normalize(camera.eye.xyz - input.world);
  let l = normalize(vec3<f32>(-0.5, 1.6, 1.9));
  let fill = normalize(vec3<f32>(2.5, 0.8, -0.2));
  let h = normalize(l + v);
  let diffuse = mix(0.48, 0.54, camera.settings.z)
    + 0.37 * max(dot(n, l), 0.0) + 0.19 * max(dot(n, fill), 0.0);
  let hemisphere = 0.93 + 0.07 * n.y;
  let base = pow(input.color.rgb, vec3<f32>(2.2));
  let specular = pow(max(dot(n, h), 0.0), mix(65.0, 48.0, input.material.x));
  let edge = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  let shine = specular * mix(0.052, 0.035, input.material.x)
    + edge * 0.011 * (1.0 - input.material.x);
  let lighting = mix(vec3<f32>(1.0, 0.985, 0.95), vec3<f32>(0.92, 0.97, 1.0), camera.settings.z);
  var linear = (base * diffuse * hemisphere + lighting * shine) * input.material.w;
  let selected = input.material.y;
  let affected = input.material.z;
  // A rounded-square rim marks a piece without changing its sticker identity.
  // Local coordinates follow the animated instance, so the rim cannot detach
  // from the selected cubie during a turn, orbit, or exploded view.
  let q = abs(input.local.xy) - vec2<f32>(0.379);
  let distanceToEdge = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - 0.067;
  let rim = smoothstep(-0.035, -0.012, distanceToEdge)
    * max(selected, affected * 0.72) * input.material.x;
  let accent = mix(vec3<f32>(0.761, 0.933, 0.506), vec3<f32>(0.384, 0.859, 0.957),
    min(selected * 4.0, 1.0));
  linear = mix(linear, pow(accent, vec3<f32>(2.2)), rim);
  linear += pow(accent, vec3<f32>(2.2)) * max(selected * 0.075, affected * 0.025)
    * (1.0 - input.material.x);
  let srgb = pow(clamp(linear, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
  return vec4<f32>(srgb * input.color.a, input.color.a);
}`;

const SHADOW_SHADER = /* wgsl */`
struct Camera {
  viewProjection: mat4x4<f32>,
  eye: vec4<f32>,
  settings: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: Camera;
struct Out { @builtin(position) clip: vec4<f32>, @location(0) world: vec3<f32> };
@vertex fn vs(@location(0) position: vec3<f32>) -> Out {
  var out: Out;
  out.clip = camera.viewProjection * vec4<f32>(position, 1.0);
  out.world = position;
  return out;
}
@fragment fn fs(input: Out) -> @location(0) vec4<f32> {
  let p = (input.world.xz - vec2<f32>(0.15, -0.1)) / (1.0 + camera.settings.x * 0.3);
  let r = dot(p, p);
  let alpha = (exp(-r * 0.52) * 0.105 + exp(-r * 1.8) * 0.11)
    * (1.0 - camera.settings.y * 0.65) * mix(1.0, 1.7, camera.settings.z);
  let color = mix(vec3<f32>(0.13, 0.20, 0.18), vec3<f32>(0.012, 0.031, 0.059), camera.settings.z);
  return vec4<f32>(color * alpha, alpha);
}`;

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (((a[1] > y) !== (b[1] > y))
      && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
  }
  return inside;
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && turn(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Native WebGPU cube view, with a state-equivalent Canvas 3D fallback. */
export class CubeRenderer {
  constructor(canvas, { onBackend = () => {}, onPick = () => {}, onTurn = () => {}, theme = 'light' } = {}) {
    if (!canvas) throw new TypeError('CubeRenderer needs a canvas.');
    if (!Object.hasOwn(THEMES, theme)) throw new RangeError('Choose the light or dark cube theme.');
    this.canvas = canvas;
    this.onBackend = onBackend;
    this.onPick = onPick;
    this.onTurn = onTurn;
    this.backend = 'Starting';
    this.cube = null;
    this.highlight = null;
    this.hover = null;
    this.affectedPieces = new Set();
    this.dimUnrelatedPieces = false;
    this.theme = theme;
    this._appearance = THEMES[theme];
    if (canvas.dataset) canvas.dataset.rendererTheme = theme;
    this.xray = false;
    this.explode = 0;
    this.targetExplode = 0;
    this.yaw = this.targetYaw = 0.69;
    this.pitch = this.targetPitch = 0.51;
    this.distance = this.targetDistance = 8.4;
    this.eye = [5, 4, 6];
    this.width = this.height = 1;
    this.dpr = 1;
    this.pickFaces = [];
    this._listeners = [];
    this._pointers = new Map();
    this._frame = 0;
    this._disposed = false;
    this._ready = false;
    this._motion = null;
    this._cancelGeneration = 0;
    this._lastTime = 0;
    this.stats = { backend: 'Starting', drawCalls: 0, vertices: 0, lastFrameMs: 0 };
    this._resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this._resize()) : null;
    this._attachInput();
    this._resizeObserver?.observe(canvas);
  }

  async init() {
    if (this._ready) return this;
    try {
      if (!globalThis.navigator?.gpu) throw new Error('WebGPU is unavailable in this browser.');
      this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!this.adapter) throw new Error('A WebGPU adapter is unavailable.');
      this.device = await this.adapter.requestDevice();
      if (this._disposed) { this.device.destroy(); return this; }
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) throw new Error('The browser could not create a WebGPU canvas.');
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
      await this._createGpuResources();
      this.device.lost.then((info) => {
        if (!this._disposed && info.reason !== 'destroyed') this._fallback();
      });
      this.device.addEventListener?.('uncapturederror', (event) => {
        console.warn('Cube renderer GPU error:', event.error?.message || event.error);
        if (!this._disposed) this._fallback();
      });
      this.backend = 'WebGPU';
    } catch (error) {
      this.fallbackReason = error.message;
      this._fallback();
    }
    this._ready = true;
    this.stats.backend = this.backend;
    this.onBackend(this.backend);
    this._resize();
    this._request();
    return this;
  }

  async _createGpuResources() {
    const device = this.device;
    const makeBuffer = (data, usage) => {
      const buffer = device.createBuffer({ size: data.byteLength, usage, mappedAtCreation: true });
      new Float32Array(buffer.getMappedRange()).set(data);
      buffer.unmap();
      return buffer;
    };
    const body = roundedBodyMesh(), stickers = stickerMesh();
    this.bodyVertexCount = body.length / 6;
    this.stickerVertexCount = stickers.length / 6;
    this.bodyMesh = makeBuffer(body, GPUBufferUsage.VERTEX);
    this.stickerMesh = makeBuffer(stickers, GPUBufferUsage.VERTEX);
    this.shadowMesh = makeBuffer(new Float32Array([
      -4.8, -1.85, -4.8, -4.8, -1.85, 4.8, 4.8, -1.85, 4.8,
      -4.8, -1.85, -4.8, 4.8, -1.85, 4.8, 4.8, -1.85, -4.8,
    ]), GPUBufferUsage.VERTEX);
    this.cameraBuffer = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.cameraLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ] });
    this.cameraBinding = device.createBindGroup({ layout: this.cameraLayout,
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [this.cameraLayout] });
    const mainModule = device.createShaderModule({ label: 'Cubica studio material', code: MAIN_SHADER });
    const shadowModule = device.createShaderModule({ label: 'Cubica contact shadow', code: SHADOW_SHADER });
    const blend = {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    const descriptor = {
      layout,
      vertex: { module: mainModule, entryPoint: 'vs', buffers: [
        { arrayStride: 24, attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
        ] },
        { arrayStride: 96, stepMode: 'instance', attributes: [
          { shaderLocation: 2, offset: 0, format: 'float32x4' },
          { shaderLocation: 3, offset: 16, format: 'float32x4' },
          { shaderLocation: 4, offset: 32, format: 'float32x4' },
          { shaderLocation: 5, offset: 48, format: 'float32x4' },
          { shaderLocation: 6, offset: 64, format: 'float32x4' },
          { shaderLocation: 7, offset: 80, format: 'float32x4' },
        ] },
      ] },
      fragment: { module: mainModule, entryPoint: 'fs', targets: [{ format: this.format, blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: 4 },
    };
    this.solidPipeline = await device.createRenderPipelineAsync(descriptor);
    this.transparentPipeline = await device.createRenderPipelineAsync({ ...descriptor,
      depthStencil: { ...descriptor.depthStencil, depthWriteEnabled: false },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
    });
    this.shadowPipeline = await device.createRenderPipelineAsync({
      layout,
      vertex: { module: shadowModule, entryPoint: 'vs', buffers: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
      ] },
      fragment: { module: shadowModule, entryPoint: 'fs', targets: [{ format: this.format, blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
      multisample: { count: 4 },
    });
  }

  _fallback() {
    if (this._disposed || this.backend === 'Canvas 3D') return;
    this.device?.destroy();
    this.device = null;
    this.context = null;
    // A canvas cannot change context types after acquiring a GPU context.
    // Replace the element, preserving its id, CSS, accessibility, and dimensions.
    let context;
    try { context = this.canvas.getContext('2d'); } catch { /* context already bound */ }
    if (!context) {
      this._detachInput();
      this._resizeObserver?.unobserve(this.canvas);
      const replacement = this.canvas.cloneNode(false);
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      this._attachInput();
      this._resizeObserver?.observe(replacement);
      context = replacement.getContext('2d');
    }
    this.ctx = context;
    this.backend = 'Canvas 3D';
    this.stats.backend = this.backend;
    if (this._ready) this.onBackend(this.backend);
    this._request();
  }

  _resize() {
    if (this._disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width = rect.width;
    this.height = rect.height;
    const maxDim = this.device?.limits.maxTextureDimension2D || 8192;
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2,
      Math.sqrt(2_500_000 / (this.width * this.height)), maxDim / this.width, maxDim / this.height);
    const w = Math.max(1, Math.round(this.width * this.dpr)), h = Math.max(1, Math.round(this.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h || (this.device && !this.depthTexture)) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (this.device) {
        this.depthTexture?.destroy();
        this.colorTexture?.destroy();
        this.depthTexture = this.device.createTexture({ size: [w, h], format: 'depth24plus',
          sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        this.colorTexture = this.device.createTexture({ size: [w, h], format: this.format,
          sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      }
    }
    this._request();
  }

  setCube(cube) {
    this.cancelAnimation();
    this.cube = cube;
    this._request();
  }

  /** Cancel a visual preview without changing the authoritative cube model. */
  cancelAnimation() {
    this._cancelGeneration++;
    this._motion?.resolve?.(false);
    this._motion = null;
    this._request();
  }

  /**
   * Resolve true after the final visual frame, false when cancelled/reset.
   * Callers should serialize model commits and check this result before applying
   * a move; a reset during an animation must never reapply the obsolete move.
   */
  async animateMove(spec, duration = 280) {
    if (this._disposed || !this.cube) return false;
    const generation = this._cancelGeneration;
    if (this._motion && !this._motion.done) await this._motion.promise;
    if (this._disposed || generation !== this._cancelGeneration) return false;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const milliseconds = reduced ? 0 : Math.max(0, duration);
    if (!milliseconds) return true;
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    this._motion = { spec, start: performance.now(), duration: milliseconds,
      progress: milliseconds ? 0 : 1, resolve, promise, done: false };
    this._request();
    return promise;
  }

  resetView() {
    this.targetYaw = 0.69;
    this.targetPitch = 0.51;
    this.targetDistance = 8.4;
    this._request();
  }

  setExploded(value) {
    this.targetExplode = typeof value === 'number' ? clamp(value, 0, 2) : value ? 1 : 0;
    this._request();
  }

  setXray(value) { this.xray = Boolean(value); this._request(); }
  setHighlight(pieceId) {
    const next = pieceId ?? null;
    if (this.highlight === next) return;
    this.highlight = next;
    this._request();
  }

  /**
   * Change lighting and contrast without rebuilding meshes or pipelines.
   * Both backends remain transparent so the host controls the stage background.
   */
  setTheme(theme) {
    if (!Object.hasOwn(THEMES, theme)) throw new RangeError('Choose the light or dark cube theme.');
    if (theme === this.theme) return;
    this.theme = theme;
    this._appearance = THEMES[theme];
    if (this.canvas.dataset) this.canvas.dataset.rendererTheme = theme;
    this._request();
  }

  /**
   * Mark a move's affected pieces in lime; an explicit selection remains cyan.
   * Pass null or an empty iterable to clear. Dimming never hides sticker colors
   * or changes picking. Reapplying the same focus does not schedule a frame.
   */
  setAffectedPieces(pieceIds, { dimOthers = false } = {}) {
    const next = new Set(typeof pieceIds === 'string' ? [pieceIds] : pieceIds ?? []);
    const dim = Boolean(dimOthers) && next.size > 0;
    if (dim === this.dimUnrelatedPieces && next.size === this.affectedPieces.size
      && [...next].every(id => this.affectedPieces.has(id))) return;
    this.affectedPieces = next;
    this.dimUnrelatedPieces = dim;
    this._request();
  }

  /** Orbit to a cubie's current visible surfaces, keeping zoom and cube state. */
  focusPiece(pieceId) {
    const piece = this.cube?.cubies.find(cubie => cubie.id === pieceId);
    if (!piece?.stickers?.length) return false;
    const outward = normalize(piece.stickers.reduce((sum, sticker) =>
      sum.map((value, axis) => value + sticker.normal[axis]), [0, 0, 0]));
    // At a pole, retain yaw and slightly incline the view to keep orbit stable.
    if (Math.hypot(outward[0], outward[2]) > 0.001) {
      const yaw = Math.atan2(outward[0], outward[2]);
      this.targetYaw = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    }
    this.targetPitch = clamp(Math.atan2(outward[1], Math.hypot(outward[0], outward[2])), -1.25, 1.25);
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    }
    this._request();
    return true;
  }

  _request() {
    if (!this._frame && !this._disposed) this._frame = requestAnimationFrame((time) => this._render(time));
  }

  _render(time) {
    this._frame = 0;
    if (this._disposed || !this._ready || !this.cube || !this.width || !this.height) return;
    const started = performance.now();
    const dt = Math.min(50, this._lastTime ? time - this._lastTime : 16.67);
    this._lastTime = time;
    const easing = 1 - Math.exp(-dt / 65);
    let active = false;
    for (const [current, target] of [['yaw', 'targetYaw'], ['pitch', 'targetPitch'],
      ['distance', 'targetDistance'], ['explode', 'targetExplode']]) {
      const delta = this[target] - this[current];
      if (Math.abs(delta) > 0.0001) { this[current] += delta * easing; active = true; }
      else this[current] = this[target];
    }
    const motion = this._motion;
    if (motion && !motion.done) {
      const t = motion.duration ? clamp((time - motion.start) / motion.duration, 0, 1) : 1;
      motion.progress = t * t * (3 - 2 * t);
      active ||= t < 1;
      if (t === 1) motion.done = true;
    }
    const aspect = this.width / this.height;
    const dist = this.distance * Math.max(1, 0.96 / aspect) * (1 + this.explode * 0.15);
    this.eye = [Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
      Math.sin(this.pitch) * dist, Math.cos(this.yaw) * Math.cos(this.pitch) * dist];
    this.viewProjection = multiply(perspective(38 * Math.PI / 180, aspect), lookAt(this.eye, [0, -0.06, 0]));
    this._buildScene();
    try {
      if (this.backend === 'WebGPU' && this.device && this.depthTexture) this._drawGpu();
      else if (this.ctx) this._drawCanvas();
    } catch (error) {
      this.fallbackReason = error.message;
      this._fallback();
      this._drawCanvas();
    }
    this.stats.lastFrameMs = performance.now() - started;
    if (motion?.done && motion.resolve) {
      const done = motion.resolve;
      motion.resolve = null;
      done(true);
    }
    if (active) this._request();
  }

  _buildScene() {
    const bodies = [], stickers = [], scene = [];
    const scale = 3 / this.cube.size;
    const motion = this._motion;
    const spec = motion?.spec;
    this.pickFaces = [];
    for (const cubie of this.cube.cubies) {
      if (!cubie.stickers?.length) continue;
      const moving = spec && spec.layers.some((p) => Math.abs(p - cubie.position[spec.axis]) < 0.01);
      const angle = moving ? spec.turns * Math.PI / 2 * motion.progress : 0;
      const axis = spec?.axis ?? 0;
      const center = rotate(cubie.position.map((v) => v * (1 + this.explode * 0.42)), axis, angle);
      const worldCenter = center.map((v) => v * scale);
      const baseBasis = IDENTITY_BASIS.map((v) => rotate(v, axis, angle));
      const selected = this.highlight === cubie.id ? 1 : this.hover === cubie.id ? 0.35 : 0;
      const affected = this.affectedPieces.has(cubie.id) ? 1 : 0;
      const focusGain = this.dimUnrelatedPieces && !affected && !selected ? 0.42 : 1;
      const bodyColor = mixColor(this._appearance.bodyRGB, selected ? SELECTION_RGB : AFFECTED_RGB,
        selected ? selected * 0.34 : affected * 0.14);
      bodies.push({ data: [...matrix(baseBasis, center, scale), ...bodyColor,
        this.xray ? 0.09 : 1, 0, selected, affected, focusGain], center: worldCenter });
      const item = { cubie, center, scale, basis: baseBasis, selected, affected, focusGain,
        bodyColor, stickers: [], worldCenter };
      for (const sticker of cubie.stickers) {
        const basis = basisForNormal(sticker.normal).map((v) => rotate(v, axis, angle));
        const color = this._appearance.colors[sticker.color] || this._appearance.colors.U;
        const stickerCenter = center.map((v, i) => (v + basis[2][i] * 0.503) * scale);
        stickers.push({ data: [...matrix(basis, center, scale), ...color,
          this.xray ? 0.64 : 1, 1, selected, affected, focusGain], center: stickerCenter });
        item.stickers.push({ sticker, basis, color });
        if (dot(basis[2], sub(this.eye, stickerCenter)) > 0) {
          const quad = [[-0.46, -0.46, 0.507], [0.46, -0.46, 0.507],
            [0.46, 0.46, 0.507], [-0.46, 0.46, 0.507]].map((p) => {
            const q = transform(basis, p).map((v, i) => (v + center[i]) * scale);
            return project(q, this.viewProjection, this.width, this.height);
          });
          this.pickFaces.push({ cubie, normal: sticker.normal, basis, center: stickerCenter,
            polygon: quad, depth: quad.reduce((sum, p) => sum + p[2], 0) / 4 });
        }
      }
      scene.push(item);
    }
    const depth = (item) => dot(sub(item.center, this.eye), sub(item.center, this.eye));
    if (this.xray) { bodies.sort((a, b) => depth(b) - depth(a)); stickers.sort((a, b) => depth(b) - depth(a)); }
    this.bodyInstances = new Float32Array(bodies.flatMap((item) => item.data));
    this.stickerInstances = new Float32Array(stickers.flatMap((item) => item.data));
    this.bodyCount = bodies.length;
    this.stickerCount = stickers.length;
    this.scene = scene;
    this.pickFaces.sort((a, b) => a.depth - b.depth);
  }

  _uploadInstances(name, array) {
    const capacity = `${name}Capacity`, key = `${name}Buffer`;
    if (!this[key] || this[capacity] < array.byteLength) {
      this[key]?.destroy();
      this[capacity] = Math.max(256, 2 ** Math.ceil(Math.log2(array.byteLength || 1)));
      this[key] = this.device.createBuffer({ size: this[capacity],
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }
    if (array.byteLength) this.device.queue.writeBuffer(this[key], 0, array);
    return this[key];
  }

  _drawGpu() {
    const camera = new Float32Array(24);
    camera.set(this.viewProjection);
    camera.set([...this.eye, 1], 16);
    camera.set([this.explode, this.xray ? 1 : 0, this.theme === 'dark' ? 1 : 0, 0], 20);
    this.device.queue.writeBuffer(this.cameraBuffer, 0, camera);
    const bodyBuffer = this._uploadInstances('bodyInstance', this.bodyInstances);
    const stickerBuffer = this._uploadInstances('stickerInstance', this.stickerInstances);
    const encoder = this.device.createCommandEncoder({ label: 'Cubica frame' });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.colorTexture.createView(),
        resolveTarget: this.context.getCurrentTexture().createView(),
        loadOp: 'clear', storeOp: 'discard', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
      depthStencilAttachment: { view: this.depthTexture.createView(),
        depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setBindGroup(0, this.cameraBinding);
    pass.setPipeline(this.shadowPipeline);
    pass.setVertexBuffer(0, this.shadowMesh);
    pass.draw(6);
    pass.setPipeline(this.xray ? this.transparentPipeline : this.solidPipeline);
    pass.setVertexBuffer(0, this.bodyMesh);
    pass.setVertexBuffer(1, bodyBuffer);
    pass.draw(this.bodyVertexCount, this.bodyCount);
    pass.setVertexBuffer(0, this.stickerMesh);
    pass.setVertexBuffer(1, stickerBuffer);
    pass.draw(this.stickerVertexCount, this.stickerCount);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.stats.drawCalls = 3;
    this.stats.vertices = 6 + this.bodyVertexCount * this.bodyCount + this.stickerVertexCount * this.stickerCount;
  }

  _drawCanvas() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const shadow = project([0.15, -1.85, 0], this.viewProjection, this.width, this.height);
    const shadowR = Math.min(this.width, this.height) * 0.32 * 8.4 / this.distance;
    ctx.save();
    ctx.translate(shadow[0], shadow[1]);
    ctx.scale(1, 0.32);
    const gradient = ctx.createRadialGradient(0, 0, shadowR * 0.12, 0, 0, shadowR);
    const shadowColor = this._appearance.shadow.join(',');
    gradient.addColorStop(0, `rgba(${shadowColor},${(this.xray ? 0.075 : 0.22) * (this.theme === 'dark' ? 1.7 : 1)})`);
    gradient.addColorStop(1, `rgba(${shadowColor},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-shadowR, -shadowR, shadowR * 2, shadowR * 2);
    ctx.restore();
    const projectLocal = (item, p, basis = item.basis) => {
      const q = transform(basis, p).map((v, i) => (v + item.center[i]) * item.scale);
      return project(q, this.viewProjection, this.width, this.height);
    };
    const path = (points) => {
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath();
    };
    const light = normalize([-0.5, 1.6, 1.9]), fill = normalize([2.5, 0.8, -0.2]);
    const shade = (color, n, gain = 1) => {
      const ambient = this.theme === 'dark' ? 0.81 : 0.76;
      const amount = (ambient + 0.16 * Math.max(0, dot(n, light)) + 0.11 * Math.max(0, dot(n, fill))) * gain;
      return `rgb(${color.map((v) => Math.round(clamp(v * amount, 0, 1) * 255)).join(',')})`;
    };
    const bodyNormals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const sorted = [...this.scene].sort((a, b) =>
      dot(sub(b.worldCenter, this.eye), sub(b.worldCenter, this.eye))
      - dot(sub(a.worldCenter, this.eye), sub(a.worldCenter, this.eye)));
    for (const item of sorted) {
      ctx.globalAlpha = this.xray ? 0.075 : 1;
      const corners = [];
      for (const x of [-0.48, 0.48]) for (const y of [-0.48, 0.48]) for (const z of [-0.48, 0.48]) {
        corners.push(projectLocal(item, [x, y, z]));
      }
      path(convexHull(corners));
      const focusGain = Math.pow(item.focusGain, 1 / 2.2);
      ctx.fillStyle = shade(item.bodyColor, [0, 0, 0], focusGain);
      ctx.fill();
      for (const n of bodyNormals) {
        const normal = transform(item.basis, n);
        if (dot(normal, sub(this.eye, item.worldCenter)) <= 0) continue;
        const basis = basisForNormal(n).map((v) => transform(item.basis, v));
        path(roundedPerimeter(0.483, 0.042, 4, 0.484).map((p) => projectLocal(item, p, basis)));
        ctx.fillStyle = shade(item.bodyColor, normal, focusGain);
        ctx.fill();
      }
      ctx.globalAlpha = this.xray ? 0.65 : 1;
      for (const face of item.stickers) {
        const n = face.basis[2];
        if (dot(n, sub(this.eye, item.worldCenter)) <= 0) continue;
        const outer = roundedPerimeter(0.455, 0.075, 6, 0.494).map((p) => projectLocal(item, p, face.basis));
        path(outer);
        ctx.fillStyle = shade(face.color, n, 0.78 * focusGain);
        ctx.fill();
        const points = roundedPerimeter(0.446, 0.067, 6, 0.504).map((p) => projectLocal(item, p, face.basis));
        const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
        const fillGradient = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
        fillGradient.addColorStop(0, shade(face.color, n, 1.055 * focusGain));
        fillGradient.addColorStop(1, shade(face.color, n, 0.97 * focusGain));
        path(points);
        ctx.fillStyle = fillGradient;
        ctx.fill();
        ctx.strokeStyle = item.selected ? `rgba(98,219,244,${Math.max(0.45, item.selected)})`
          : item.affected ? AFFECTED : 'rgba(255,255,255,.14)';
        ctx.lineWidth = item.selected ? 1 + item.selected * 1.2 : item.affected ? 1.4 : 0.55;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    this.stats.drawCalls = 0;
    this.stats.vertices = 0;
  }

  _hit(x, y) { return this.pickFaces.find((face) => insidePolygon(x, y, face.polygon)) || null; }

  _faceName(normal) {
    const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    return [['L', 'R'], ['D', 'U'], ['B', 'F']][axis][normal[axis] > 0 ? 1 : 0];
  }

  _dragTurn(hit, dx, dy) {
    if (!hit || Math.hypot(dx, dy) < 12 || this._motion) return;
    // Lift a screen drag to the touched sticker plane, then infer its layer axis.
    const c = project(hit.center, this.viewProjection, this.width, this.height);
    const uv = hit.basis.slice(0, 2).map((v) => {
      const p = project(hit.center.map((n, i) => n + v[i]), this.viewProjection, this.width, this.height);
      return [p[0] - c[0], p[1] - c[1]];
    });
    const determinant = uv[0][0] * uv[1][1] - uv[1][0] * uv[0][1];
    if (Math.abs(determinant) < 0.01) return;
    const u = (dx * uv[1][1] - dy * uv[1][0]) / determinant;
    const v = (dy * uv[0][0] - dx * uv[0][1]) / determinant;
    const tangent = hit.basis[0].map((p, i) => p * u + hit.basis[1][i] * v);
    const rotationAxis = cross(hit.normal, tangent);
    const axis = rotationAxis.map(Math.abs).indexOf(Math.max(...rotationAxis.map(Math.abs)));
    const direction = Math.sign(rotationAxis[axis]);
    const layer = hit.cubie.position[axis], half = (this.cube.size - 1) / 2;
    let token, clockwise;
    if (Math.abs(layer - half) < 0.01) { token = ['R', 'U', 'F'][axis]; clockwise = -1; }
    else if (Math.abs(layer + half) < 0.01) { token = ['L', 'D', 'B'][axis]; clockwise = 1; }
    else if (Math.abs(layer) < 0.01 && this.cube.size % 2) {
      token = ['M', 'E', 'S'][axis]; clockwise = axis === 2 ? -1 : 1;
    } else return;
    this.onTurn(token + (direction === clockwise ? '' : "'"));
  }

  _attachInput() {
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    const listen = (event, fn, options) => {
      canvas.addEventListener(event, fn, options);
      this._listeners.push([canvas, event, fn, options]);
    };
    const local = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };
    listen('pointerdown', (event) => {
      if (event.button !== 0 && event.button !== 1) return;
      const [x, y] = local(event);
      this._pointers.set(event.pointerId, { x, y });
      canvas.setPointerCapture?.(event.pointerId);
      if (this._pointers.size === 2) {
        const p = [...this._pointers.values()];
        this._pinch = { distance: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), camera: this.targetDistance };
        this._drag = null;
      } else if (this._pointers.size === 1) {
        this._drag = { id: event.pointerId, x, y, lastX: x, lastY: y,
          shift: event.shiftKey, hit: this._hit(x, y), moved: false };
      }
      canvas.style.cursor = event.shiftKey ? 'crosshair' : 'grabbing';
    });
    listen('pointermove', (event) => {
      const [x, y] = local(event);
      if (this._pointers.has(event.pointerId)) this._pointers.set(event.pointerId, { x, y });
      if (this._pointers.size === 2 && this._pinch) {
        const p = [...this._pointers.values()];
        const distance = Math.max(10, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y));
        this.targetDistance = clamp(this._pinch.camera * this._pinch.distance / distance, 5.2, 17);
        this._request();
      } else if (this._drag && this._drag.id === event.pointerId) {
        const drag = this._drag;
        drag.moved ||= Math.hypot(x - drag.x, y - drag.y) > 5;
        if (!drag.shift) {
          this.targetYaw -= (x - drag.lastX) * 0.008;
          this.targetPitch = clamp(this.targetPitch + (y - drag.lastY) * 0.008, -1.35, 1.35);
          this._request();
        }
        drag.lastX = x; drag.lastY = y;
      } else if (!this._pointers.size) {
        const hover = this._hit(x, y)?.cubie.id ?? null;
        if (hover !== this.hover) { this.hover = hover; this._request(); }
        canvas.style.cursor = event.shiftKey && hover ? 'crosshair' : 'grab';
      }
    });
    const release = (event, cancelled = false) => {
      const drag = this._drag;
      this._pointers.delete(event.pointerId);
      if (drag?.id === event.pointerId && !cancelled) {
        const [x, y] = local(event);
        if (drag.shift && drag.moved) this._dragTurn(drag.hit, x - drag.x, y - drag.y);
        else if (!drag.moved && drag.hit) {
          this.onPick(drag.hit.cubie.id);
          if (drag.shift && !this._motion) this.onTurn(this._faceName(drag.hit.normal) + "'");
        }
      }
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      this._drag = null;
      if (this._pointers.size < 2) this._pinch = null;
      canvas.style.cursor = 'grab';
    };
    listen('pointerup', (event) => release(event));
    listen('pointercancel', (event) => release(event, true));
    listen('pointerleave', () => {
      if (!this._drag && this.hover !== null) { this.hover = null; this._request(); }
    });
    listen('dblclick', (event) => {
      event.preventDefault();
      if (event.shiftKey || this._motion) return;
      const [x, y] = local(event), hit = this._hit(x, y);
      if (hit) this.onTurn(this._faceName(hit.normal));
    });
    listen('wheel', (event) => {
      event.preventDefault();
      this.targetDistance = clamp(this.targetDistance * Math.exp(clamp(event.deltaY, -200, 200) * 0.0015), 5.2, 17);
      this._request();
    }, { passive: false });
    listen('contextmenu', (event) => event.preventDefault());
  }

  _detachInput() {
    for (const [target, event, fn, options] of this._listeners) target.removeEventListener(event, fn, options);
    this._listeners = [];
    this._pointers.clear();
    this._drag = null;
    this._pinch = null;
  }

  dispose() {
    this._disposed = true;
    if (this._frame) cancelAnimationFrame(this._frame);
    this._motion?.resolve?.(false);
    this._motion = null;
    this._detachInput();
    this._resizeObserver?.disconnect();
    this.device?.destroy();
    this.device = null;
  }
}
