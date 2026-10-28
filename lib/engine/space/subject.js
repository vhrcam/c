import { random } from "../../random";
import { quadruped } from "../form/creature";
import { axisOf, bounds, compile, expand, transformParts } from "../form/sdf";
import { add, clamp, cross, dot, len, mul, norm, smooth, sub } from "../math";
import { noise3 } from "../noise";
import { mixColor, rgb } from "../palette";
import { bones } from "./bones";
import { filaments } from "./filaments";
import { sampleSurface } from "./probe";
import { swarm } from "./swarm";

const PART = { r: [0.05, 0.05], rot: [0, 0, 0], path: [], radii: [], profile: [], blend: 0, cut: false, fur: 0, flow: [0, -1, 0] };

function model(subject, rand) {
  if (subject.form === "quadruped") return quadruped(subject, rand);
  const parts = subject.parts.length ? subject.parts : [{ ...PART, name: "body", shape: "ellipsoid", a: [0, 0.5, 0], b: [0.5, 0.5, 0.5] }];
  return { parts: parts.map((p) => ({ ...PART, ...p })), heart: null };
}

export function buildForm(ctx, subject, index) {
  const rand = random((ctx.plan.seed ^ (index * 2654435761)) >>> 0);
  const m = model(subject, rand);
  const raw = bounds(expand(m.parts));
  const extent = Math.max(1e-3, ...raw.max.map((v, k) => v - raw.min[k]));
  const scale = subject.size / extent;
  const offset = [(-(raw.min[0] + raw.max[0]) / 2) * scale, -raw.min[1] * scale, (-(raw.min[2] + raw.max[2]) / 2) * scale];
  const parts = transformParts(m.parts, scale, offset);
  const prims = expand(parts);
  const box = bounds(prims);
  const glsl = compile(prims);
  const center = box.min.map((v, k) => (v + box.max[k]) / 2);
  const heart = m.heart ? add(mul(m.heart, scale), offset) : center;
  return { subject, parts, prims, box, glsl, heart, scale, rand, extra: m, size: subject.size };
}

