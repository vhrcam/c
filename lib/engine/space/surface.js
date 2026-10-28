import { EdgesGeometry, Vector3 } from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { COMMON } from "./glsl";
import { lineSystem } from "./slices";

const vertex = /* glsl */ `
${COMMON}
attribute vec3 color;
attribute float glow;
attribute float delay;
attribute float facade;
uniform vec3 uFrom;
uniform vec3 uSpan;
uniform vec2 uWindow;
uniform float uRadial;
uniform vec2 uFade;
uniform vec3 uFadeAt;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vGlow;
varying float vReveal;
varying float vDepth;
varying float vFacade;
varying float vEdge;
void main() {
  vFacade = facade;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vEdge = uFade.y > 0.0 ? smoothstep(uFade.x, uFade.y, length(world.xz - uFadeAt.xz)) : 0.0;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColor = color;
  vGlow = glow;
  float along = uRadial > 0.0 ? clamp(length(position.xz - uFrom.xz) / uRadial, 0.0, 1.0) : clamp(dot(position - uFrom, uSpan) / dot(uSpan, uSpan), 0.0, 1.0);
  vReveal = (uT - mix(uWindow.x, uWindow.y, along) - delay) / 1.6;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
${COMMON}
uniform float uGrain;
uniform float uGlowOn;
uniform float uKeep;
uniform float uTexture;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vGlow;
varying float vReveal;
varying float vDepth;
varying float vFacade;
varying float vEdge;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 cell = floor(vWorld * uGrain);
  float g = h3(cell);
  if (vReveal < g * 0.85 + 0.05) discard;
  if (vEdge > 0.0 && h3(cell + 5.0) < vEdge * vEdge) discard;
  vec3 n = normalize(gl_FrontFacing ? vNormal : -vNormal);
  vec3 base = vColor;
  float glass = 0.0;
  if (vFacade > 0.5 && abs(n.y) < 0.3) {
    vec2 f = vec2(dot(vWorld.xz, normalize(vec2(-n.z, n.x))), vWorld.y);
    vec2 cellW = vec2(2.4, 3.4);
    vec2 g = fract(f / cellW);
    float win = step(0.18, g.x) * step(g.x, 0.82) * step(0.28, g.y) * step(g.y, 0.86) * step(2.5, vWorld.y);
    glass = win;
    base = mix(base, vec3(0.16, 0.2, 0.26) + base * 0.15, win);
  }
  vec3 lit = mix(shade(base, vWorld, n, 1.0), base * mix(0.55, 1.0, uLight), uKeep);
  if (glass > 0.5) {
    vec3 id = floor(vec3(dot(vWorld.xz, normalize(vec2(-n.z, n.x))) / 2.4, vWorld.y / 3.4, n.x * 7.0 + n.z * 13.0));
    float on = step(0.45, h3(id + 3.0));
    lit += vec3(1.0, 0.82, 0.55) * on * uGlowOn * 1.2 + vec3(0.1, 0.12, 0.16) * (1.0 - uDark) * 0.6;
  }
  lit *= 1.0 - uTexture * 0.5 + uTexture * h3(cell + 17.0);
  lit += vColor * vGlow * uGlowOn * (0.9 + 0.3 * h3(floor(vWorld * 0.7)));
  gl_FragColor = vec4(mix(fogged(lit, vDepth), uBg, vEdge * 0.85), 1.0);
}
`;

export function surfaceSystem(ctx, geometry, opts = {}) {
  const { THREE, U, W } = ctx;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const from = opts.from || new Vector3(box.min.x, box.min.y, box.min.z);
  const span = opts.span || new Vector3(0, box.max.y - box.min.y || 1, 0);
  if (!geometry.getAttribute("glow")) geometry.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count), 1));
  if (!geometry.getAttribute("color")) geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 3).fill(0.8), 3));
  if (!geometry.getAttribute("delay")) geometry.setAttribute("delay", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count), 1));
  if (!geometry.getAttribute("facade")) geometry.setAttribute("facade", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count), 1));
  const size = box.getSize(new Vector3()).length();
  const uGlowOn = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uFrom: { value: from },
      uSpan: { value: span },
      uWindow: { value: new THREE.Vector2(...(opts.window || [W.form[0] + 1.5, W.detail[1] - 1.5])) },
      uRadial: { value: opts.radial ?? 0 },
      uFade: { value: new THREE.Vector2(...(opts.fade || [0, 0])) },
      uFadeAt: { value: opts.fadeAt || from },
      uGrain: { value: opts.grain ?? 160 / Math.max(0.05, size) },
      uGlowOn,
      uKeep: { value: opts.keep ?? 0 },
      uTexture: { value: opts.texture ?? 0.28 },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    object: mesh,
    update: (T) => {
      uGlowOn.value = Math.min(1, Math.max(0, (T - W.light[0] - 0.5) / 3)) * (ctx.pal.night ? 1 : 0.25);
    },
  };
}

export function edgeSystem(ctx, geometry, opts = {}) {
  const { W, pal } = ctx;
  const edges = new EdgesGeometry(geometry, opts.angle ?? 24);
  const p = edges.getAttribute("position").array;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const lo = box.min.y;
  const hi = box.max.y || 1;
  const [w0, w1] = opts.window || [W.structure[0] + 0.3, W.form[0] + 3];
  const ink = opts.color || pal.ink;
  const pos = [];
  const col = [];
  const nrm = [];
  const info = [];
  const center = opts.center;
  for (let i = 0; i < p.length; i += 6) {
    const y = Math.min(p[i + 1], p[i + 4]);
    const spread = center ? (Math.hypot(p[i] - center[0], p[i + 2] - center[1]) / opts.reach) * opts.spread : 0;
    const birth = w0 + spread + ((y - lo) / Math.max(1e-3, hi - lo)) * (w1 - w0) * (center ? 0.4 : 1) + ((i * 0.618) % 1) * 0.6;
    for (const k of [0, 3]) {
      pos.push(p[i + k], p[i + k + 1], p[i + k + 2]);
      col.push(...ink);
      nrm.push(0, 1, 0);
      info.push(birth, k ? 1 : 0, 1);
    }
  }
  edges.dispose();
  return lineSystem(ctx, { pos, col, nrm, info }, { alpha: opts.alpha ?? 0.55, gain: opts.gain ?? 1, draw: 0.9, bias: 0 });
}

export function sampleMesh(geometry, count, rand) {
  const mesh = { geometry, isMesh: true, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };
  const sampler = new MeshSurfaceSampler(mesh).setRandomGenerator(rand).build();
  const p = new Vector3();
  const n = new Vector3();
  const c = { r: 1, g: 1, b: 1 };
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const hasColor = Boolean(geometry.getAttribute("color"));
  for (let i = 0; i < count; i++) {
    if (hasColor) sampler.sample(p, n, c);
    else sampler.sample(p, n);
    pos.set([p.x, p.y, p.z], i * 3);
    nrm.set([n.x, n.y, n.z], i * 3);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.computeBoundingBox();
  const diag = geometry.boundingBox.getSize(new Vector3()).length();
  return { samples: { n: count, pos, nrm, ao: new Float32Array(count).fill(1), part: new Float32Array(count), diag }, colors };
}
