import { random } from "../../random";
import { noise3 } from "../noise";
import { rgb } from "../palette";
import { COMMON } from "./glsl";

export const LOOK = {
  ground: { amp: 0.25, freq: 0.06, color: ["#7d8661", "#9aa076"], night: ["#33382f", "#424838"] },
  meadow: { amp: 0.5, freq: 0.06, color: ["#6f8a4c", "#a3b46a"], night: ["#2d3a2f", "#3f4d3a"] },
  forest: { amp: 0.7, freq: 0.05, color: ["#4c4a34", "#6b5f3e"], night: ["#25261f", "#33332a"] },
  snowfield: { amp: 0.9, freq: 0.045, color: ["#e9edf1", "#cfd8e2"], night: ["#9aa6b8", "#c5cfdd"] },
  city: { amp: 0, freq: 0.1, color: ["#56585c", "#6c6d70"], night: ["#2b2c30", "#38393e"] },
  desert: { amp: 1.4, freq: 0.035, color: ["#d9b98a", "#c9a06a"], night: ["#5a4c3e", "#6b5a48"] },
  mountains: { amp: 7, freq: 0.022, color: ["#7d7a73", "#a9a49a"], night: ["#3b3c42", "#55565e"] },
};

const vertex = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec2 aInfo;
uniform float uSize;
uniform vec3 uFocus;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = easeOut((uT - aInfo.x) / 1.4);
  if (g <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  vec3 p = position - vec3(0.0, (1.0 - g) * aInfo.y, 0.0);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 lit = shade(aColor, p, vec3(0.0, 1.0, 0.0), 1.0);
  vColor = fogged(lit, -mv.z);
  vAlpha = g;
  gl_PointSize = clamp(uSize * uScale / -mv.z, 1.0, 5.0);
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25 || vAlpha < 0.02) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const lineVertex = /* glsl */ `
${COMMON}
attribute float aBirth;
uniform vec3 uColor;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float g = smoothstep(0.0, 1.0, (uT - aBirth) / 1.2);
  vColor = fogged(shade(uColor, position, vec3(0.0, 1.0, 0.0), 1.0), -mv.z);
  vAlpha = g;
}
`;

const lineFragment = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha * uOpacity);
}
`;

export function terrain(plan, seed) {
  const look = LOOK[plan.world.setting] || LOOK.ground;
  const n = noise3(seed);
  return (x, z, flat = 2) => {
    const d = Math.hypot(x, z);
    const keep = Math.min(1, Math.max(0, (d - flat) / (flat * 2.5)));
    const ridge = plan.world.setting === "mountains" ? 1 - Math.abs(n(x * look.freq, 0.5, z * look.freq, 4)) * 2 : n(x * look.freq, 0.5, z * look.freq, 3);
    return look.amp * ridge * keep * keep;
  };
}

export function marching(field, nx, nz, x0, z0, step, level, out, y) {
  const at = (i, k) => field[k * nx + i];
  for (let k = 0; k < nz - 1; k++)
    for (let i = 0; i < nx - 1; i++) {
      const a = at(i, k) - level;
      const b = at(i + 1, k) - level;
      const c = at(i + 1, k + 1) - level;
      const d = at(i, k + 1) - level;
      const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const X = x0 + i * step;
      const Z = z0 + k * step;
      const e = [
        [X + step * (a / (a - b)), Z],
        [X + step, Z + step * (b / (b - c))],
        [X + step * (d / (d - c)), Z + step],
        [X, Z + step * (a / (a - d))],
      ];
      const segs = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] }[idx];
      for (const [p, q] of segs) out.push([e[p][0], y(e[p][0], e[p][1]), e[p][1]], [e[q][0], y(e[q][0], e[q][1]), e[q][1]]);
    }
}

export function ground(ctx, scene) {
  const { THREE, U, plan, pal, W } = ctx;
  const look = LOOK[plan.world.setting] || LOOK.ground;
  const rand = random((plan.seed ^ 0x5bd1e995) >>> 0);
  const height = terrain(plan, (plan.seed + 3) >>> 0);
  const R = scene.reach;
  const flat = scene.radius * 1.2;
  const lit = plan.lights.some((l) => !["sun", "moon"].includes(l.kind));
  const colors = (pal.night ? look.night : look.color).map(rgb).map((c) => (pal.night && lit ? c.map((v) => v * 0.45) : c));
  const count = Math.round(90000 * ctx.quality);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const info = new Float32Array(count * 2);
  const n = noise3((plan.seed + 11) >>> 0);
  const [s0, s1] = [W.structure[0] + 0.3, W.structure[1] + 1.5];
  for (let i = 0; i < count; i++) {
    const r = R * Math.pow(rand(), 0.75);
    const a = rand() * Math.PI * 2;
    const x = scene.cx + Math.cos(a) * r;
    const z = scene.cz + Math.sin(a) * r;
    pos.set([x, height(x - scene.cx, z - scene.cz, flat), z], i * 3);
    const t = Math.min(1, Math.max(0, n(x * 0.3, 1, z * 0.3) * 0.9 + 0.5));
    const c = colors[0].map((v, k) => v + (colors[1][k] - v) * t);
    col.set(c, i * 3);
    info[i * 2] = s0 + (r / R) * (s1 - s0) + rand() * 0.4;
    info[i * 2 + 1] = scene.radius * 0.15;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 2));
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: { ...U, uSize: { value: Math.max(0.01, scene.radius * 0.012) }, uFocus: { value: new THREE.Vector3(scene.cx, 0, scene.cz) } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
    })
  );
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);

  if (look.amp > 0.1) {
    const N = 140;
    const step = (R * 2) / N;
    const field = new Float32Array(N * N);
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < N; k++)
      for (let i = 0; i < N; i++) {
        const v = height(-R + i * step, -R + k * step, flat);
        field[k * N + i] = v;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    const segs = [];
    const levels = 18;
    for (let l = 1; l < levels; l++) marching(field, N, N, scene.cx - R, scene.cz - R, step, lo + ((hi - lo) * l) / levels, segs, (x, z) => height(x - scene.cx, z - scene.cz, flat) + 0.01);
    const lp = new Float32Array(segs.length * 3);
    const lb = new Float32Array(segs.length);
    segs.forEach((p, i) => {
      lp.set(p, i * 3);
      lb[i] = s0 + (Math.hypot(p[0] - scene.cx, p[2] - scene.cz) / R) * (s1 - s0) + 0.6;
    });
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    lines.setAttribute("aBirth", new THREE.BufferAttribute(lb, 1));
    const contour = new THREE.LineSegments(
      lines,
      new THREE.ShaderMaterial({
        uniforms: { ...U, uColor: { value: new THREE.Vector3(...colors[1].map((v) => v * (pal.dark ? 1.25 : 0.8))) }, uOpacity: { value: 0.45 } },
        vertexShader: lineVertex,
        fragmentShader: lineFragment,
        transparent: true,
        depthWrite: false,
      })
    );
    contour.frustumCulled = false;
    group.add(contour);
  }
  return { object: group, height: (x, z) => height(x - scene.cx, z - scene.cz, flat) };
}