export function surface(ctx, form, count) {
  const { prims, heart, rand } = form;
  const samples = sampleSurface(ctx, form.glsl, form.box, count, (ctx.plan.seed + form.subject.id.length * 31) >>> 0);
  const n = samples.n;
  const noise = noise3((ctx.plan.seed + 7) >>> 0);
  const colors = new Float32Array(n * 3);
  const order = new Float32Array(n);
  const from = new Float32Array(n * 3);
  const ctrl = new Float32Array(n * 3);
  const r = new Float32Array(n);
  const diag = samples.diag;
  const cache = new Map();
  const col = (hex, fallback) => {
    const key = hex || fallback;
    if (!cache.has(key)) cache.set(key, rgb(key));
    return cache.get(key);
  };
  const fallback = form.subject.colors[0] || "#c9c3b8";
  const sp = form.extra.sp || {};
  let maxD = 1e-6;
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = [samples.pos[i * 3], samples.pos[i * 3 + 1], samples.pos[i * 3 + 2]];
    dist[i] = len(sub(p, heart));
    maxD = Math.max(maxD, dist[i]);
  }
  const freq = 2.2 / diag;
  for (let i = 0; i < n; i++) {
    const p = [samples.pos[i * 3], samples.pos[i * 3 + 1], samples.pos[i * 3 + 2]];
    const nn = [samples.nrm[i * 3], samples.nrm[i * 3 + 1], samples.nrm[i * 3 + 2]];
    const prim = prims[Math.round(samples.part[i])] || prims[0];
    const top = col(prim.color, fallback);
    const under = col(prim.under || prim.color, fallback);
    let c = mixColor(under, top, smooth(-0.4, 0.45, nn[1]));
    if (sp.stripes && prim.fur > 0.3) {
      const band = Math.sin(p[0] * 34 / form.size + noise(p[0] * 3, p[1] * 3, p[2] * 3) * 3 + p[1] * 6);
      if (band > 0.55) c = col(sp.accent, fallback);
    }
    if (sp.patches && prim.fur > 0) {
      if (noise(p[0] * 4 / form.size, p[1] * 4 / form.size, p[2] * 4 / form.size + 9) > 0.18) c = col(sp.accent, fallback);
    }
    if (sp.socks && prim.low && p[1] < form.size * 0.22) c = col(sp.accent, fallback);
    if (sp.tip && prim.tip && prim.along && prim.along[1] > 0.8) c = col(sp.under, fallback);
    colors.set(c, i * 3);
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

export function strands(form, surf, budget) {
  const { samples, colors, order, rand } = surf;
  const { prims } = form;
  const furLen = (form.extra.fur || 0.04) * form.scale * 1.7;
  const ids = [];
  for (let i = 0; i < samples.n; i++) {
    const prim = prims[Math.round(samples.part[i])];
    if (prim && prim.fur > 0.05) ids.push(i);
  }
  const step = Math.max(1, ids.length / budget);
  const picked = [];
  for (let k = 0; k < ids.length; k += step) picked.push(ids[Math.floor(k)]);
  const n = picked.length;
  const out = { n, root: new Float32Array(n * 3), normal: new Float32Array(n * 3), flow: new Float32Array(n * 3), info: new Float32Array(n * 4), color: new Float32Array(n * 3), tip: new Float32Array(n * 3), order: new Float32Array(n) };
  picked.forEach((i, j) => {
    const prim = prims[Math.round(samples.part[i])];
    const nn = [samples.nrm[i * 3], samples.nrm[i * 3 + 1], samples.nrm[i * 3 + 2]];
    let f = prim.flow === "axis" ? axisOf(prim) : prim.flow || [0, -1, 0];
    f = sub(f, mul(nn, dot(f, nn)));
    if (len(f) < 1e-3) f = cross(nn, [0, 0, 1]);
    f = norm(f);
    const lift = furLen * 0.12;
    out.root.set([samples.pos[i * 3] + nn[0] * lift, samples.pos[i * 3 + 1] + nn[1] * lift, samples.pos[i * 3 + 2] + nn[2] * lift], j * 3);
    out.normal.set(nn, j * 3);
    out.flow.set(f, j * 3);
    const c = [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]];
    out.color.set(mul(c, 0.55 + samples.ao[i] * 0.2), j * 3);
    const tipShift = rand[i] > 0.7 ? 0.8 : 1.25;
    const hue = (rand[(i * 7) % samples.n] - 0.5) * 0.12;
    out.tip.set(c.map((v, k) => Math.min(1, v * tipShift + 0.05 + hue * (k - 1))), j * 3);
    out.info.set([0, furLen * prim.fur * (0.65 + rand[i] * 0.7), rand[i], samples.ao[i]], j * 4);
    out.order[j] = order[i];
  });
  return out;
}

export function subjectSystems(ctx, form, language) {
  const q = ctx.quality;
  const systems = [bones(ctx, form)];
  if (language === "filaments") {
    const surf = surface(ctx, form, 70000 * q);
    for (let i = 0; i < surf.samples.n * 3; i++) surf.colors[i] *= 0.7;
    systems.push(swarm(ctx, surf, { birth: ctx.W.form, size: surf.samples.diag * 0.0032 }));
    const s = strands(form, surf, 34000 * q);
    const [d0, d1] = ctx.W.detail;
    for (let j = 0; j < s.n; j++) s.info[j * 4] = d0 + s.order[j] * (d1 - d0 - 1.8);
    systems.push(filaments(ctx, s, { droop: 0.22, lift: 0.4, opacity: 0.85 }));
    return { systems, surf };
  }
  const surf = surface(ctx, form, 110000 * q);
  systems.push(swarm(ctx, surf, { birth: ctx.W.form, size: surf.samples.diag * 0.0032 }));
  return { systems, surf };
}
