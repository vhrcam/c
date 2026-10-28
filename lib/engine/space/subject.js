import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { random } from "../../random";
import { building } from "../form/building";
import { bounds, compile, expand, transformParts } from "../form/sdf";
import { vehicle } from "../form/vehicle";
import { add, clamp, cross, len, mul, norm, smooth, sub } from "../math";
import { noise3 } from "../noise";
import { mixColor, rgb } from "../palette";
import { bones } from "./bones";
import { planet } from "./planet";
import { sampleSlices, sampleSurface } from "./probe";
import { slices } from "./slices";
import { edgeSystem, sampleMesh, surfaceSystem } from "./surface";
import { swarm } from "./swarm";
import { growTree, treeReach, trees } from "./trees";

const PART = { r: [0.05, 0.05], rot: [0, 0, 0], path: [], radii: [], profile: [], blend: 0, cut: false, fur: 0, flow: [0, -1, 0] };

function meshForm(subject, built, rand) {
  const bb = built.geometry.boundingBox;
  const box = { min: bb.min.toArray(), max: bb.max.toArray() };
  const size = Math.max(...box.max.map((v, k) => v - box.min[k]));
  return { subject, mesh: built.geometry, prims: [], box, glsl: null, heart: built.heart, scale: 1, rand, extra: built, size };
}

export function buildForm(ctx, subject, index) {
  const rand = random((ctx.plan.seed ^ (index * 2654435761)) >>> 0);
  if (subject.form === "planet") {
    const R = subject.size / 2;
    return { subject, planet: true, prims: [], box: { min: [-R, -R, -R], max: [R, R, R] }, glsl: null, heart: [0, 0, 0], scale: 1, rand, extra: {}, size: subject.size };
  }
  if (subject.form === "tree") {
    const conifer = /\b(pine|fir|spruce|conifer|evergreen|christmas)\b/i.test(subject.label) || ctx.plan.world.season === "winter";
    const tree = growTree(rand, conifer ? "conifer" : "broad", subject.size);
    const r = treeReach(tree);
    return { subject, tree, prims: [], box: { min: [-r, 0, -r], max: [r, subject.size, r] }, glsl: null, heart: [0, subject.size * 0.3, 0], scale: 1, rand, extra: {}, size: subject.size };
  }
  if (subject.form === "building") return meshForm(subject, building(subject, rand), rand);
  if (subject.form === "vehicle") return meshForm(subject, vehicle(subject, rand), rand);
  if (subject.form !== "parts") return null;
  const source = subject.parts.length ? subject.parts : [{ ...PART, name: "body", shape: "ellipsoid", a: [0, 0.5, 0], b: [0.5, 0.5, 0.5] }];
  const raw = bounds(expand(source.map((p) => ({ ...PART, ...p }))));
  const extent = Math.max(1e-3, ...raw.max.map((v, k) => v - raw.min[k]));
  const scale = subject.size / extent;
  const offset = [(-(raw.min[0] + raw.max[0]) / 2) * scale, -raw.min[1] * scale, (-(raw.min[2] + raw.max[2]) / 2) * scale];
  const parts = transformParts(source.map((p) => ({ ...PART, ...p })), scale, offset);
  const prims = expand(parts);
  const box = bounds(prims);
  const center = box.min.map((v, k) => (v + box.max[k]) / 2);
  return { subject, parts, prims, box, glsl: compile(prims), heart: center, scale, rand, extra: {}, size: subject.size };
}

function flight(ctx, heart, samples, colors, rand) {
  const n = samples.n;
  const noise = noise3((ctx.plan.seed + 7) >>> 0);
  const order = new Float32Array(n);
  const from = new Float32Array(n * 3);
  const ctrl = new Float32Array(n * 3);
  const r = new Float32Array(n);
  const diag = samples.diag;
  let maxD = 1e-6;
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dist[i] = len(sub([samples.pos[i * 3], samples.pos[i * 3 + 1], samples.pos[i * 3 + 2]], heart));
    maxD = Math.max(maxD, dist[i]);
  }
  const freq = 2.2 / diag;
  for (let i = 0; i < n; i++) {
    const p = [samples.pos[i * 3], samples.pos[i * 3 + 1], samples.pos[i * 3 + 2]];
    const nn = [samples.nrm[i * 3], samples.nrm[i * 3 + 1], samples.nrm[i * 3 + 2]];
    const rr = rand();
    r[i] = rr;
    order[i] = clamp((dist[i] / maxD) * 0.82 + rr * 0.18, 0, 1);
    const jitter = diag * 0.02;
    const f = [heart[0] + (rand() - 0.5) * jitter, heart[1] + (rand() - 0.5) * jitter, heart[2] + (rand() - 0.5) * jitter];
    from.set(f, i * 3);
    const d = sub(p, f);
    const L = len(d) || 1e-4;
    const side = norm(cross(d, [0, 1, 0]));
    const swirl = noise(p[0] * freq, p[1] * freq, p[2] * freq) * 1.6;
    const lift = 0.25 + noise(p[0] * freq + 5, p[1] * freq, p[2] * freq) * 0.4;
    const mid = add(f, mul(d, 0.5));
    ctrl.set(add(add(mid, mul(side, swirl * L * 0.55)), add(mul([0, 1, 0], lift * L), mul(nn, L * 0.2))), i * 3);
  }
  return { samples, colors, order, from, ctrl, rand: r };
}

