import { mixColor, rgb } from "../palette";
import { add, cross, len, mul, norm, sub } from "../math";
import { COMMON } from "./glsl";

const LEAVES = {
  fall: ["#d4692c", "#e3a03b", "#b8402a", "#c98a2e"],
  spring: ["#f0bfd0", "#e9a6bb", "#9cc27a", "#f6dbe4"],
  summer: ["#5d8a45", "#7aa152", "#4a7340", "#93b562"],
  winter: [],
  none: ["#5f8748", "#7d9e55", "#4c6f3f", "#8fae63"],
};

function rotate(v, axis, a) {
  const k = norm(axis);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = cross(k, v);
  return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
}

export function growTree(rand, kind, height) {
  const segs = [];
  const tips = [];
  const conifer = kind === "conifer";
  const trunkH = height * (conifer ? 0.98 : 0.38);
  const r0 = height * (conifer ? 0.018 : 0.026);
  const grow = (start, dir, length, radius, depth, dist) => {
    const pieces = depth === 0 ? 4 : 2;
    let p = start;
    let d = dir;
    for (let i = 0; i < pieces; i++) {
      const wob = [rand() - 0.5, rand() * 0.3 - 0.1, rand() - 0.5];
      d = norm(add(d, mul(wob, depth === 0 ? 0.12 : 0.35)));
      if (!conifer) d = norm(add(d, [0, 0.08, 0]));
      const q = add(p, mul(d, length / pieces));
      segs.push({ a: p, b: q, r: radius * (1 - (i / pieces) * 0.25), depth, t0: dist + (length * i) / pieces, t1: dist + (length * (i + 1)) / pieces });
      p = q;
    }
    const end = dist + length;
    const maxDepth = conifer ? 3 : 5;
    if (depth >= maxDepth || radius < height * 0.0018) {
      tips.push({ p, d, depth, dist: end });
      return;
    }
    const kids = conifer ? (depth === 0 ? 0 : 2) : depth === 0 ? 3 + Math.floor(rand() * 2) : 2 + (rand() < 0.4 ? 1 : 0);
    const roll = rand() * Math.PI * 2;
    for (let k = 0; k < kids; k++) {
      const side = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const around = rotate(side, d, roll + (k / kids) * Math.PI * 2 + rand() * 0.6);
      const spread = (conifer ? 0.5 : 0.45 + rand() * 0.35) * (depth === 0 ? 1.2 : 1);
      const nd = norm(add(mul(d, Math.cos(spread)), mul(around, Math.sin(spread))));
      grow(p, nd, length * (0.62 + rand() * 0.18), radius * 0.62, depth + 1, end);
    }
  };
  if (conifer) {
    const whorls = Math.round(10 + rand() * 6);
    let prev = [0, 0, 0];
    for (let w = 0; w <= whorls; w++) {
      const y = (w / whorls) * trunkH;
      const p = [0, y, 0];
      if (w > 0) segs.push({ a: prev, b: p, r: r0 * (1 - (w / whorls) * 0.85), depth: 0, t0: (w - 1) / whorls * trunkH, t1: y });
      prev = p;
      if (y < height * 0.28) continue;
      const reach = (1 - w / whorls) * height * 0.3 + height * 0.03;
      const arms = 5 + Math.floor(rand() * 3);
      for (let k = 0; k < arms; k++) {
        const a = (k / arms) * Math.PI * 2 + w * 0.7 + rand() * 0.4;
        const dir = norm([Math.cos(a), -0.28 - rand() * 0.15, Math.sin(a)]);
        grow(p, dir, reach, r0 * 0.3 * (1 - w / whorls) + height * 0.002, 1, y);
      }
    }
  } else grow([0, 0, 0], [0, 1, 0], trunkH, r0, 0, 0);
  const total = Math.max(...segs.map((s) => s.t1), ...tips.map((t) => t.dist), 1e-3);
  return { segs, tips, total, height, conifer };
}

const branchVertex = /* glsl */ `
${COMMON}
attribute vec3 aA;
attribute vec3 aB;
attribute vec4 aInfo;
attribute vec3 aColor;
uniform float uSway;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = clamp((uT - aInfo.x) / max(0.05, aInfo.y), 0.0, 1.0);
  vec3 p = mix(aA, aB, min(aInfo.z, g));
  float bendK = max(0.0, p.y) * uSway;
  p.x += sin(uT * 0.7 + aInfo.w * 6.0) * bendK * 0.01;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  vec3 n = normalize(vec3(sin(aInfo.w * 40.0), 0.6, cos(aInfo.w * 40.0)));
  vColor = fogged(shade(aColor, world.xyz, n, 1.0), -mv.z);
  vAlpha = step(0.0001, g) * 0.9;
}
`;

const lineFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const leafVertex = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec3 aNormal;
attribute vec2 aInfo;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = clamp((uT - aInfo.x) / 1.4, 0.0, 1.0);
  vec3 p = position + vec3(sin(uT * 1.3 + aInfo.y * 30.0), 0.0, cos(uT * 1.1 + aInfo.y * 20.0)) * 0.03 * g;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  vColor = fogged(shade(aColor, world.xyz, normalize(mat3(modelMatrix) * aNormal), 1.0), -mv.z);
  vAlpha = easeOut(g);
  gl_PointSize = clamp(uPx * uScale / -mv.z * easeOut(g), 0.0, 3.2);
}
`;

const leafFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25 || vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

export function trees(ctx, list, opts = {}) {
  const { THREE, U, plan, pal, W } = ctx;
  const season = plan.world.season;
  const snowy = plan.world.weather === "snow" || plan.world.setting === "snowfield" || season === "winter";
  const bark = rgb(opts.bark || (pal.night ? "#5a5148" : "#4a3f35"));
  const leaves = (opts.leaves || LEAVES[snowy && !opts.leaves ? "winter" : season] || LEAVES.none).map(rgb);
  const snow = rgb("#eef2f6");
  const [g0, g1] = opts.window || [W.structure[0] + 0.5, W.detail[0] + 2];
  const A = [];
  const B = [];
  const info = [];
  const col = [];
  const lp = [];
  const lc = [];
  const ln = [];
  const li = [];
  for (const t of list) {
    const { rand, x, z, scale, tree, delay } = t;
    const place = (p) => [x + p[0] * scale, p[1] * scale, z + p[2] * scale];
    const span = (g1 - g0) * (opts.spanK ?? 1);
    for (const s of tree.segs) {
      const lines = s.depth === 0 ? 5 : s.depth === 1 ? 3 : 1;
      const dir = norm(sub(s.b, s.a));
      const side = norm(cross(dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const birth0 = g0 + delay + (s.t0 / tree.total) * span;
      const birth1 = g0 + delay + (s.t1 / tree.total) * span;
      for (let k = 0; k < lines; k++) {
        const off = lines === 1 ? [0, 0, 0] : mul(rotate(side, dir, (k / lines) * Math.PI * 2), s.r * 0.85);
        const a = place(add(s.a, off));
        const b = place(add(s.b, off));
        const c = mixColor(bark, [1, 1, 1], s.depth * 0.04 + rand() * 0.05);
        for (const u of [0, 0.5, 0.5, 1]) {
          A.push(...a);
          B.push(...b);
          info.push(birth0, Math.max(0.05, birth1 - birth0), u, rand());
          col.push(...c);
        }
      }
    }
    if (leaves.length || snowy) {
      for (const tip of tree.tips) {
        const n = snowy ? 6 : 14;
        for (let k = 0; k < n; k++) {
          const off = [(rand() - 0.5) * 0.12 * tree.height, (rand() - 0.3) * 0.08 * tree.height, (rand() - 0.5) * 0.12 * tree.height];
          lp.push(...place(add(tip.p, mul(off, 0.6))));
          const base = snowy ? snow : leaves[Math.floor(rand() * leaves.length)];
          lc.push(...base.map((v) => Math.min(1, v * (0.85 + rand() * 0.3))));
          ln.push(...norm([off[0], Math.abs(off[1]) + 0.4, off[2]]));
          li.push(g0 + delay + (tip.dist / tree.total) * (g1 - g0) + 1 + rand() * 1.5, rand());
        }
      }
    }
  }
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(A.length), 3));
  geometry.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(A), 3));
  geometry.setAttribute("aB", new THREE.BufferAttribute(new Float32Array(B), 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(info), 4));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(col), 3));
  const branches = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({ uniforms: { ...U, uSway: { value: 1 } }, vertexShader: branchVertex, fragmentShader: lineFragment, transparent: true }));
  branches.frustumCulled = false;
  group.add(branches);
  if (lp.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(lc), 3));
    g.setAttribute("aNormal", new THREE.BufferAttribute(new Float32Array(ln), 3));
    g.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(li), 2));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { ...U, uPx: { value: (opts.leafSize ?? 0.05) * (list[0]?.scale || 1) } }, vertexShader: leafVertex, fragmentShader: leafFragment, transparent: true }));
    pts.frustumCulled = false;
    group.add(pts);
  }
  return { object: group, count: list.length };
}

export function forest(ctx, scene, rand) {
  const { plan } = ctx;
  const conifer = plan.world.setting === "snowfield" || plan.world.weather === "snow" || plan.world.season === "winter" || /\b(pine|fir|spruce|conifer|evergreen)\b/i.test(plan.text);
  const dense = plan.world.setting === "forest";
  const n = Math.round((dense ? 70 : 14) * Math.max(0.5, ctx.quality));
  const list = [];
  const inner = Math.max(scene.radius * 3 + 3, (scene.camDist || 0) * 1.8);
  const outer = Math.max(inner * 4, scene.reach * 0.75);
  const vx = scene.view.x;
  const vz = scene.view.z;
  const vl = Math.hypot(vx, vz) || 1;
  for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
    const r = inner + Math.pow(rand(), 0.8) * (outer - inner);
    const a = rand() * Math.PI * 2;
    const toward = (Math.cos(a) * vx + Math.sin(a) * vz) / vl;
    if (toward > 0.1 && r < (scene.camDist || inner * 2) * 2.2) continue;
    i++;
    const height = (dense ? 7 : 6) + rand() * 9;
    list.push({ rand, x: scene.cx + Math.cos(a) * r, z: scene.cz + Math.sin(a) * r, scale: 1, delay: (r / outer) * 2.5, tree: growTree(rand, conifer && rand() < 0.92 ? "conifer" : "broad", height) });
  }
  return list;
}

export function treeReach(tree) {
  return Math.max(...tree.segs.map((s) => len([s.b[0], 0, s.b[2]])), tree.height * 0.1);
}
