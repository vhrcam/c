import { add, cross, mul, norm } from "../math";
import { COMMON } from "./glsl";
import { sampleSlices } from "./probe";

const vertex = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec3 aNormal;
attribute vec3 aInfo;
uniform float uDraw;
uniform float uAlpha;
uniform float uGain;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = (uT - aInfo.x) / uDraw;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  vec3 n = normalize(mat3(modelMatrix) * aNormal);
  float facing = dot(n, normalize(cameraPosition - world.xyz));
  vColor = fogged(shade(aColor, world.xyz, n, 1.0) * uGain, -mv.z);
  vAlpha = step(aInfo.y, g) * uAlpha * (0.35 + 0.65 * smoothstep(-0.2, 0.3, facing)) * (0.75 + aInfo.z * 0.25);
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const EDGES = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] };

function nearest(surf) {
  const { samples, colors } = surf;
  const cell = samples.diag / 40;
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < samples.n; i += 2) {
    const k = key(samples.pos[i * 3], samples.pos[i * 3 + 1], samples.pos[i * 3 + 2]);
    if (!grid.has(k)) grid.set(k, i);
  }
  return (p) => {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    const cz = Math.floor(p[2] / cell);
    let best = -1;
    let bd = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const i = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (i === undefined) continue;
          const d = (samples.pos[i * 3] - p[0]) ** 2 + (samples.pos[i * 3 + 1] - p[1]) ** 2 + (samples.pos[i * 3 + 2] - p[2]) ** 2;
          if (d < bd) [best, bd] = [i, d];
        }
    return best < 0 ? [0.8, 0.8, 0.8] : [colors[best * 3], colors[best * 3 + 1], colors[best * 3 + 2]];
  };
}

export function slices(ctx, form, surf, opts = {}) {
  const { THREE, U, W } = ctx;
  const { box } = form;
  const ext = [0, 1, 2].map((k) => box.max[k] - box.min[k]);
  const axisIndex = opts.axis ?? 1;
  const axis = [0, 0, 0];
  axis[axisIndex] = 1;
  const u = axisIndex === 1 ? [1, 0, 0] : [0, 1, 0];
  const v = norm(cross(axis, u));
  const center = box.min.map((m, k) => m + ext[k] / 2);
  const span = ext[axisIndex];
  const count = Math.round(opts.count ?? 70);
  const size = Math.max(...ext.filter((_, k) => k !== axisIndex)) * 1.15 + span * 0.02;
  const grid = opts.grid ?? 112;
  const frames = [];
  for (let i = 0; i < count; i++) {
    const h = -span / 2 + ((i + 0.5) / count) * span;
    frames.push({ o: add(center, mul(axis, h)), ext: size, u, v });
  }
  const fields = sampleSlices(ctx, form.glsl, frames, grid);
  const colorAt = nearest(surf);
  const pos = [];
  const col = [];
  const nrm = [];
  const info = [];
  const [b0, b1] = opts.window || [W.structure[0] + 0.4, W.form[1] - 1];
  fields.forEach((field, i) => {
    const fr = frames[i];
    const at = (x, y) => field[y * grid + x];
    const birth = b0 + (i / Math.max(1, count - 1)) * (b1 - b0 - 1);
    const to3 = (x, y) => add(fr.o, add(mul(u, (x / (grid - 1) - 0.5) * size), mul(v, (y / (grid - 1) - 0.5) * size)));
    for (let y = 0; y < grid - 1; y++)
      for (let x = 0; x < grid - 1; x++) {
        const a = at(x, y);
        const b = at(x + 1, y);
        const c = at(x + 1, y + 1);
        const d = at(x, y + 1);
        const idx = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const e = [
          [x + a / (a - b), y],
          [x + 1, y + b / (b - c)],
          [x + d / (d - c), y + 1],
          [x, y + a / (a - d)],
        ];
        const gx = (b + c - a - d) / 2;
        const gy = (d + c - a - b) / 2;
        const n2 = norm(add(mul(u, gx), mul(v, gy)));
        for (const [p, q] of EDGES[idx]) {
          for (const k of [p, q]) {
            const P = to3(e[k][0], e[k][1]);
            pos.push(...P);
            col.push(...colorAt(P));
            nrm.push(...n2);
            const ang = (Math.atan2(e[k][1] - grid / 2, e[k][0] - grid / 2) / (Math.PI * 2) + 0.5 + i * 0.13) % 1;
            info.push(birth, ang, i % 5 === 0 ? 1 : 0);
          }
        }
      }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(col), 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(new Float32Array(nrm), 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(info), 3));
  const object = new THREE.LineSegments(
    geometry,
    new THREE.ShaderMaterial({ uniforms: { ...U, uDraw: { value: opts.draw ?? 1.1 }, uAlpha: { value: opts.alpha ?? 0.8 }, uGain: { value: opts.gain ?? 1 } }, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false })
  );
  object.frustumCulled = false;
  object.renderOrder = 3;
  return { object, lines: pos.length / 6 };
}