export function surface(ctx, form, count) {
  const { prims } = form;
  const samples = sampleSurface(ctx, form.glsl, form.box, count, (ctx.plan.seed + form.subject.id.length * 31) >>> 0);
  const colors = new Float32Array(samples.n * 3);
  const cache = new Map();
  const col = (hex) => {
    if (!cache.has(hex)) cache.set(hex, rgb(hex));
    return cache.get(hex);
  };
  const fallback = form.subject.colors[0] || "#c9c3b8";
  for (let i = 0; i < samples.n; i++) {
    const prim = prims[Math.round(samples.part[i])] || prims[0];
    const top = col(prim.color || fallback);
    const under = col(prim.under || prim.color || fallback);
    let c = mixColor(under, top, smooth(-0.4, 0.45, samples.nrm[i * 3 + 1]));
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    if (lum < 0.16) c = mixColor(c, [0.62, 0.64, 0.7], (0.16 - lum) * 2.2);
    colors.set(c, i * 3);
  }
  return flight(ctx, form.heart, samples, colors, form.rand);
}

function sdfMesh(ctx, form, surf) {
  const N = Math.round(64 + 24 * ctx.quality);
  const c = form.box.min.map((v, k) => (v + form.box.max[k]) / 2);
  const s = (Math.max(...form.box.max.map((v, k) => v - form.box.min[k])) / 2) * 1.12;
  const frames = [];
  for (let k = 0; k < N; k++) frames.push({ o: [c[0], c[1], c[2] - s + (k / (N - 1)) * 2 * s], ext: 2 * s, u: [1, 0, 0], v: [0, 1, 0] });
  const fields = sampleSlices(ctx, form.glsl, frames, N);
  const mc = new MarchingCubes(N, new THREE.MeshBasicMaterial(), false, false, 200000);
  mc.isolation = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) mc.field[x + y * N + z * N * N] = -fields[z][y * N + x];
  mc.update();
  const count = mc.count;
  const pos = mc.positionArray.slice(0, count * 3);
  const nrm = mc.normalArray.slice(0, count * 3);
  const map = (q) => ((q * N) / 2 + N / 2) / (N - 1) - 0.5;
  for (let i = 0; i < count; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = c[a] + map(pos[i * 3 + a]) * 2 * s;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  const cell = surf.samples.diag / 40;
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < surf.samples.n; i += 2) {
    const kk = key(surf.samples.pos[i * 3], surf.samples.pos[i * 3 + 1], surf.samples.pos[i * 3 + 2]);
    if (!grid.has(kk)) grid.set(kk, i);
  }
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    let best = -1;
    let bd = Infinity;
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    const cz = Math.floor(p[2] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const j = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (j === undefined) continue;
          const d = (surf.samples.pos[j * 3] - p[0]) ** 2 + (surf.samples.pos[j * 3 + 1] - p[1]) ** 2 + (surf.samples.pos[j * 3 + 2] - p[2]) ** 2;
          if (d < bd) [best, bd] = [j, d];
        }
    colors.set(best < 0 ? [0.8, 0.8, 0.8] : [surf.colors[best * 3], surf.colors[best * 3 + 1], surf.colors[best * 3 + 2]], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  mc.geometry.dispose();
  return geometry;
}

export function subjectSystems(ctx, form, language) {
  const q = ctx.quality;
  if (form.planet) return { systems: [planet(ctx, form)] };
  if (form.tree) return { systems: [trees(ctx, [{ rand: form.rand, x: 0, z: 0, scale: 1, delay: 0, tree: form.tree }], { leafSize: form.size * 0.006 })] };
  if (form.mesh) {
    const { samples, colors } = sampleMesh(form.mesh, Math.round(60000 * q), form.rand);
    const surf = flight(ctx, form.heart, samples, colors, form.rand);
    return {
      systems: [
        edgeSystem(ctx, form.mesh, { alpha: ctx.pal.dark ? 0.5 : 0.6 }),
        swarm(ctx, surf, { birth: [ctx.W.form[0], ctx.W.detail[0] + 1], size: samples.diag * 0.0026, keep: 0.6, fade: [ctx.W.detail[1] - 1, ctx.W.detail[1] + 1.5, 0] }),
        surfaceSystem(ctx, form.mesh, { window: [ctx.W.form[0] + 1.2, ctx.W.detail[1] - 1], grain: 420 / Math.max(1, form.size), texture: 0.2 }),
      ],
      surf,
    };
  }
  const surf = surface(ctx, form, 90000 * q);
  const ext = [0, 1, 2].map((k) => form.box.max[k] - form.box.min[k]);
  const longest = ext.indexOf(Math.max(...ext));
  return {
    systems: [
      bones(ctx, form),
      slices(ctx, form, surf, { axis: language === "slices" ? 1 : longest, count: Math.round(100 * Math.max(0.6, q)), alpha: 0.8 }),
      swarm(ctx, surf, { birth: ctx.W.form, size: surf.samples.diag * 0.0026, fade: [ctx.W.detail[1] - 0.5, ctx.W.detail[1] + 2, 0] }),
      surfaceSystem(ctx, sdfMesh(ctx, form, surf), { window: [ctx.W.form[0] + 1.5, ctx.W.detail[1] - 1], span: new THREE.Vector3(...ext.map((v, k) => (k === longest ? v : 0))), from: new THREE.Vector3(...form.box.min) }),
    ],
    surf,
  };
}
