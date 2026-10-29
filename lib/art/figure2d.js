import { hash, random } from "../random";
import { H, W } from "./world";

const SKIN = ["#f6dccb", "#efc6a6", "#dba57f", "#b9825c", "#91603f", "#6a4430", "#4a2f21"];
const HAIR = ["#1f1a1d", "#3b2618", "#5c3b24", "#7a5232", "#a4733f", "#d8b26a", "#8f3f22", "#2a2a3a", "#4a3a5a"];
const GREY = ["#dcd8d2", "#bfbbb5", "#a09d98", "#efebe5"];
const EYES = ["#5a3a22", "#3a2416", "#7a5a2a", "#3f6a4a", "#3a6aa0", "#6a7480", "#9a5a2a", "#5a4a8a"];
const CLOTH = ["#2b3a67", "#c8553d", "#e0a458", "#3f7a4a", "#efe9dc", "#1f2a44", "#7a4f9a", "#b3502e", "#5c7290", "#d9c9a3", "#8a2f3a", "#2f6f73", "#3a3a3a", "#e58fa8", "#6b6f3a"];
const M = { skin: 1, hair: 2, top: 4, bottom: 5, dress: 6, shoe: 7, coat: 9, object: 10 };
const A = { fur: 11, fur2: 12, dark: 13, beak: 14, crown: 15 };
const UNIT = 1 / 1.75;

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const unit = (v) => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const gap = (a, b) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));
const deepen = (hex, k = 0.55) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;
const lift = (hex, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * k).toString(16).padStart(2, "0")).join("")}`;

function ik(root, target, l1, l2, bend) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx);
  const b = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const mid = add(root, [Math.cos(a + bend * b) * l1, Math.sin(a + bend * b) * l1]);
  const e = Math.atan2(target[1] - mid[1], target[0] - mid[0]);
  return { mid, end: add(mid, [Math.cos(e) * l2, Math.sin(e) * l2]) };
}

function centerline(joints, n) {
  if (joints.length === 2) return Array.from({ length: n + 1 }, (_, i) => lerp(joints[0], joints[1], i / n));
  const P = [joints[0], ...joints, joints[joints.length - 1]];
  const out = [];
  const seg = joints.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * seg;
    const k = Math.min(seg - 1, Math.floor(u));
    const t = u - k;
    const [p0, p1, p2, p3] = [P[k], P[k + 1], P[k + 2], P[k + 3]];
    const t2 = t * t;
    const t3 = t2 * t;
    out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
  }
  return out;
}

function sweep(joints, radii, n = 20) {
  const pts = centerline(joints, n);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1] || 1;
  const rAt = (t) => {
    for (let i = 1; i < radii.length; i++)
      if (t <= radii[i][0]) {
        const [t0, r0] = radii[i - 1];
        const [t1, r1] = radii[i];
        const k = (t - t0) / Math.max(1e-6, t1 - t0);
        return r0 + (r1 - r0) * (k * k * (3 - 2 * k));
      }
    return radii[radii.length - 1][1];
  };
  const left = [];
  const right = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const tg = unit(sub(q, o));
    const nrm = [-tg[1], tg[0]];
    const r = rAt(len[i] / total);
    left.push(add(p, mul(nrm, r)));
    right.push(sub(p, mul(nrm, r)));
  });
  const cap = (c, from, sweepDir, r) => Array.from({ length: 5 }, (_, i) => add(c, rot(mul(from, r), (sweepDir * Math.PI * (i + 1)) / 6)));
  const endT = unit(sub(pts[pts.length - 1], pts[pts.length - 2]));
  const startT = unit(sub(pts[1], pts[0]));
  return [...left, ...cap(pts[pts.length - 1], [-endT[1], endT[0]], -1, rAt(1)), ...right.reverse(), ...cap(pts[0], [startT[1], -startT[0]], -1, rAt(0))];
}

const ring = (c, rx, ry, a = 0, n = 18) => Array.from({ length: n }, (_, i) => add(c, rot([Math.cos((i / n) * Math.PI * 2) * rx, Math.sin((i / n) * Math.PI * 2) * ry], a)));

// a lock of hair: wide at the scalp, curving to a point
const lock = (T, root, mid, tip, w) => sweep([T(...root), T(...mid), T(...tip)], [[0, w], [0.45, w * 0.78], [1, w * 0.05]], 12);

function shape(sex, subject, r) {
  const f = sex === "f";
  const child = subject?.age === "child";
  const elder = subject?.age === "elder";
  return {
    h: child ? r.range(0.6, 0.72) : r.range(0.94, 1.04) * (f ? 0.96 : 1) * (elder ? 0.97 : 1),
    head: child ? r.range(0.19, 0.21) : r.range(0.138, 0.15) * (f ? 1.02 : 1),
    torso: r.range(0.28, 0.31) * (child ? 0.92 : 1),
    leg: child ? r.range(0.42, 0.45) : r.range(0.48, 0.52),
    neck: r.range(0.026, 0.034),
    upper: r.range(0.165, 0.18),
    fore: r.range(0.148, 0.165),
    shoulder: child ? r.range(0.085, 0.095) : f ? r.range(0.088, 0.1) : r.range(0.105, 0.122),
    hip: f ? r.range(0.088, 0.104) : r.range(0.076, 0.09),
    chest: r.range(0.085, 0.106),
    waist: f ? r.range(0.06, 0.074) : r.range(0.074, 0.09),
    bust: f && !child ? r.range(0.008, 0.02) : 0,
    limb: r.range(0.9, 1.08) * (f ? 0.93 : 1),
    child,
    elder,
    f,
  };
}

function dressFor(subject, ctx, sex, r) {
  const said = String(subject?.clothing || "").toLowerCase();
  if (/dress|gown|skirt/.test(said)) return { kind: "dress", sleeve: r.range(0.2, 1) };
  if (/coat|jacket|raincoat|parka|cardigan/.test(said)) return { kind: "coat", sleeve: 1 };
  if (/sweater|hoodie|knit|jumper/.test(said)) return { kind: "top", sleeve: 1 };
  if (/shorts/.test(said)) return { kind: "top", sleeve: 0.4, shorts: true };
  if (subject?.age === "elder") return r.chance(0.6) ? { kind: "coat", sleeve: 1 } : { kind: "top", sleeve: 1 };
  if (ctx.pose === "run") return { kind: "top", sleeve: r.range(0.3, 0.5), shorts: r.chance(0.6) };
  if (ctx.cold || ctx.wet) return r.chance(0.6) ? { kind: "coat", sleeve: 1 } : { kind: "top", sleeve: 1 };
  if (ctx.warm && sex === "f" && r.chance(0.3)) return { kind: "dress", sleeve: r.range(0.2, 0.6) };
  return { kind: "top", sleeve: r.chance(0.5) ? r.range(0.3, 0.5) : 1, shorts: ctx.warm && r.chance(0.25) };
}

function hairFor(subject, ctx, sex, r) {
  const said = `${subject?.hair || ""} ${subject?.appearance || ""}`.toLowerCase();
  if (/ponytail/.test(said)) return "ponytail";
  if (/\bbun\b/.test(said)) return "bun";
  if (/\bbob\b/.test(said)) return "bob";
  if (/bald|shaved|buzz/.test(said)) return "none";
  if (/long/.test(said)) return "long";
  if (/short|crop|pixie/.test(said)) return "short";
  if (/curly|afro/.test(said)) return "curly";
  if (subject?.age === "elder") return sex === "f" ? r.pick(["bun", "short", "bob"]) : r.pick(["short", "receding", "receding"]);
  const pool = sex === "f" ? ["long", "long", "ponytail", "bob", "short", "bun", "curly"] : ["short", "short", "short", "curly", "bob", "short", "long"];
  return r.pick(ctx.pose === "run" ? pool.map((p) => (p === "long" ? "ponytail" : p)) : pool);
}

function look(subject, sex, ctx, r, i, seed) {
  const said = `${subject?.appearance || ""}`.toLowerCase();
  const tone = /\b(dark|black|brown)[- ]skin/.test(said) ? 5 : /\b(pale|fair|light)[- ]skin/.test(said) ? 0 : /\b(tan|olive)/.test(said) ? 3 : Math.floor(random((seed ^ (0x5a17 + i * 131)) >>> 0)() * SKIN.length);
  const elder = subject?.age === "elder";
  const top = subject?.clothColor || (elder ? r.pick(["#6b5a45", "#5c7290", "#8a2f3a", "#6b6f3a", "#d9c9a3"]) : r.pick(CLOTH));
  return {
    skin: SKIN[tone],
    hair: subject?.hairColor || (elder ? r.pick(GREY) : r.pick(HAIR)),
    eye: tone >= 4 ? r.pick(EYES.slice(0, 3)) : r.pick(EYES),
    top,
    bottom: r.pick(["#1f2a44", "#2b2b30", "#4a6a95", "#6b5a45", "#d9c9a3", "#3a3a3a"]),
    dress: subject?.clothColor || r.pick(CLOTH),
    shoe: r.pick(["#1f1d22", "#3b2a20", "#efe9dc", "#5a4030", "#8a2f3a"]),
    coat: top,
    dressing: dressFor(subject, ctx, sex, r),
    style: hairFor(subject, ctx, sex, r),
    glasses: elder && r.chance(0.5),
    part: r.range(-0.12, 0.12),
  };
}

// anime proportions in head units (x toward the face, y up, head height 1)
const HEAD_SIDE = [[-0.3, -0.28], [-0.43, -0.1], [-0.47, 0.1], [-0.42, 0.32], [-0.25, 0.48], [0.0, 0.54], [0.22, 0.48], [0.34, 0.33], [0.385, 0.15], [0.37, 0.06], [0.4, -0.01], [0.465, -0.1], [0.405, -0.135], [0.415, -0.19], [0.39, -0.225], [0.405, -0.26], [0.36, -0.33], [0.27, -0.43], [0.12, -0.42], [-0.04, -0.3], [-0.16, -0.27]];
const HEAD_THREE = [[-0.06, 0.54], [-0.3, 0.47], [-0.45, 0.28], [-0.48, 0.05], [-0.44, -0.13], [-0.33, -0.3], [-0.12, -0.44], [0.08, -0.51], [0.22, -0.43], [0.33, -0.28], [0.385, -0.1], [0.4, 0.05], [0.385, 0.22], [0.3, 0.42], [0.14, 0.52]];
// hairline follows the temple, wraps above the ear and ends at the nape
const CAP_SIDE = [[0.33, 0.33], [0.37, 0.41], [0.27, 0.55], [0.08, 0.62], [-0.18, 0.62], [-0.41, 0.49], [-0.53, 0.26], [-0.55, 0.02], [-0.5, -0.15], [-0.41, -0.25], [-0.3, -0.21], [-0.22, -0.05], [-0.15, 0.1], [-0.04, 0.14], [0.05, 0.1], [0.07, -0.05], [0.12, -0.03], [0.14, 0.13], [0.2, 0.25], [0.28, 0.29]];
const CAP_RECEDE = [[0.12, 0.56], [-0.1, 0.62], [-0.36, 0.53], [-0.51, 0.28], [-0.54, 0.02], [-0.49, -0.15], [-0.41, -0.25], [-0.3, -0.21], [-0.22, -0.05], [-0.15, 0.1], [-0.04, 0.14], [0.02, 0.3], [0.07, 0.46]];
const CAP_THREE = [[0.38, 0.22], [0.37, 0.38], [0.21, 0.57], [-0.05, 0.63], [-0.33, 0.56], [-0.51, 0.36], [-0.55, 0.1], [-0.51, -0.08], [-0.44, -0.02], [-0.42, 0.2], [-0.3, 0.34], [0.0, 0.42], [0.28, 0.36]];

function person(view, pr, lk, f, bx, cfg, zb) {
  const s = pr.h;
  const lw = pr.limb;
  const d = lk.dressing;
  const items = [];
  const put = (pts, mat, z, shade, extra = {}) => items.push({ kind: "path", pts, mat, z: zb + z, shade, ...extra });
  const paint = (pts, hex, z, extra = {}) => items.push({ kind: "path", pts, mat: M.skin, hex, z: zb + z, line: false, ...extra });
  const line = (pts, hex, width, z, extra = {}) => items.push({ kind: "line", pts, hex, width, z: zb + z, ...extra });
  const side = view === "side";
  const three = view === "three";
  const hipY = (cfg.hipY ?? pr.leg) * s;
  const P = [bx, hipY];
  const lean = cfg.lean || 0;
  const td = side ? [f * Math.sin(lean), Math.cos(lean)] : [Math.sin(cfg.sway || 0), Math.cos(cfg.sway || 0)];
  const fn = side ? [f * Math.cos(lean), -Math.sin(lean)] : [1, 0];
  const C = add(P, mul(td, pr.torso * s));
  const N = add(C, mul(td, pr.neck * s));
  const tilt = cfg.tilt || 0;
  const hs = pr.head * s;
  const hd = side ? [f * Math.sin(lean + tilt), Math.cos(lean + tilt)] : rot(td, -(cfg.tiltX || 0));
  const Hc = add(N, mul(hd, hs * 0.46));
  const sleeve = d.kind === "coat" ? M.coat : d.kind === "dress" ? M.dress : M.top;
  const at = (o, x, y) => add(add(o, mul(fn, x * s)), mul(td, y * s));
  const ink = "#2a1c22";
  const j = { P, C, N, Hc, hs, s, f, td, view, items, z: zb };

  const leg = (hip, target, z, bend, dir = side ? f : hip[0] < P[0] ? -1 : 1) => {
    const l1 = pr.leg * 0.53 * s;
    const l2 = pr.leg * 0.47 * s;
    const { mid, end } = side ? ik(hip, target, l1, l2, bend) : { mid: add(lerp(hip, target, 0.5), [(hip[0] - P[0]) * 0.08, 0]), end: target };
    const tk = l1 / (l1 + l2);
    const bare = [[0, 0.054 * lw], [0.18, 0.048 * lw], [tk - 0.06, 0.034 * lw], [tk, 0.031 * lw], [tk + 0.12, 0.035 * lw], [0.88, 0.02 * lw], [1, 0.018 * lw]].map(([t, r]) => [t, r * s]);
    if (d.kind === "dress" || d.shorts) put(sweep([hip, mid, end], bare), M.skin, z, { axis: [hip, end] });
    if (d.kind !== "dress") {
      if (d.shorts) put(sweep([hip, lerp(hip, mid, 0.85)], [[0, 0.06 * s], [1, 0.05 * s]]), M.bottom, z + 0.02, { axis: [hip, mid] });
      else put(sweep([hip, mid, end], [[0, 0.06], [0.2, 0.052], [tk, 0.04], [1, 0.037]].map(([t, r]) => [t, r * s * Math.max(1, lw * 0.95)])), M.bottom, z + 0.02, { axis: [hip, end] });
    }
    const front = side || three;
    const shoe = front ? [[-0.03, 0.02], [-0.04, -0.012], [-0.025, -0.03], [0.09, -0.03], [0.12, -0.018], [0.112, 0.0], [0.06, 0.016], [0.01, 0.034]].map(([x, y]) => add(end, [dir * x * s * (three ? 0.75 : 1), y * s])) : ring(add(end, [0, -0.012 * s]), 0.032 * s, 0.022 * s);
    put(shoe, M.shoe, z + 0.05, { axis: [add(end, [0, 0.02 * s]), add(end, [0, -0.03 * s])] });
    return { knee: mid, ankle: end };
  };

  const arm = (S, target, z, bend) => {
    const l1 = pr.upper * s;
    const l2 = pr.fore * s;
    const { mid, end } = ik(S, target, l1, l2, bend);
    const te = l1 / (l1 + l2);
    const bare = [[0, 0.034 * lw], [0.2, 0.03 * lw], [te - 0.05, 0.023 * lw], [te, 0.021 * lw], [te + 0.15, 0.024 * lw], [1, 0.015 * lw]].map(([t, r]) => [t, r * s]);
    const long = d.sleeve > 0.7;
    const bareArm = !long || (d.kind === "dress" && d.sleeve < 0.3);
    if (bareArm) put(sweep([S, mid, end], bare), M.skin, z, { axis: [S, end] });
    if (long) {
      put(sweep([S, mid, end], [[0, 0.04], [te, 0.03], [0.93, 0.027], [1, 0.029]].map(([t, r]) => [t, r * s])), sleeve, z + 0.02, { axis: [S, end] });
      // a fold where the sleeve bends at the elbow
      const inner = add(mid, mul(unit(add(unit(sub(S, mid)), unit(sub(end, mid)))), 0.018 * s));
      if (Math.hypot(...sub(inner, mid)) > 0) line([lerp(mid, inner, 0.2), inner, add(inner, mul(unit(sub(end, mid)), 0.025 * s))], ink, 0.006 * s, z + 0.03, { alpha: 0.45 });
    } else if (!(d.kind === "dress" && d.sleeve < 0.3)) put(sweep([S, lerp(S, mid, 0.62)], [[0, 0.041 * s], [1, 0.035 * s]]), sleeve, z + 0.02, { axis: [S, mid] });
    const dir = unit(sub(end, mid));
    const nrm = [-dir[1], dir[0]];
    const palm = [[-0.005, 0.014], [0.03, 0.018], [0.058, 0.016], [0.076, 0.01], [0.068, 0.006], [0.08, 0.002], [0.072, -0.002], [0.077, -0.007], [0.067, -0.009], [0.068, -0.013], [0.044, -0.016], [0, -0.014]].map(([u, v]) => add(add(end, mul(dir, u * s)), mul(nrm, v * s * bend)));
    put(palm, M.skin, z + 0.05, { axis: [end, add(end, mul(dir, 0.08 * s))] });
    put(ring(add(add(end, mul(dir, 0.026 * s)), mul(nrm, 0.016 * s * bend)), 0.016 * s, 0.0075 * s, Math.atan2(dir[1], dir[0]) + 0.6 * bend, 10), M.skin, z + 0.06, { axis: [end, add(end, mul(dir, 0.04 * s))] });
    return { elbow: mid, wrist: end };
  };

  const coatHem = d.kind === "coat" ? -0.18 : -0.035;
  if (side) {
    const legs = cfg.legs || { near: [0.03, 0.02], far: [-0.03, 0.02] };
    j.near = leg(P, add([P[0], 0], [f * legs.near[0] * s, legs.near[1] * s]), 8, f);
    j.far = leg(P, add([P[0], 0], [f * legs.far[0] * s, legs.far[1] * s]), 1, f);
    const front = [[0.068, -0.05], [0.08, 0.03], [0.068, 0.12], [0.09 + pr.bust, 0.2], [0.072, 0.27], [0.04, 0.3]];
    const back = [[-0.035, 0.31], [-0.068, 0.28], [-0.082, 0.2], [-0.062, 0.12], [-0.094, 0.03], [-0.072, -0.06], [0, -0.075]];
    put([...front, ...back].map(([x, y]) => at(P, x, y)), M.skin, 3, { center: at(P, 0, 0.15), r: 0.2 * s });
    const k = 1.12;
    const cloth = [[0.078, coatHem], [0.088, 0.03], [0.078, 0.12], [0.1 + pr.bust, 0.2], [0.084, 0.275], [0.048, 0.31], [-0.045, 0.32], [-0.08, 0.285], [-0.092, 0.2], [-0.074, 0.12], [-0.1 * k, 0.03], [-0.088 * k, coatHem - 0.01]];
    put(cloth.map(([x, y]) => at(P, x, y)), sleeve, 3.2, { center: at(P, 0, 0.15), r: 0.22 * s });
    if (d.kind !== "dress") put([[0.083, 0.0], [0.086, -0.07], [-0.098, -0.075], [-0.1, 0.02]].map(([x, y]) => at(P, x, y)), M.bottom, 3.1, { center: at(P, 0, -0.03), r: 0.1 * s });
    line([at(P, 0.045, 0.312), at(P, 0.062, 0.285), at(P, 0.082, 0.272)], ink, 0.006 * s, 3.25, { alpha: 0.6 });
    if (d.kind === "coat") line([at(P, 0.084, 0.27), at(P, 0.092, 0.1), at(P, 0.082, coatHem + 0.01)], ink, 0.006 * s, 3.25, { alpha: 0.5 });
    if (d.kind === "dress") {
      const hemY = Math.max(0.06, pr.leg * 0.42 * s - (pr.leg * s - hipY));
      const sway = (cfg.wind || 0) * 0.04;
      const hem = (u) => [P[0] + f * (0.3 * u - 0.16 - sway) * s, hemY + Math.sin(u * 9) * 0.006 * s];
      put([at(P, 0.075, 0.11), at(P, 0.082, 0), ...Array.from({ length: 8 }, (_, i) => hem(1 - i / 7)), at(P, -0.1, 0), at(P, -0.08, 0.11)], M.dress, 5, { center: at(P, 0, 0), r: 0.25 * s });
    }
  } else {
    const HL = add(P, [-pr.hip * 0.55 * s, -0.02 * s]);
    const HR = add(P, [pr.hip * 0.55 * s, -0.02 * s]);
    if (cfg.seated) put(ring(add(P, [0, -0.035 * s]), pr.hip * 1.38 * s, 0.075 * s, 0, 22), d.kind === "dress" ? M.dress : M.bottom, 1, { center: P, r: pr.hip * 1.4 * s });
    else {
      const step = cfg.step || 0;
      j.near = leg(HL, [HL[0] - 0.012 * s + (three ? -f * 0.01 * s : 0), (step > 0 ? 0.06 : 0) * s], three ? (f > 0 ? 1.5 : 1) : 1, 1, three ? f : undefined);
      j.far = leg(HR, [HR[0] + 0.012 * s + (three ? f * 0.015 * s : 0), (step < 0 ? 0.06 : 0) * s], three ? (f > 0 ? 1 : 1.5) : 1, 1, three ? f : undefined);
    }
    const sh = pr.shoulder;
    const prof = [[pr.hip, -0.04], [pr.hip * 1.02, 0.03], [pr.waist, 0.13], [pr.chest, 0.21], [sh * 1.04, 0.27], [sh * 0.8, 0.305], [0.04, 0.33]];
    // a three-quarter body turns its far side away: that half narrows and the chest shows on its contour
    const squeeze = (x, y) => (three && x * f > 0 ? x * 0.74 + (y > 0.14 && y < 0.26 ? f * pr.bust * 0.8 : 0) : x);
    const outline = (k, hemY) => [...prof.map(([x, y]) => [squeeze(x * k, y), Math.max(hemY, y)]), ...prof.slice().reverse().map(([x, y]) => [squeeze(-x * k, y), Math.max(hemY, y)])].map(([x, y]) => add(add(P, mul(rot([1, 0], cfg.sway || 0), x * s)), mul(td, y * s)));
    put(outline(1, -0.04), M.skin, 3, { center: add(P, mul(td, 0.15 * s)), r: 0.22 * s });
    put(outline(1.1, coatHem), sleeve, 3.2, { center: add(P, mul(td, 0.15 * s)), r: 0.24 * s });
    if (d.kind !== "dress" && !cfg.seated) put([[-pr.hip * 1.06, 0.02], [pr.hip * 1.06, 0.02], [pr.hip * 1.0, -0.08], [-pr.hip * 1.0, -0.08]].map(([x, y]) => add(P, [squeeze(x, 0) * s, y * s])), M.bottom, 3.1, { center: P, r: 0.12 * s });
    if (d.kind === "dress" && !cfg.seated) {
      const hemY = pr.leg * 0.4 * s;
      const low = hemY / s - pr.leg + 0.02;
      const edge = (k) => Array.from({ length: 4 }, (_, i) => [k * (pr.waist * 1.1 + (pr.hip * 1.7 - pr.waist * 1.1) * (i / 3) ** 0.8), 0.12 + (low - 0.12) * (i / 3)]);
      const hem = Array.from({ length: 7 }, (_, i) => [pr.hip * 1.7 * (1 - (2 * (i + 1)) / 8), low - Math.sin(((i + 1) / 8) * Math.PI) * 0.012]);
      put([...edge(-1), ...hem.reverse().map(([x, y]) => [-x, y]).reverse(), ...edge(1).reverse()].map(([x, y]) => add(P, [squeeze(x, 0.3) * s, y * s])), M.dress, 3.3, { center: P, r: 0.3 * s });
    }
    if (three) {
      const nk = add(C, [f * 0.012 * s, -0.008 * s]);
      line([add(nk, [-0.035 * s, 0.004 * s]), add(nk, [f * 0.004 * s, -0.035 * s]), add(nk, [0.03 * s, 0.002 * s])], ink, 0.006 * s, 3.25, { alpha: 0.6 });
      if (d.kind === "coat") line([add(nk, [f * 0.004 * s, -0.035 * s]), add(P, [f * 0.012 * s, (coatHem + 0.01) * s])], ink, 0.006 * s, 3.25, { alpha: 0.5 });
    } else line([add(C, [-0.04 * s, -0.01 * s]), add(C, [0, -0.02 * s]), add(C, [0.04 * s, -0.01 * s])], ink, 0.006 * s, 3.25, { alpha: 0.5 });
  }

  put(sweep([add(C, mul(td, -0.02 * s)), add(Hc, mul(hd, -hs * 0.3))], [[0, 0.03 * s], [1, 0.025 * s]]), M.skin, 5, { axis: [C, Hc] });
  const style = lk.style;
  const wind = cfg.wind || 0;
  const hairHex = lk.hair;
  const shine = lift(hairHex, 0.5);
  const brow = deepen(hairHex, 0.5);
  const shut = cfg.eyes === "closed";
  const happy = cfg.eyes === "happy";
  const girl = pr.f;
  const blush = "#f08a8a";

  if (side) {
    const a = Math.atan2(hd[1], hd[0]) - Math.PI / 2;
    const T = (x, y) => add(Hc, rot([f * x * hs, y * hs], a));
    const head = HEAD_SIDE.map(([x, y]) => T(x, y));
    put(head, M.skin, 6, { center: T(0.1, 0.1), r: hs * 0.55 });
    put(ring(T(-0.08, -0.02), hs * 0.065, hs * 0.105, a, 10), M.skin, 6.1, { center: T(-0.08, -0.02), r: hs * 0.1 });
    line([T(-0.05, 0.04), T(-0.1, 0.0), T(-0.06, -0.06)], ink, hs * 0.012, 6.12, { alpha: 0.5 });
    paint(ring(T(0.24, -0.13), hs * 0.085, hs * 0.035, a, 12), blush, 6.15, { alpha: 0.3, within: head });
    if (shut || happy) {
      line([T(0.17, 0.065), T(0.23, 0.03), T(0.3, 0.035), T(0.34, 0.06)], ink, hs * 0.03, 6.3);
      if (girl) line([T(0.2, 0.04), T(0.17, 0.0)], ink, hs * 0.016, 6.3);
    } else {
      const eye = [[0.18, 0.1], [0.255, 0.105], [0.315, 0.075], [0.33, 0.02], [0.3, -0.035], [0.23, -0.04], [0.19, -0.01]].map(([x, y]) => T(x, y));
      paint(eye, "#fbf7f2", 6.25);
      paint(ring(T(0.29, 0.025), hs * 0.036, hs * 0.07, a, 14), lk.eye, 6.26, { within: eye, grad: [deepen(lk.eye, 0.55), lk.eye] });
      paint(ring(T(0.296, 0.03), hs * 0.017, hs * 0.036, a, 10), deepen(lk.eye, 0.3), 6.27, { within: eye });
      paint(ring(T(0.282, 0.06), hs * 0.015, hs * 0.015, 0, 8), "#ffffff", 6.28, { within: eye });
      line([T(0.15, 0.12), T(0.24, 0.116), T(0.31, 0.088), T(0.342, 0.062)], ink, hs * (girl ? 0.036 : 0.028), 6.3);
      if (girl) line([T(0.17, 0.112), T(0.13, 0.14)], ink, hs * 0.018, 6.3);
      line([T(0.22, -0.045), T(0.29, -0.042)], ink, hs * 0.01, 6.3, { alpha: 0.6 });
    }
    line([T(0.17, 0.215), T(0.26, 0.232), T(0.34, 0.205)], brow, hs * 0.022, 6.3);
    line([T(0.425, -0.118), T(0.44, -0.124)], ink, hs * 0.01, 6.3, { alpha: 0.4 });
    line(cfg.smile ? [T(0.35, -0.22), T(0.375, -0.236), T(0.4, -0.226)] : [T(0.36, -0.232), T(0.397, -0.228)], "#8a4a4a", hs * 0.014, 6.3);
    if (lk.glasses) {
      line(ring(T(0.27, 0.03), hs * 0.075, hs * 0.07, a, 14).concat([ring(T(0.27, 0.03), hs * 0.075, hs * 0.07, a, 14)[0]]), "#3a3030", hs * 0.014, 6.35);
      line([T(0.2, 0.05), T(-0.05, 0.06)], "#3a3030", hs * 0.012, 6.35);
    }
    if (style !== "none") {
      const curly = style === "curly";
      const capBase = style === "receding" ? CAP_RECEDE : CAP_SIDE;
      const cap = capBase.map(([x, y], i) => (curly ? [x * 1.12 + Math.sin(i * 2.7) * 0.045, y * 1.1 + Math.cos(i * 3.1) * 0.045] : [x * 1.02, y * 1.02]));
      const capPts = cap.map(([x, y]) => T(x, y));
      if (style === "long") put([[-0.05, 0.58], [-0.42, 0.46], [-0.58, 0.18], [-0.64 - wind * 0.1, -0.3], [-0.68 - wind * 0.3, -0.95], [-0.62 - wind * 0.4, -1.32], [-0.54 - wind * 0.35, -1.12], [-0.46 - wind * 0.3, -1.34], [-0.38 - wind * 0.2, -1.1], [-0.31, -0.7], [-0.27, -0.25], [-0.2, 0.05]].map(([x, y]) => T(x, y)), M.hair, 4.9, { center: T(-0.45, -0.4), r: hs * 0.7 });
      if (style === "bob") put([[0.33, 0.37], [0.12, 0.62], [-0.25, 0.6], [-0.52, 0.37], [-0.62, 0.0], [-0.57, -0.32], [-0.44, -0.44], [-0.3, -0.36], [-0.16, -0.43], [0.02, -0.38], [0.07, -0.2], [0.1, 0.05], [0.16, 0.25]].map(([x, y]) => T(x, y)), M.hair, 6.9, { center: T(-0.15, 0.1), r: hs * 0.6 });
      if (style === "ponytail") {
        // a ponytail hangs with gravity, not with the tilt of the head
        const tie = T(-0.44, 0.3);
        const tail = [tie, add(tie, [-f * (0.16 + wind * 0.22) * hs, -0.24 * hs]), add(tie, [-f * (0.1 + wind * 0.45) * hs, -0.9 * hs])];
        put(sweep(tail, [[0, 0.1 * hs], [0.35, 0.14 * hs], [1, 0.02 * hs]], 14), M.hair, 6.95, { axis: [tail[0], tail[2]] });
        paint(ring(T(-0.46, 0.29), hs * 0.05, hs * 0.07, a, 10), lk.top, 7.05, { line: true });
      }
      if (style === "bun") put(ring(T(-0.38, 0.48), hs * 0.16, hs * 0.15, a, 16), M.hair, 6.95, { center: T(-0.38, 0.48), r: hs * 0.16 });
      put(capPts, M.hair, 7, { center: T(-0.1, 0.3), r: hs * 0.6 });
      if (style !== "receding") {
        if (style === "short" && !girl) put(lock(T, [0.08, 0.56], [0.3, 0.54], [0.44, 0.42], hs * 0.09), M.hair, 7.2, { axis: [T(0.08, 0.56), T(0.44, 0.42)] });
        else {
          put(lock(T, [0.16, 0.52], [0.34, 0.4], [0.41, 0.2], hs * 0.085), M.hair, 7.2, { axis: [T(0.16, 0.52), T(0.41, 0.2)] });
          put(lock(T, [0.06, 0.56], [0.25, 0.42], [0.31, 0.16], hs * 0.08), M.hair, 7.21, { axis: [T(0.06, 0.56), T(0.31, 0.16)] });
        }
        if (girl || style === "long" || style === "bob") put(lock(T, [0.02, 0.32], [0.08, 0.05], [0.12, style === "long" ? -0.45 : -0.22], hs * 0.07), M.hair, 7.15, { axis: [T(0.02, 0.32), T(0.12, -0.22)] });
        if (style === "short" || style === "ponytail" || style === "bun" || curly) {
          put(lock(T, [-0.42, 0.02], [-0.47, -0.15], [-0.4, -0.32], hs * 0.08), M.hair, 7.1, { axis: [T(-0.42, 0.02), T(-0.4, -0.32)] });
          put(lock(T, [-0.28, -0.05], [-0.31, -0.18], [-0.25, -0.31], hs * 0.06), M.hair, 7.1, { axis: [T(-0.28, -0.05), T(-0.25, -0.31)] });
        }
      }
      const band = [[-0.44, 0.24], [-0.3, 0.42], [-0.1, 0.52], [0.12, 0.52]].map(([x, y]) => T(x, y));
      line(band.slice(0, 3), shine, hs * 0.05, 7.3, { alpha: 0.55, within: capPts });
      if (!curly) line([T(-0.06, 0.58), T(-0.3, 0.45), T(-0.45, 0.2)], deepen(hairHex, 0.6), hs * 0.012, 7.3, { alpha: 0.5, within: capPts });
    }
  } else if (three) {
    const a = -(cfg.tiltX || 0);
    const T = (x, y) => add(Hc, rot([f * x * hs, y * hs], a));
    const head = HEAD_THREE.map(([x, y]) => T(x, y));
    put(ring(T(-0.42, -0.04), hs * 0.06, hs * 0.1, a, 10), M.skin, 5.95, { center: T(-0.42, -0.04), r: hs * 0.08 });
    put(head, M.skin, 6, { center: T(0.05, 0.05), r: hs * 0.55 });
    paint(ring(T(-0.12, -0.17), hs * 0.1, hs * 0.04, a, 12), blush, 6.15, { alpha: 0.3, within: head });
    paint(ring(T(0.27, -0.17), hs * 0.05, hs * 0.035, a, 12), blush, 6.15, { alpha: 0.3, within: head });
    const eye = (cx, cy, w, h, out) => {
      const E = (u, v) => T(cx + out * u * w, cy + v * h);
      if (shut) {
        line([E(-0.5, 0.08), E(0, -0.14), E(0.5, 0.08)], ink, hs * 0.03, 6.3);
        if (girl) line([E(0.4, 0.0), E(0.55, -0.12)], ink, hs * 0.015, 6.3);
        return;
      }
      if (happy) {
        line([E(-0.5, -0.06), E(0, 0.24), E(0.5, -0.06)], ink, hs * 0.032, 6.3);
        return;
      }
      const lid = [[-0.5, 0.05], [-0.3, 0.38], [0.0, 0.5], [0.3, 0.45], [0.52, 0.22]];
      const lower = [[0.45, -0.2], [0.2, -0.42], [-0.15, -0.42], [-0.45, -0.12]];
      const white = [...lid, ...lower].map(([u, v]) => E(u, v));
      paint(white, "#fbf7f2", 6.25);
      paint(ring(E(0.0, -0.02), hs * w * 0.34, hs * h * 0.47, a, 16), lk.eye, 6.26, { within: white, grad: [deepen(lk.eye, 0.5), lift(lk.eye, 0.15)] });
      paint(ring(E(0.0, 0.03), hs * w * 0.15, hs * h * 0.22, a, 12), deepen(lk.eye, 0.28), 6.27, { within: white });
      paint(ring(E(-0.12, 0.2), hs * w * 0.11, hs * w * 0.11, 0, 10), "#ffffff", 6.28, { within: white });
      paint(ring(E(0.15, -0.22), hs * w * 0.05, hs * w * 0.05, 0, 8), "#ffffff", 6.28, { within: white, alpha: 0.8 });
      line([...lid.map(([u, v]) => E(u, v)), E(0.62, 0.3)], ink, hs * (girl ? 0.04 : 0.032), 6.3);
      if (girl) line([E(0.45, 0.32), E(0.66, 0.42)], ink, hs * 0.018, 6.3);
      line([E(0.42, -0.24), E(0.18, -0.44)], ink, hs * 0.012, 6.3, { alpha: 0.6 });
    };
    eye(-0.1, -0.02, 0.25, 0.25, -1);
    eye(0.245, -0.02, 0.15, 0.24, 1);
    line([T(-0.25, 0.2), T(-0.11, 0.26), T(0.04, 0.245)], brow, hs * 0.022, 6.3);
    line([T(0.17, 0.245), T(0.27, 0.25), T(0.34, 0.215)], brow, hs * 0.018, 6.3);
    line([T(0.29, -0.13), T(0.31, -0.18), T(0.285, -0.2)], ink, hs * 0.012, 6.3, { alpha: 0.45 });
    line(cfg.smile ? [T(0.08, -0.31), T(0.16, -0.345), T(0.24, -0.315)] : [T(0.1, -0.33), T(0.17, -0.336), T(0.23, -0.326)], "#8a4a4a", hs * 0.016, 6.3);
    if (lk.glasses) {
      for (const [cx, w] of [[-0.1, 0.17], [0.245, 0.11]]) line(ring(T(cx, -0.02), hs * w, hs * 0.13, a, 14).concat([ring(T(cx, -0.02), hs * w, hs * 0.13, a, 14)[0]]), "#3a3030", hs * 0.014, 6.35);
      line([T(0.07, 0.0), T(0.13, 0.0)], "#3a3030", hs * 0.012, 6.35);
    }
    if (style !== "none") {
      const curly = style === "curly";
      const cap = (style === "receding" ? CAP_THREE.map(([x, y]) => [x, y < 0.3 && x > -0.4 ? Math.max(y, 0.42) : y]) : CAP_THREE).map(([x, y], i) => (curly ? [x * 1.12 + Math.sin(i * 2.9) * 0.05, y * 1.08 + Math.cos(i * 2.3) * 0.05] : [x * 1.02, y * 1.02]));
      const capPts = cap.map(([x, y]) => T(x, y));
      const reach = style === "long" ? -1.25 : style === "bob" ? -0.48 : girl && style === "short" ? -0.3 : null;
      if (reach !== null) put([[-0.5, 0.35], [-0.62 - wind * 0.1, -0.1], [-0.66 - wind * 0.2, reach + 0.3], [-0.55 - wind * 0.2, reach], [-0.42, reach + 0.12], [-0.28, reach - 0.05], [0.18, reach - 0.02], [0.32, reach + 0.12], [0.46, reach], [0.55, reach + 0.35], [0.5, -0.1], [0.42, 0.3]].map(([x, y]) => T(x, y)), M.hair, 5.4, { center: T(0, -0.3), r: hs * 0.8 });
      if (style === "ponytail") {
        const tie = T(-0.36, 0.42);
        const tail = [tie, add(tie, [-f * (0.22 + wind * 0.2) * hs, -0.26 * hs]), add(tie, [-f * (0.2 + wind * 0.4) * hs, -0.98 * hs])];
        put(sweep(tail, [[0, 0.12 * hs], [0.35, 0.15 * hs], [1, 0.02 * hs]], 14), M.hair, 5.4, { axis: [tail[0], tail[2]] });
      }
      if (style === "bun") put(ring(T(-0.14, 0.62), hs * 0.16, hs * 0.14, a, 16), M.hair, 6.95, { center: T(-0.14, 0.62), r: hs * 0.16 });
      put(capPts, M.hair, 7, { center: T(0, 0.3), r: hs * 0.6 });
      if (style !== "receding") {
        const p = lk.part;
        const short = style === "short" && !girl;
        const bangs = short
          ? [[[-0.32, 0.5], [-0.34, 0.4], [-0.3, 0.26]], [[-0.1, 0.56], [-0.12, 0.42], [-0.06, 0.28]], [[0.1, 0.54], [0.16, 0.42], [0.2, 0.3]], [[0.27, 0.47], [0.34, 0.38], [0.36, 0.26]]]
          : [[[-0.36, 0.44], [-0.41, 0.28], [-0.37, 0.1]], [[-0.2, 0.53], [-0.24 + p, 0.32], [-0.19 + p, 0.12]], [[-0.02, 0.56], [-0.03 + p, 0.34], [0.03 + p, 0.14]], [[0.14, 0.53], [0.19 + p, 0.34], [0.2 + p, 0.16]], [[0.28, 0.46], [0.35, 0.3], [0.34, 0.14]]];
        bangs.forEach(([r0, m0, t0], i) => put(lock(T, r0, m0, t0, hs * (short ? 0.09 : 0.1)), M.hair, 7.2 + i * 0.005, { axis: [T(...r0), T(...t0)] }));
        if (girl || style === "long" || style === "bob") {
          const low = style === "long" ? -0.62 : -0.3;
          put(lock(T, [-0.44, 0.3], [-0.48, 0.0], [-0.4, low], hs * 0.09), M.hair, 7.15, { axis: [T(-0.44, 0.3), T(-0.4, low)] });
          put(lock(T, [0.36, 0.3], [0.41, 0.0], [0.35, low + 0.05], hs * 0.06), M.hair, 7.15, { axis: [T(0.36, 0.3), T(0.35, low)] });
        }
        line([T(-0.26, 0.15), T(0.0, 0.2), T(0.3, 0.16)], deepen(lk.skin, 0.8), hs * 0.05, 6.2, { alpha: 0.35, within: head });
      }
      line([T(-0.44, 0.34), T(-0.15, 0.5), T(0.18, 0.5)], shine, hs * 0.05, 7.35, { alpha: 0.5, within: capPts });
    }
  } else {
    const a = -(cfg.tiltX || 0);
    const T = (x, y) => add(Hc, rot([x * hs, y * hs], a));
    put(ring(Hc, hs * 0.4, hs * 0.5, a, 22), M.skin, 6, { center: add(Hc, [0, hs * 0.1]), r: hs * 0.5 });
    const earZ = style === "short" || style === "none" || style === "curly" || style === "receding" ? 7.2 : 5.9;
    for (const x of [-0.4, 0.4]) put(ring(T(x, -0.03), hs * 0.06, hs * 0.1, a, 10), M.skin, earZ, { center: Hc, r: hs * 0.1 });
    if (style !== "none") {
      const curly = style === "curly";
      const nape = style === "short" || curly || style === "receding" ? -0.32 : -0.44;
      const cap = ring([0, 0.05], curly ? 0.52 : 0.43, style === "short" ? 0.52 : 0.55, 0, 28).map(([x, y], i) => [x + (curly ? Math.cos(i * 2.3) * 0.045 : 0), Math.max(nape + (Math.abs(Math.sin(x * 14)) * -0.06), y + (curly ? Math.sin(i * 2.3) * 0.045 : 0))]);
      const capPts = cap.map(([x, y]) => T(x, y));
      if (style === "long") put([[-0.46, 0.1], [0.46, 0.1], [0.52 + wind * 0.2, -1.0], [0.4 + wind * 0.25, -1.28], [0.26 + wind * 0.25, -1.12], [0.1 + wind * 0.3, -1.32], [-0.08 + wind * 0.3, -1.12], [-0.24 + wind * 0.25, -1.3], [-0.4 + wind * 0.2, -1.14], [-0.52 + wind * 0.2, -1.0]].map(([x, y]) => T(x, y)), M.hair, 7, { center: T(0, -0.5), r: hs * 0.7 });
      if (style === "bob") put([[-0.5, 0.1], [0.5, 0.1], [0.54, -0.42], [0.3, -0.5], [0.0, -0.46], [-0.3, -0.5], [-0.54, -0.42]].map(([x, y]) => T(x, y)), M.hair, 7, { center: Hc, r: hs * 0.5 });
      put(capPts, M.hair, 7.02, { center: add(Hc, [0, hs * 0.2]), r: hs * 0.55 });
      if (style === "ponytail") put(sweep([T(0, 0.15), T(wind * 0.4, -0.5), T(wind, -1.05)], [[0, 0.14 * hs], [0.4, 0.13 * hs], [1, 0.03 * hs]], 14), M.hair, 7.5, { axis: [Hc, T(0, -1)] });
      if (style === "bun") put(ring(T(0, 0.55), hs * 0.16, hs * 0.14, 0, 16), M.hair, 7.5, { center: T(0, 0.55), r: hs * 0.15 });
      line([T(-0.3, 0.34), T(0, 0.42), T(0.3, 0.34)], shine, hs * 0.05, 7.3, { alpha: 0.5, within: capPts });
    }
  }
  j.S = side ? add(C, [-f * 0.012 * s, -0.012 * s]) : null;
  j.SL = add(C, [-pr.shoulder * s * 0.86 * (three && f > 0 ? 1 : three ? 0.74 : 1), -0.035 * s]);
  j.SR = add(C, [pr.shoulder * s * 0.86 * (three && f < 0 ? 1 : three ? 0.74 : 1), -0.035 * s]);
  j.arm = arm;
  return j;
}

function low(items) {
  let lo = Infinity;
  for (const it of items) if (it.mat === M.shoe || it.foot) for (const p of it.pts) lo = Math.min(lo, p[1]);
  return lo === Infinity ? 0 : lo;
}

function move(items, fn) {
  for (const it of items) {
    it.pts = it.pts.map(fn);
    if (it.within) it.within = it.within.map(fn);
    if (it.shade?.axis) it.shade.axis = it.shade.axis.map(fn);
    if (it.shade?.center) it.shade.center = fn(it.shade.center);
  }
}

const shift = (items, dy) => move(items, ([x, y]) => [x, y - dy]);

// a bicycle in side view, sized for an adult or a child, returning where hands, seat and pedals go
function bicycle(f, child, frame) {
  const k = child ? 0.72 : 1;
  const R = 0.19 * k;
  const base = 0.58 * k;
  const rear = [-f * base * 0.45, R];
  const front = [f * base * 0.55, R];
  const bb = [-f * base * 0.04, R * 0.82];
  const seat = [-f * base * 0.2, (child ? 0.43 : 0.47) * k];
  const head = [f * base * 0.4, 0.42 * k];
  const bar = [f * base * 0.36, 0.52 * k];
  const items = [];
  const tube = (pts, w, hex = frame) => items.push({ kind: "line", pts, hex, width: w, z: 2, mat: M.object });
  for (const c of [rear, front]) {
    const tire = ring(c, R, R, 0, 28);
    tube([...tire, tire[0]], 0.03 * k, "#1f1d22");
    const rim = ring(c, R * 0.86, R * 0.86, 0, 28);
    tube([...rim, rim[0]], 0.006 * k, "#9a9aa0");
    for (let i = 0; i < 8; i++) tube([c, add(c, rot([R * 0.86, 0], (i / 8) * Math.PI))], 0.0025 * k, "#b8b8bc");
  }
  tube([rear, bb, lerp(bb, seat, 0.92)], 0.016 * k);
  tube([rear, lerp(bb, seat, 0.8)], 0.012 * k);
  tube([lerp(bb, seat, 0.82), head], 0.016 * k);
  tube([bb, lerp(head, front, 0.1)], 0.018 * k);
  tube([head, front], 0.014 * k);
  tube([head, bar, add(bar, [-f * 0.05 * k, 0])], 0.012 * k, "#3a3a3a");
  items.push({ kind: "path", pts: [add(seat, [-f * 0.06 * k, 0.01 * k]), add(seat, [f * 0.07 * k, 0.012 * k]), add(seat, [f * 0.08 * k, -0.006 * k]), add(seat, [-f * 0.05 * k, -0.014 * k])], hex: "#2a2422", mat: M.object, z: 2.1, line: true });
  const ringPts = ring(bb, 0.04 * k, 0.04 * k, 0, 14);
  tube([...ringPts, ringPts[0]], 0.008 * k, "#6a6a70");
  return { items, seat, bar, bb, crank: 0.085 * k, rear, front };
}

// an object in someone's hand, drawn from the director's flat shapes at its real size; anchor is where the hand grips it in the shape box
function heldItems(t, hand, f, z, up) {
  const w = (t.size?.w || 0.25) * UNIT;
  const h = (t.size?.h || 0.25) * UNIT;
  const kind = `${t.kind} ${t.label}`.toLowerCase();
  const [ax, ay] = /\brod\b|fishing|pole/.test(kind) ? [0.02, 0.98] : /icecream|ice cream|cone/.test(kind) ? [0.5, 0.85] : up ? [0.5, 0.97] : [0.5, 0.55];
  const tilt = /baby/.test(kind) ? -f * 0.28 : 0;
  const P = (u, v) => add(hand, rot([f * (u - ax) * w, (ay - v) * h], tilt));
  const items = [];
  for (const sh of t.shapes || []) {
    const hex = /^#[0-9a-f]{6}$/i.test(sh.color || "") ? sh.color : "#8a7a6a";
    const base = { mat: M.object, hex, z, line: true };
    if (sh.type === "rect") items.push({ kind: "path", pts: [P(sh.x, sh.y), P(sh.x + sh.w, sh.y), P(sh.x + sh.w, sh.y + sh.h), P(sh.x, sh.y + sh.h)].flatMap((p, i, all) => [p, lerp(p, all[(i + 1) % 4], 0.5)]), ...base });
    else if (sh.type === "ellipse") items.push({ kind: "path", pts: ring(P(sh.x, sh.y), (sh.w * w) / 2, (sh.h * h) / 2, 0, 18), ...base });
    else if (sh.type === "circle") items.push({ kind: "path", pts: ring(P(sh.x, sh.y), (sh.w * w) / 2, (sh.w * w) / 2, 0, 16), ...base });
    else if (sh.type === "ring") {
      const pts = ring(P(sh.x, sh.y), (sh.w * w) / 2, (sh.w * w) / 2, 0, 16);
      items.push({ kind: "line", pts: [...pts, pts[0]], hex, width: Math.max(w, h) * 0.06, z, mat: M.object });
    } else if (sh.type === "tri") items.push({ kind: "path", pts: [P(sh.x + sh.w / 2, sh.y), P(sh.x + sh.w, sh.y + sh.h), P(sh.x, sh.y + sh.h)], ...base });
    else if (sh.type === "line") items.push({ kind: "line", pts: (sh.points || []).map(([u, v]) => P(u, v)), hex, width: Math.max(0.004, (sh.w || 0.02) * w), z, mat: M.object });
    else if ((sh.points || []).length > 2) items.push({ kind: "path", pts: sh.points.map(([u, v]) => P(u, v)), ...base });
  }
  return items;
}

// arms that hold an object: both hands together in front, or one hand raised for an umbrella or a balloon
function hold(J, t, view) {
  const up = /umbrella|balloon|kite|sparkler/.test(`${t.kind} ${t.label}`.toLowerCase());
  const s = J.s;
  const f = J.f;
  if (view === "side") {
    const reach = up ? add(J.S, [f * 0.07 * s, 0.13 * s]) : add(J.S, [f * 0.17 * s, -0.09 * s]);
    const near = J.arm(J.S, reach, 9, up ? f : -f);
    J.arm(J.S, up ? add(J.S, [-f * 0.03 * s, -0.31 * s]) : add(reach, [f * 0.01 * s, -0.012 * s]), 0.5, -f);
    const grip = add(near.wrist, mul(unit(sub(near.wrist, near.elbow)), 0.03 * s));
    J.items.push(...heldItems(t, grip, f, J.z + (up ? 9.1 : 8.9), up));
    return;
  }
  const mid = add(J.C, [f * 0.01 * s, -0.12 * s]);
  if (/baby/.test(`${t.kind} ${t.label}`.toLowerCase())) {
    const a = J.arm(J.SL, add(mid, [-0.07 * s, 0.01 * s]), 4, -1);
    const b = J.arm(J.SR, add(mid, [0.07 * s, -0.015 * s]), 4, 1);
    if (view === "three") J.items.push(...heldItems(t, add(lerp(a.wrist, b.wrist, 0.5), [0, 0.03 * s]), f, J.z + 3.9, false));
    return;
  }
  if (up) {
    const near = J.arm(f > 0 ? J.SR : J.SL, add(f > 0 ? J.SR : J.SL, [f * 0.06 * s, 0.14 * s]), 9, f);
    J.arm(f > 0 ? J.SL : J.SR, add(f > 0 ? J.SL : J.SR, [-f * 0.03 * s, -0.31 * s]), view === "three" ? 2.8 : 2.9, -f);
    if (view === "three" || view === "back") J.items.push(...heldItems(t, add(near.wrist, [0, 0.02 * s]), f, J.z + 9.1, true));
    return;
  }
  const a = J.arm(J.SL, add(mid, [-0.035 * s, 0]), 4, -1);
  const b = J.arm(J.SR, add(mid, [0.035 * s, 0]), 4, 1);
  if (view === "three") J.items.push(...heldItems(t, lerp(a.wrist, b.wrist, 0.5), f, J.z + 3.9, false));
}

// one arm raised high with the hand open: waving hello or goodbye
function wave(J, view) {
  const s = J.s;
  const f = J.f;
  if (view === "side") {
    J.arm(J.S, add(J.S, [f * 0.15 * s, 0.22 * s]), 9, -f);
    J.arm(J.S, add(J.S, [-f * 0.02 * s, -0.31 * s]), 0.5, -f);
    return;
  }
  const up = f > 0 ? J.SR : J.SL;
  const down = f > 0 ? J.SL : J.SR;
  J.arm(up, add(up, [f * 0.17 * s, 0.2 * s]), 4, -f);
  J.arm(down, add(down, [-f * 0.03 * s, -0.31 * s]), view === "three" ? 2.8 : 2.9, -f);
}

function scene(plan, seed, wind) {
  const r = random((seed ^ 0x6f1d2) >>> 0);
  const pose = plan.people.pose;
  const count = plan.people.count;
  const subjects = Array.from({ length: count }, (_, i) => plan.people.subjects[i] || {});
  const sexes = subjects.map((x, i) => (x.gender === "woman" ? "f" : x.gender === "man" ? "m" : random((seed ^ (0x9e37 + i * 977)) >>> 0)() < 0.5 ? "f" : "m"));
  const { place, time, weather } = plan.setting;
  const ctx = { pose, cold: weather === "snow" || place === "snow" || place === "mountains" || time === "night", wet: weather === "rain", warm: ["sea", "field", "garden", "desert"].includes(place) && time !== "night" };
  // the memory itself feeds who these people look like, so two memories on one seed don't share a cast
  const ls = (seed ^ hash(String(plan.text || ""))) >>> 0;
  const prs = subjects.map((x, i) => shape(sexes[i], x, random((ls ^ (0x1234 + i * 7919)) >>> 0)));
  const lks = subjects.map((x, i) => look(x, sexes[i], ctx, random((ls ^ (0x4321 + i * 104729)) >>> 0), i, ls));
  if (lks[1] && !subjects[1].clothColor) {
    const worn = (lk) => (lk.dressing.kind === "coat" ? lk.coat : lk.dressing.kind === "dress" ? lk.dress : lk.top);
    const far = CLOTH.filter((c) => gap(c, worn(lks[0])) > 130);
    const pick = far[Math.floor(random((ls ^ 0x51c) >>> 0)() * far.length)];
    if (pick && gap(worn(lks[1]), worn(lks[0])) < 130) lks[1].top = lks[1].coat = lks[1].dress = pick;
  }
  const coin = r.chance(0.5) ? 1 : -1;
  const f = plan.people.face || coin;
  const text = String(plan.text || "").toLowerCase();
  const asleep = /\b(asleep|sleep\w*|nap\w*|dozing)\b/.test(text);
  const glad = ["joyful", "electric"].includes(plan.mood) || /\b(laugh\w*|smil\w*|happy|giggl\w*)\b/.test(text);
  const eyes = asleep ? "closed" : glad && r.chance(0.4) ? "happy" : "open";
  const watching = Boolean(plan.people.toward);
  const seat = plan.people.seat || 0;
  const out = [];
  let view = "side";

  if (pose === "embrace" && count === 2) {
    if (prs[1].h > prs[0].h) prs[1].h = prs[0].h * r.range(0.94, 0.99);
    const tall = prs[0].h >= prs[1].h ? 0 : 1;
    const cfg = [0, 1].map((i) => ({ lean: i === tall ? r.range(0.06, 0.12) : r.range(0, 0.04), tilt: i === tall ? r.range(0.15, 0.3) : r.range(-0.2, -0.05), wind, eyes: "closed", legs: { near: [r.range(-0.02, 0.06), 0], far: [r.range(-0.08, 0), i === tall ? 0 : r.range(0, 0.08)] } }));
    const A0 = person("side", prs[0], lks[0], f, 0, cfg[0], 0);
    const B0 = person("side", prs[1], lks[1], -f, 0, cfg[1], 10);
    const faceA = A0.Hc[0] + f * A0.hs * 0.4;
    const faceB = B0.Hc[0] - f * B0.hs * 0.4;
    const B = person("side", prs[1], lks[1], -f, faceA - faceB - f * 0.006, cfg[1], 10);
    const Af = person("side", prs[0], lks[0], f, 0, cfg[0], 0);
    Af.arm(Af.S, add(B.P, [f * 0.07 * B.s, 0.1 * B.s]), 30, -f);
    Af.arm(Af.S, add(B.P, [f * 0.03 * B.s, 0.16 * B.s]), 0.5, -f);
    B.arm(B.S, add(Af.N, [-f * 0.05 * Af.s, -0.03 * Af.s]), 19, f);
    B.arm(B.S, add(Af.C, [-f * 0.03 * Af.s, -0.05 * Af.s]), 0.5, f);
    out.push(Af, B);
  } else if (pose === "ride" && plan.people.mount) {
    const mt = plan.people.mount;
    const riders = plan.people.riders?.length ? plan.people.riders : [0];
    subjects.forEach((_, i) => {
      const k = riders.indexOf(i);
      const bx = mt.back[0] - mt.f * mt.gap * Math.max(0, k);
      const sz = prs[i].h;
      const seatY = mt.back[1] + 0.015;
      const J = person("side", prs[i], lks[i], mt.f, bx, { hipY: seatY / sz, lean: r.range(0.05, 0.14), tilt: r.range(-0.08, 0.06), eyes, smile: true, wind, legs: { near: [0.05, (seatY - 0.36 * sz) / sz], far: [0.03, (seatY - 0.34 * sz) / sz] } }, 10 + i * 10);
      for (const it of J.items) if (it.z - J.z < 2) it.z = 2.4 + (it.z - J.z) * 0.01;
      const reins = [mt.reins[0] - mt.f * mt.gap * Math.max(0, k), mt.reins[1]];
      J.arm(J.S, add(reins, [-mt.f * 0.02, 0.02]), 9, -mt.f);
      J.arm(J.S, add(reins, [-mt.f * 0.03, 0.01]), 2.45 - J.z, -mt.f);
      out.push(J);
    });
  } else if (pose === "ride") {
    const riders = plan.people.riders?.length ? plan.people.riders : [0];
    const bikes = [];
    subjects.forEach((_, i) => {
      if (!riders.includes(i)) return;
      const bx = bikes.length ? -f * 0.75 : 0;
      const bk = bicycle(f, prs[i].child, r.pick(["#b3402c", "#2f6f73", "#e0a458", "#5c7290", "#e58fa8"]));
      move(bk.items, ([x, y]) => [x + bx, y]);
      const sz = prs[i].h;
      const hip = add(bk.seat, [bx - f * 0.01, 0.025]);
      const turn = r.range(0, Math.PI * 2);
      const pedal = (k) => [bx + bk.bb[0] + Math.cos(turn + k) * bk.crank, bk.bb[1] + Math.sin(turn + k) * bk.crank];
      const to = (p) => [(f * (p[0] - hip[0])) / sz, p[1] / sz];
      const J = person("side", prs[i], lks[i], f, hip[0], { hipY: hip[1] / sz, lean: prs[i].child ? r.range(0.22, 0.3) : r.range(0.3, 0.42), tilt: -0.1, eyes, smile: true, wind: 0.5, legs: { near: to(pedal(0)), far: to(pedal(Math.PI)) } }, 10 + i * 10);
      bk.items.forEach((it) => J.items.push({ ...it, z: J.z + it.z }));
      J.arm(J.S, add(bk.bar, [bx, 0]), 9, -f);
      J.arm(J.S, add(bk.bar, [bx - f * 0.01, 0.005]), 0.5, -f);
      bikes.push({ i, J, bk, bx });
    });
    subjects.forEach((_, i) => {
      if (riders.includes(i)) return;
      const first = bikes[0];
      const bx = first ? first.bx + first.bk.rear[0] - f * r.range(0.12, 0.2) : 0;
      const J = person("side", prs[i], lks[i], f, bx, { lean: r.range(0.14, 0.22), tilt: 0.1, eyes, smile: true, wind, legs: { near: [0.16, 0], far: [-0.15, 0.04] } }, 0);
      if (first) J.arm(J.S, add(first.bk.seat, [first.bx - f * 0.05, -0.02]), 9, -f);
      else J.arm(J.S, add(J.S, [f * 0.1 * J.s, -0.28 * J.s]), 9, -f);
      J.arm(J.S, add(J.S, [-f * 0.1 * J.s, -0.28 * J.s]), 0.5, -f);
      shift(J.items, low(J.items));
      out.push(J);
    });
    out.push(...bikes.map((b) => b.J));
  } else if (pose === "crouch") {
    const J = person("side", prs[0], lks[0], f, 0, { hipY: 0.24, lean: r.range(0.42, 0.55), tilt: 0.25, eyes, smile: true, wind, legs: { near: [0.13, 0], far: [-0.17, 0] } }, 10);
    J.arm(J.S, add(J.P, [f * 0.4 * J.s, -0.1 * J.s]), 9, -f);
    J.arm(J.S, add(J.near.knee, [0, 0.02 * J.s]), 0.5, -f);
    shift(J.items, low(J.items));
    out.push(J);
    if (count === 2) {
      const K = person("side", prs[1], lks[1], f, -f * r.range(0.24, 0.32), { lean: prs[1].elder ? 0.14 : 0.06, tilt: 0.18, eyes, smile: true, wind, legs: { near: [0.05, 0], far: [-0.04, 0] } }, 0);
      K.arm(K.S, add(K.S, [f * 0.14 * K.s, -0.2 * K.s]), 9, -f);
      K.arm(K.S, add(K.P, [-f * 0.07 * K.s, 0.02 * K.s]), 0.5, -f);
      shift(K.items, low(K.items));
      out.push(K);
    }
  } else if (pose === "lie") {
    // lying on their backs one behind the other, heads the same way and faces turned up
    const dir = f;
    subjects.forEach((_, i) => {
      const J = person("side", prs[i], lks[i], -dir, 0, { tilt: -0.1, eyes: asleep ? "closed" : "open", smile: !asleep, wind: 0, legs: i ? { near: [0.03, 0], far: [-0.02, 0.01] } : { near: [0.16, 0.0], far: [-0.02, 0.01] } }, i ? 0 : 10);
      J.arm(J.S, add(J.Hc, [dir * 0.08 * J.s, 0.02 * J.s]), 9, dir);
      J.arm(J.S, add(J.P, [-dir * 0.03 * J.s, -0.02 * J.s]), 0.5, -dir);
      const pivot = J.P;
      const turn = ([x, y]) => add(pivot, rot(sub([x, y], pivot), (-dir * Math.PI) / 2));
      move(J.items, turn);
      J.Hc = turn(J.Hc);
      let lo = Infinity;
      for (const it of J.items) for (const p of it.pts) lo = Math.min(lo, p[1]);
      const dx = -J.Hc[0] - dir * i * 0.3 * J.s;
      const dy = -lo;
      move(J.items, ([x, y]) => [x + dx, y + dy]);
      J.Hc = [J.Hc[0] + dx, J.Hc[1] + dy];
      out.push(J);
    });
  } else if (pose === "sit" && count >= 1) {
    view = seat || watching ? "back" : r.chance(0.65) ? "back" : "side";
    if (view === "back") {
      const sep = (prs[0].shoulder * prs[0].h + (prs[1]?.shoulder || 0) * (prs[1]?.h || 0)) * 1.05 || 0;
      const lean = r.range(0.06, 0.14);
      const hipY = seat ? (seat + 0.02) / prs[0].h : 0.13;
      const A = person("back", prs[0], lks[0], 1, count === 2 ? -sep / 2 : 0, { hipY, seated: true, sway: count === 2 ? lean * 0.3 : 0, tiltX: count === 2 ? -0.05 : 0, wind }, 0);
      out.push(A);
      if (count === 2) {
        const B = person("back", prs[1], lks[1], 1, sep / 2, { hipY: seat ? (seat + 0.02) / prs[1].h : 0.13, seated: true, sway: -lean, tiltX: r.range(0.25, 0.45), wind }, 10);
        A.arm(A.SR, add(B.SR, [0.01 * B.s, 0.025 * B.s]), 30, -1);
        A.arm(A.SL, add(A.SL, [-0.04 * A.s, -0.3 * A.s]), 2.9, -1);
        B.arm(B.SR, add(B.SR, [0.04 * B.s, -0.3 * B.s]), 12.9, 1);
        out.push(B);
      } else {
        A.arm(A.SL, add(A.SL, [-0.04 * A.s, -0.3 * A.s]), 2.9, -1);
        A.arm(A.SR, add(A.SR, [0.04 * A.s, -0.3 * A.s]), 2.9, 1);
      }
    } else {
      const hug = r.chance(0.5);
      out.push(
        ...subjects.map((_, i) => {
          const legs = { near: [r.range(0.36, 0.44), 0.02], far: [r.range(0.3, 0.4), 0.02] };
          const J = person("side", prs[i], lks[i], f, i ? -f * r.range(0.16, 0.24) : 0, { hipY: 0.11, lean: hug ? r.range(0.15, 0.3) : r.range(-0.12, 0.05), tilt: asleep ? 0.45 : r.range(-0.1, 0.15), eyes, smile: glad, wind, legs }, i ? 0 : 10);
          if (hug) {
            J.arm(J.S, add(J.near.knee, [-f * 0.02 * J.s, -0.03 * J.s]), 9, -f);
            J.arm(J.S, add(J.far.knee, [-f * 0.02 * J.s, -0.05 * J.s]), 0.5, -f);
          } else {
            J.arm(J.S, [J.P[0] - f * 0.14 * J.s, 0.01], 9, f);
            J.arm(J.S, [J.P[0] - f * 0.12 * J.s, 0.01], 0.5, f);
          }
          return J;
        })
      );
    }
  } else if (pose === "run") {
    // stance leg pushing off behind, swing knee driven up in front, arms pumping opposite
    const runner = (i, bx, zb) => {
      const lead = r.chance(0.5);
      const hip = prs[i].leg * 0.93;
      const drive = [r.range(0.14, 0.2), hip - r.range(0.33, 0.38)];
      const push = [-r.range(0.17, 0.22), 0.01];
      const J = person("side", prs[i], lks[i], f, bx, { hipY: hip, lean: r.range(0.18, 0.28), tilt: -0.05, eyes: glad ? "happy" : "open", smile: true, wind: 0.8, legs: lead ? { near: drive, far: push } : { near: push, far: drive } }, zb);
      const front = [f * 0.17 * J.s, -0.07 * J.s];
      const back = [-f * 0.12 * J.s, -0.24 * J.s];
      J.arm(J.S, add(J.S, lead ? back : front), 9, -f);
      J.arm(J.S, add(J.S, lead ? front : back), 0.5, -f);
      shift(J.items, low(J.items));
      return J;
    };
    out.push(runner(0, 0, 10));
    if (count === 2) out.push(runner(1, -f * r.range(0.35, 0.9), 0));
  } else if (pose === "walk" || (pose === "stand" && count === 2)) {
    const held = (plan.things || []).find((t) => t.where === "hand");
    view = held ? "side" : watching ? "back" : pose === "walk" ? (r.chance(0.5) ? "side" : "back") : r.pick(["back", "three", "three"]);
    if (view === "back" || view === "three") {
      const sep = (prs[0].shoulder * prs[0].h + (prs[1]?.shoulder || prs[0].shoulder) * (prs[1]?.h || 1)) * (view === "three" ? 1.45 : 1.25);
      out.push(
        ...subjects.map((_, i) => {
          const facing = view === "three" ? (i ? -1 : 1) : 1;
          const J = person(view, prs[i], lks[i], facing, (i ? 1 : -1) * (count === 2 ? sep / 2 : 0), { step: pose === "walk" ? (i ? -1 : 1) : 0, tiltX: count === 2 ? (i ? 0.12 : -0.08) : 0, eyes, smile: true, wind }, i * 10);
          if (count === 2) J.arm(i ? J.SL : J.SR, [i ? 0.012 : -0.012, 0.45 * J.s], 4, i ? 1 : -1);
          const outer = i ? J.SR : J.SL;
          J.arm(outer, add(outer, [(i ? 0.03 : -0.03) * J.s, -0.31 * J.s]), view === "three" ? (facing * (i ? 1 : -1) > 0 ? 2.8 : 4) : 2.9, i ? 1 : -1);
          if (count === 1) J.arm(J.SR, add(J.SR, [0.03 * J.s, -0.31 * J.s]), view === "three" ? 4 : 2.9, 1);
          shift(J.items, low(J.items));
          return J;
        })
      );
    } else {
      out.push(
        ...subjects.map((_, i) => {
          const stride = pose === "walk" ? r.range(0.18, 0.26) : 0.03;
          const J = person("side", prs[i], lks[i], f, i ? -f * (held ? r.range(0.2, 0.3) : r.range(-0.08, 0.12)) : 0, { lean: pose === "walk" ? 0.05 : 0.01, tilt: r.range(-0.1, 0.1), eyes, smile: glad, wind, legs: { near: [stride, 0], far: [-stride * 0.9, pose === "walk" ? 0.05 : 0] } }, i ? 0 : 10);
          if (held && i === 0) hold(J, held, "side");
          else {
            J.arm(J.S, add(J.S, [-f * 0.1 * J.s, -0.3 * J.s]), 9, -f);
            J.arm(J.S, add(J.S, [f * 0.1 * J.s, -0.3 * J.s]), 0.5, -f);
          }
          shift(J.items, low(J.items));
          return J;
        })
      );
    }
  } else {
    const held = (plan.things || []).find((t) => t.where === "hand");
    view = held ? r.pick(["three", "three", "side"]) : /\bwav(e|ed|es|ing)\b/.test(text) ? r.pick(["three", "side"]) : watching ? (r.chance(0.75) ? "back" : "side") : r.pick(["three", "three", "back", "side"]);
    const tender = held && /baby/.test(`${held.kind} ${held.label}`.toLowerCase());
    const J = person(view, prs[0], lks[0], f, 0, { tilt: held && view === "side" ? 0.22 : r.range(-0.2, 0.05), tiltX: held ? r.range(-0.18, -0.08) * f : r.range(-0.1, 0.1), eyes: tender ? "happy" : eyes, smile: tender || glad || r.chance(0.5), wind, legs: { near: [0.04, 0], far: [-0.04, 0] } }, 0);
    if (held) hold(J, held, view);
    else if (/\bwav(e|ed|es|ing)\b/.test(text)) wave(J, view);
    else if (view === "side") {
      J.arm(J.S, add(J.S, [f * 0.02 * J.s, -0.31 * J.s]), 9, -f);
      J.arm(J.S, add(J.S, [-f * 0.02 * J.s, -0.31 * J.s]), 0.5, -f);
    } else {
      J.arm(J.SL, add(J.SL, [-0.03 * J.s, -0.31 * J.s]), view === "three" ? (f < 0 ? 2.8 : 4) : 2.9, -1);
      J.arm(J.SR, add(J.SR, [0.03 * J.s, -0.31 * J.s]), view === "three" ? (f > 0 ? 2.8 : 4) : 2.9, 1);
    }
    shift(J.items, low(J.items));
    out.push(J);
  }
  out.forEach((J, i) => J.items.forEach((it) => (it.person = i + 1)));
  return { people: out, looks: lks, view, pose };
}

function quadruped(b, f) {
  const B = b.build || {};
  const L = Math.max(0.2, Math.min(3, b.size || 0.6)) * UNIT;
  const legH = L * (0.24 + (B.legs ?? 0.5) * 0.4) * ((B.legs ?? 0.5) > 0.65 ? 1.12 : 1);
  const R = L * (0.12 + (B.body ?? 0.5) * 0.12);
  const neck = L * (0.16 + (B.neck ?? 0.4) * 0.5);
  const head = L * (0.22 + (B.head ?? 0.5) * 0.14);
  const snout = 0.15 + (B.snout ?? 0.5) * 0.55;
  const m = b.motion || "stand";
  const big = (B.legs ?? 0.5) > 0.65;
  const items = [];
  const put = (pts, mat, z, shade, extra = {}) => items.push({ kind: "path", pts, mat, z, shade, ...extra });
  // long-legged grazers carry a shorter barrel on taller legs than dogs and foxes do
  const span = big ? 0.38 : 0.5;
  let hip = [-f * L * span, legH];
  let sh = [f * L * span, legH + R * 0.15];
  if (m === "sit") {
    hip = [-f * L * 0.3, R * 0.9];
    sh = [f * L * 0.16, legH * 0.85 + R * 0.65];
  } else if (m === "lie") {
    hip = [-f * L * 0.5, R * 0.95];
    sh = [f * L * 0.5, R * 1.15];
  } else if (m === "run") {
    hip = [-f * L * (big ? 0.4 : 0.55), legH * (big ? 0.97 : 0.9)];
    sh = [f * L * (big ? 0.4 : 0.55), legH * (big ? 1.02 : 0.95)];
  }
  const ax = unit(sub(sh, hip));
  const up = [-ax[1] * f, ax[0] * f];
  const on = (o, u, v) => add(add(o, mul(ax, u)), mul(up, v));
  const body = [on(sh, R * 1.05, -R * 0.1), on(sh, R * 0.7, R * 0.8), on(sh, 0, R * 1.02), on(lerp(hip, sh, 0.5), 0, R * 0.92), on(hip, R * 0.1, R * 0.98), on(hip, -R * 0.75, R * 0.6), on(hip, -R * 0.95, -R * 0.1), on(hip, -R * 0.5, -R * 0.8), on(hip, R * 0.5, -R * 0.62), on(lerp(hip, sh, 0.55), 0, -R * 0.82), on(sh, -R * 0.1, -R * 0.95), on(sh, R * 0.8, -R * 0.7)];
  const leg = (top, target, z, bend, r1, front) => {
    const { mid, end } = ik(top, target, legH * 0.56, legH * 0.52, bend);
    put(sweep([top, mid, end], front ? [[0, r1], [0.4, r1 * 0.62], [0.55, r1 * 0.5], [1, r1 * 0.4]] : [[0, r1 * 1.25], [0.35, r1 * 0.8], [0.5, r1 * 0.48], [1, r1 * 0.4]]), A.fur, z, { axis: [top, end] });
    put(ring(add(end, [f * r1 * 0.3, r1 * 0.05]), r1 * 0.55, r1 * 0.32, 0, 10), A.fur2, z + 0.05, { center: end, r: r1 * 0.5 }, { foot: true });
  };
  const rl = R * 0.46;
  const T = {
    stand: [[0.05, 0], [-0.04, 0], [0.04, 0], [-0.06, 0]],
    walk: [[0.2, 0], [-0.12, 0.04], [-0.15, 0], [0.18, 0.04]],
    // long-legged animals gallop with a hind hoof planted and a foreleg folded; small ones bound fully stretched
    run: big ? [[0.36, 0.14], [0.06, 0.26], [0.04, 0], [-0.42, 0.16]] : [[0.5, 0.12], [0.3, 0.04], [-0.5, 0.18], [-0.25, 0.03]],
    sit: [[0.05, 0], [0.0, 0], [0.42, 0], [0.36, 0]],
    lie: [[0.55, 0.02], [0.45, 0.02], [0.32, 0.02], [0.22, 0.02]],
  }[m] || [[0.05, 0], [-0.04, 0], [0.04, 0], [-0.06, 0]];
  const tgt = (base, [dx, dy]) => [base[0] + f * dx * L, dy * L];
  const front = on(sh, -R * 0.1, -R * 0.35);
  const hind = on(hip, R * 0.15, -R * 0.2);
  leg(front, tgt(sh, T[1]), 1, -f, rl, true);
  leg(hind, tgt(hip, T[3]), 1, f, rl * 1.1, false);
  put(body, A.fur, 3, { center: on(lerp(hip, sh, 0.5), 0, R * 0.4), r: L * 0.6 });
  put([on(sh, R * 0.5, -R * 0.8), on(lerp(hip, sh, 0.55), 0, -R * 0.9), on(hip, R * 0.55, -R * 0.74), on(lerp(hip, sh, 0.5), 0, -R * 0.66)], A.fur2, 3.05, { center: lerp(hip, sh, 0.5), r: L * 0.4 }, { line: false });
  if (m === "sit") put(ring(on(hip, R * 0.05, R * 0.05), R * 0.95, R * 0.8, Math.atan2(ax[1], ax[0]), 16), A.fur, 3.1, { center: hip, r: R });
  leg(front, tgt(sh, T[0]), 6, -f, rl, true);
  leg(hind, tgt(hip, T[2]), 6, f, rl * 1.1, false);
  const na = m === "run" ? ((B.legs ?? 0.5) > 0.65 ? 0.62 : 0.35) : m === "lie" ? 0.75 : m === "sit" ? 0.95 : 0.85;
  const nb = on(sh, R * 0.35, R * 0.3);
  const nt = add(nb, [f * Math.cos(na) * neck, Math.sin(na) * neck]);
  put(sweep([nb, lerp(nb, nt, 0.5), nt], [[0, R * 0.72], [0.6, R * 0.52], [1, R * 0.46]]), A.fur, 4, { axis: [nb, nt] });
  const hc = add(nt, [f * head * 0.2, head * 0.05]);
  // grazers hold a long blunt face angled down; hunters and pets keep a level, tapered muzzle
  const grazer = /horse|pony|donkey|cow|calf|deer|fawn|doe|stag|sheep|lamb|goat|moose|elk/.test(`${b.kind} ${b.label}`);
  const tip = grazer ? -0.55 : 0;
  const hp = (x, y) => add(hc, rot([f * x * head, y * head], f * tip * Math.min(1, Math.max(0, x + 0.2))));
  const face = grazer ? [[-0.5, 0.02], [-0.4, 0.34], [0, 0.44], [0.36, 0.3], [0.5 + snout * 0.6, 0.18], [0.56 + snout * 0.8, 0.06], [0.56 + snout * 0.82, -0.16], [0.44 + snout * 0.7, -0.26], [0.12 + snout * 0.3, -0.3], [-0.2, -0.3], [-0.45, -0.18]] : [[-0.5, 0.02], [-0.4, 0.34], [0, 0.46], [0.32, 0.32], [0.36 + snout * 0.6, 0.08], [0.42 + snout * 0.75, -0.06], [0.36 + snout * 0.72, -0.2], [0.12 + snout * 0.3, -0.27], [-0.2, -0.3], [-0.45, -0.18]];
  put(face.map(([x, y]) => hp(x, y)), A.fur, 5, { center: hp(0, 0.1), r: head * 0.6 });
  put(ring(grazer ? hp(0.5 + snout * 0.74, -0.06) : hp(0.42 + snout * 0.72, -0.05), head * 0.07, head * 0.06, 0, 8), A.dark, 5.2, { center: hp(0.4, 0), r: head * 0.05 });
  if (b.asleep) items.push({ kind: "line", pts: [hp(0.06, 0.13), hp(0.14, 0.09), hp(0.22, 0.13)], hex: "#1b1512", width: head * 0.05, z: 5.3 });
  else {
    put(ring(hp(0.14, 0.13), head * 0.062, head * 0.055, 0, 10), A.dark, 5.3, { center: hp(0.14, 0.13), r: head * 0.04 });
    items.push({ kind: "path", pts: ring(hp(0.12, 0.155), head * 0.018, head * 0.018, 0, 8), hex: "#ffffff", mat: A.dark, z: 5.31, line: false });
  }
  const ears = B.ears || "pointed";
  const tall = b.kind && /rabbit|hare/.test(b.kind) ? 1.45 : 0.8;
  if (ears === "pointed") {
    put([hp(-0.05, 0.3), hp(-0.12, tall), hp(-0.28, 0.3)], A.fur, 5.4, { center: hp(-0.15, 0.5), r: head * 0.2 });
    put([hp(-0.22, 0.28), hp(-0.32, tall * 0.92), hp(-0.42, 0.25)], A.fur, 4.9, { center: hp(-0.3, 0.5), r: head * 0.2 });
  } else if (ears === "floppy") put([hp(-0.12, 0.3), hp(-0.35, 0.22), hp(-0.42, -0.25), hp(-0.3, -0.38), hp(-0.2, -0.05)], A.fur2, 5.4, { center: hp(-0.3, 0), r: head * 0.25 });
  else if (ears === "round") put(ring(hp(-0.14, 0.42), head * 0.17, head * 0.15, 0, 10), A.fur, 5.4, { center: hp(-0.14, 0.42), r: head * 0.15 });
  if (/horse|pony/.test(`${b.kind} ${b.label}`)) {
    const crest = [lerp(nb, nt, 0.0), lerp(nb, nt, 0.5), nt].map((p) => add(p, mul(unit([-(nt[1] - nb[1]) * f, (nt[0] - nb[0]) * f]), R * 0.42)));
    put(sweep(crest, [[0, R * 0.22], [0.6, R * 0.2], [1, R * 0.12]], 14), A.dark, 4.5, { axis: [crest[0], crest[2]] });
  }
  const tail = B.tail || "long";
  const lowTail = m === "sit" || m === "lie";
  const root = on(hip, -R * 0.75, R * 0.35);
  if (tail === "long" && big) put(sweep(lowTail ? [root, [hip[0] - f * L * 0.25, R * 0.3], [hip[0] - f * L * 0.35, R * 0.05]] : [root, on(hip, -L * 0.22, -L * 0.05), on(hip, -L * 0.35, -L * 0.32)], [[0, R * 0.22], [0.5, R * 0.3], [1, R * 0.08]]), A.dark, 2.9, { axis: [root, hip] });
  if (tail === "long" && !big) put(sweep(lowTail ? [root, [hip[0] - f * L * 0.3, R * 0.25], [hip[0] - f * L * 0.48, R * 0.12]] : [root, on(hip, -L * 0.28, -L * 0.02), on(hip, -L * 0.45, -L * 0.14)], [[0, R * 0.2], [1, R * 0.07]]), A.fur, 2.9, { axis: [root, hip] });
  if (tail === "bushy") put(sweep(lowTail ? [root, [hip[0] - f * L * 0.35, R * 0.35], [hip[0] - f * L * 0.6, R * 0.3]] : [root, on(hip, -L * 0.32, -L * 0.04), on(hip, -L * 0.6, -L * 0.08)], [[0, R * 0.25], [0.5, R * 0.42], [1, R * 0.16]]), A.fur, 2.9, { axis: [root, hip] });
  if (tail === "short") put(sweep([root, on(root, -L * 0.12, R * 0.3)], [[0, R * 0.17], [1, R * 0.1]]), A.fur, 2.9, { axis: [root, hip] });
  if (tail === "curled") put(sweep([root, on(root, -L * 0.1, R * 0.9), on(root, 0, R * 1.3)], [[0, R * 0.18], [1, R * 0.1]]), A.fur, 2.9, { axis: [root, hip] });
  return { items, head: hc, back: add(lerp(hip, sh, 0.58), mul(up, R * 0.92)), reins: lerp(nb, nt, 0.3), length: Math.abs(sh[0] - hip[0]) + R * 2 };
}

// a small animal asleep: curled into a loaf, head tucked on its paws, tail wrapped round the front
function curled(b, f) {
  const B = b.build || {};
  const L = Math.max(0.2, Math.min(1.2, b.size || 0.5)) * UNIT;
  const items = [];
  const put = (pts, mat, z, shade, extra = {}) => items.push({ kind: "path", pts, mat, z, shade, ...extra });
  const h = L * 0.42;
  const c = [-f * L * 0.08, h * 0.5];
  const body = Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * Math.PI * 2;
    const top = Math.sin(t) > 0 ? 1 : 0.92;
    return add(c, [Math.cos(t) * L * 0.4, Math.sin(t) * h * 0.5 * top + (Math.sin(t) > 0 ? Math.sin(t) * Math.cos(t) * f * h * 0.12 : 0)]);
  });
  put(body, A.fur, 3, { center: add(c, [0, h * 0.2]), r: L * 0.4 });
  put(ring(add(c, [f * L * 0.24, -h * 0.14]), L * 0.12, h * 0.2, 0, 14), A.fur2, 3.05, { center: c, r: L * 0.12 }, { line: false });
  const head = L * (0.2 + (B.head ?? 0.5) * 0.06);
  const hc = [f * L * 0.3, head * 0.7];
  put(ring(add(hc, [f * head * 0.25, -head * 0.42]), head * 0.45, head * 0.18, 0, 12), A.fur2, 3.9, { center: hc, r: head * 0.4 });
  const hp = (x, y) => add(hc, [f * x * head, y * head]);
  const snout = 0.1 + (B.snout ?? 0.4) * 0.45;
  put([[-0.5, 0.0], [-0.42, 0.34], [0, 0.46], [0.34, 0.3], [0.4 + snout * 0.5, 0.05], [0.42 + snout * 0.6, -0.12], [0.3 + snout * 0.4, -0.3], [0, -0.38], [-0.38, -0.3]].map(([x, y]) => hp(x, y)), A.fur, 4, { center: hp(0, 0.1), r: head * 0.6 });
  if ((B.ears || "pointed") === "pointed") {
    put([hp(-0.02, 0.32), hp(-0.1, 0.82), hp(-0.28, 0.3)], A.fur, 4.1, { center: hp(-0.12, 0.5), r: head * 0.2 });
    put([hp(-0.22, 0.28), hp(-0.36, 0.72), hp(-0.44, 0.18)], A.fur, 3.95, { center: hp(-0.3, 0.45), r: head * 0.2 });
  } else put([hp(-0.12, 0.3), hp(-0.38, 0.2), hp(-0.42, -0.25), hp(-0.25, -0.3)], A.fur2, 4.1, { center: hp(-0.3, 0), r: head * 0.25 });
  items.push({ kind: "line", pts: [hp(0.08, 0.1), hp(0.17, 0.05), hp(0.27, 0.1)], hex: "#1b1512", width: head * 0.06, z: 4.2 });
  put(ring(hp(0.42 + snout * 0.58, -0.1), head * 0.06, head * 0.05, 0, 8), A.dark, 4.2, { center: hp(0.4, 0), r: head * 0.04 });
  const root = add(c, [-f * L * 0.38, h * 0.1]);
  put(sweep([root, add(c, [-f * L * 0.3, -h * 0.42]), add(c, [f * L * 0.1, -h * 0.5]), add(c, [f * L * 0.38, -h * 0.4])], [[0, h * 0.13], [0.5, h * 0.12], [1, h * 0.06]], 24), A.fur, 4.3, { axis: [root, add(c, [f * L * 0.38, -h * 0.4])] });
  return { items, head: hc };
}

function avian(b, f) {
  const L = Math.max(0.08, Math.min(1.6, b.size || 0.35)) * UNIT;
  const m = b.motion || "stand";
  const items = [];
  const put = (pts, mat, z, shade, extra = {}) => items.push({ kind: "path", pts, mat, z, shade, ...extra });
  const swim = m === "swim";
  const fly = m === "fly";
  const c = [0, swim ? L * 0.1 : fly ? L * 1.2 : L * 0.42];
  const bp = (x, y) => add(c, [f * x * L, y * L]);
  put([[0.42, 0.12], [0.3, 0.27], [0, 0.3], [-0.35, 0.22], [-0.62, 0.12], [-0.66, 0.04], [-0.4, -0.14], [0, -0.26], [0.32, -0.16]].map(([x, y]) => bp(x, y)), A.fur, 3, { center: bp(0, 0.1), r: L * 0.5 });
  const hc = bp(0.42, swim ? 0.42 : 0.34);
  put(sweep([bp(0.3, 0.1), hc], [[0, L * 0.15], [1, L * 0.12]]), A.crown, 3.5, { axis: [bp(0.3, 0.1), hc] });
  put(ring(hc, L * 0.16, L * 0.14, 0, 14), A.crown, 4, { center: hc, r: L * 0.15 });
  put([add(hc, [f * L * 0.1, L * 0.03]), add(hc, [f * L * 0.32, -L * 0.04]), add(hc, [f * L * 0.1, -L * 0.07])], A.beak, 4.1, { center: hc, r: L * 0.1 });
  put(ring(add(hc, [f * L * 0.05, L * 0.04]), L * 0.026, L * 0.026, 0, 8), A.dark, 4.2, { center: hc, r: L * 0.02 });
  if (fly) {
    put([bp(0.05, 0.15), bp(-0.15, 0.95), bp(-0.32, 1.0), bp(-0.25, 0.15)], A.fur2, 5, { center: bp(-0.15, 0.5), r: L * 0.4 });
    put([bp(0.1, 0.15), bp(0.05, 0.8), bp(-0.08, 0.82), bp(-0.12, 0.15)], A.fur2, 2, { center: bp(0, 0.5), r: L * 0.4 });
  } else put([bp(0.25, 0.1), bp(0, 0.2), bp(-0.45, 0.12), bp(-0.5, 0.0), bp(-0.1, -0.06)], A.fur2, 3.2, { center: bp(-0.1, 0.05), r: L * 0.3 });
  if (!swim && !fly) for (const d of [-0.05, 0.06]) put(sweep([bp(d, -0.2), [c[0] + f * (d + 0.02) * L, 0]], [[0, L * 0.022], [1, L * 0.018]]), A.beak, 2.5, { axis: [bp(d, -0.2), [c[0], 0]] }, { foot: true });
  return { items, head: hc };
}

const toLocal = (b, f) => (b.family === "bird" ? avian(b, f) : b.asleep && b.size < 1.3 ? curled(b, f) : quadruped(b, f));

export function figures(plan, comp, world, seed) {
  const beings = (plan.beings || []).filter((b) => b.role !== "context" || b.family === "bird");
  const people = plan.people.count && plan.people.pose !== "none" && !plan.people.inside;
  if ((!people && !beings.length) || comp.framing === "none") return null;
  const wind = random((seed ^ 0x77) >>> 0).range(-0.6, 0.6);
  const r = random((seed ^ 0xb1e5) >>> 0);
  const actors = [];
  let unitPx = 0;
  let sc = null;
  let heads = [];
  const support = world.support;
  let mount = null;
  const watched = beings.findIndex((b) => plan.people.toward && `${b.kind} ${b.label}`.toLowerCase().includes(plan.people.toward));
  const handsOn = plan.people.reach || plan.people.pose === "ride";
  const midX = W * (0.5 + (comp.focusX < W / 2 ? 0.18 : -0.18));
  if (people) {
    // people face what they are watching, otherwise into the frame
    const px = support?.forPeople ? support.x : comp.focusX;
    const aim = watched >= 0 && !handsOn ? midX : plan.people.toward === "sun" && world.lights[0] ? world.lights[0].x : W / 2;
    const face = Math.abs(aim - px) > W * 0.05 ? Math.sign(aim - px) : 0;
    // riders sit on the animal they ride: build it first so the people know where its back is
    const ridden = plan.people.pose === "ride" && plan.people.on === "horse" ? beings.findIndex((b) => /horse|pony/.test(`${b.kind} ${b.label}`.toLowerCase())) : -1;
    if (ridden >= 0) {
      const mf = face || (r.chance(0.5) ? 1 : -1);
      const built = quadruped(beings[ridden], mf);
      mount = { index: ridden, f: mf, back: built.back, reins: built.reins, gap: built.length * 1.25 };
    }
    sc = scene({ ...plan, people: { ...plan.people, seat: support && support.forPeople ? support.seat : 0, face, mount } }, seed, wind);
    // fit what the people actually occupy: a crouch or a ride is shorter than a standing body, a lying pair is wide
    let top = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const J of sc.people)
      for (const it of J.items)
        for (const [x, y] of it.pts) {
          top = Math.max(top, y);
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
    unitPx = Math.min(comp.body / Math.max(0.25, top), (W * (sc.pose === "lie" ? 0.5 : 0.85)) / Math.max(0.3, x1 - x0));
    const ox = sc.pose === "lie" ? W * (0.5 + (comp.focusX < W / 2 ? -0.06 : 0.06)) - ((x0 + x1) / 2) * unitPx : px;
    const oy = support?.forPeople ? support.ground : comp.feet;
    for (const J of sc.people) actors.push({ items: J.items, ox, oy, unit: unitPx, cast: true, at: J.P[0] });
    heads = sc.people.map((J) => [ox + J.Hc[0] * unitPx, oy - J.Hc[1] * unitPx]);
  }
  const hz = Math.min(world.horizon, H);
  const water = world.layers.find((L) => L.kind === "water");
  beings.forEach((b, i) => {
    const n = Math.max(1, Math.min(8, b.count || 1));
    for (let c = 0; c < n; c++) {
      const toward = comp.focusX < W / 2 ? 1 : -1;
      let f = b.motion === "run" || b.motion === "walk" || b.motion === "fly" ? toward : r.chance(0.5) ? 1 : -1;
      if (world.attract?.forBeing === i) f = Math.sign(world.attract.x - comp.focusX) || f;
      if (b.near === "people" && people) f = -toward;
      if (mount?.index === i) f = mount.f;
      const built = toLocal(b, f);
      let top = 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (const it of built.items)
        for (const p of it.pts) {
          top = Math.max(top, p[1]);
          lo = Math.min(lo, p[0]);
          hi = Math.max(hi, p[0]);
        }
      let u = unitPx || comp.body / Math.max(0.05, top, (hi - lo) * 0.55);
      let ox = comp.focusX;
      let oy = comp.feet;
      let clip = null;
      const spread = (c - (n - 1) / 2) * top * u * 1.6;
      if (mount?.index === i) {
        // the ridden animal stands where the riders are, one horse per rider
        ox = (support?.forPeople ? support.x : comp.focusX) - mount.f * mount.gap * c * unitPx;
        oy = comp.feet;
        u = unitPx;
      } else if (support?.forBeing === i && c === 0) {
        ox = support.x;
        oy = support.ground;
      } else if (world.attract?.forBeing === i && c === 0) {
        oy = Math.max(world.attract.ground, Math.min(comp.feet, world.attract.ground + H * 0.03));
      } else if (b.motion === "swim" && water) {
        // ducks being fed come in close to the shore, the rest drift further out
        const near = b.near === "people" && people;
        ox = near ? comp.focusX + toward * (W * r.range(0.14, 0.24) + c * top * u * 1.3) : comp.focusX + (people ? r.range(-0.35, 0.35) * W : spread * 1.4);
        const shore = water.bottom(Math.max(0, Math.min(W, ox)));
        oy = near ? shore - (shore - hz) * r.range(0.04, 0.22) : hz + (water.bottom(ox) - hz) * r.range(0.35, 0.92);
        const depth = Math.max(0.12, Math.min(1, (oy - hz) / Math.max(1, (comp.feet || H) - hz)));
        u *= people ? depth : 1;
        clip = oy;
      } else if (b.motion === "fly") {
        oy = hz * r.range(0.15, 0.6);
        ox = W * r.range(0.15, 0.85);
        u *= r.range(0.4, 0.9);
      } else if (people && (b.size > 0.9 || b.motion === "run" || b.motion === "walk") && (b.role !== "focal" || watched === i) && !handsOn) {
        // watched or roaming animals keep to the middle distance instead of crowding the people
        oy = hz + (Math.min(comp.feet, H) - hz) * r.range(0.25, 0.5);
        const depth = Math.max(0.12, Math.min(1, (oy - hz) / Math.max(1, comp.feet - hz)));
        u *= depth;
        ox = midX + (c - (n - 1) / 2) * top * u * 1.8;
      } else if (people) {
        ox = comp.focusX + toward * (W * 0.12 + c * top * u * 1.4) * (i % 2 ? -1 : 1);
        oy = comp.feet + H * r.range(0, 0.04);
      } else {
        ox = comp.focusX + spread;
        const back = Math.abs(c - (n - 1) / 2) * 0.08;
        oy = comp.feet - H * back;
        u *= 1 - back;
      }
      built.items.forEach((it) => (it.person = 3 + i));
      actors.push({ items: built.items, ox, oy, unit: u, clip, cast: b.motion !== "fly" && clip === null });
      if (!heads.length && c === 0) heads = [[ox + built.head[0] * u, oy - built.head[1] * u]];
    }
  });
  if (!unitPx) unitPx = actors[0]?.unit || 1;
  const items = [];
  for (const a of actors)
    for (const it of a.items) {
      const T = (p) => [a.ox + p[0] * a.unit, a.oy - p[1] * a.unit];
      const q = { ...it, pts: it.pts.map(T), clip: a.clip, zz: (a.oy / H) * 100 + it.z };
      if (it.within) q.within = it.within.map(T);
      if (it.shade?.axis) q.shade = { axis: it.shade.axis.map(T) };
      else if (it.shade?.center) q.shade = { center: T(it.shade.center), r: it.shade.r * a.unit };
      if (it.width) q.width = it.width * a.unit;
      items.push(q);
    }
  items.sort((a, b) => a.zz - b.zz || a.person - b.person);
  if (!items.length) return null;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const it of items)
    for (const [x, y] of it.pts) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  box[0] = Math.max(0, box[0]);
  box[1] = Math.max(0, box[1]);
  box[2] = Math.min(W, box[2]);
  box[3] = Math.min(H, box[3]);
  if (box[2] <= box[0] || box[3] <= box[1]) return null;
  const focus = heads.length > 1 ? lerp(heads[0], heads[1], 0.5) : heads[0] || [comp.focusX, comp.feet - comp.body * 0.6];
  const light = world.lights[0] ? [world.lights[0].x, world.lights[0].y] : [comp.lightX, hz * 0.5];
  const lightBehind = Boolean(world.lights[0] && world.lights[0].y < focus[1] && Math.abs(world.lights[0].x - focus[0]) < W * 0.4);
  const backlit = sc?.view === "back" || lightBehind;
  const furOf = (b) => b.colors[0] || (b.family === "bird" ? "#8a6a4a" : "#a07850");
  const feet = actors.map((a) => [a.ox + (a.at || 0) * a.unit, a.oy, a.unit, a.cast]);
  return {
    k: unitPx / 700,
    box,
    focus,
    lightAt: light,
    backlit,
    lightBehind,
    view: sc?.view || "side",
    items,
    feet,
    people: sc ? sc.people.length : 0,
    fill: (mat, who) => {
      if (who >= 3) {
        const b = beings[who - 3] || beings[0];
        const fur = furOf(b);
        const under = b.colors[1] ? `#${[1, 3, 5].map((i) => Math.round((parseInt(fur.slice(i, i + 2), 16) + parseInt(b.colors[1].slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0")).join("")}` : lift(fur, 0.3);
        const hex = mat === A.fur ? fur : mat === A.fur2 ? under : mat === A.crown ? b.colors[2] || fur : mat === A.beak ? b.colors[3] || "#d9a03a" : "#1b1512";
        return [hex, deepen(hex)];
      }
      const lk = sc.looks[(who || 1) - 1] || sc.looks[0];
      const hex = mat === M.skin ? lk.skin : mat === M.hair ? lk.hair : mat === M.top ? lk.top : mat === M.bottom ? lk.bottom : mat === M.dress ? lk.dress : mat === M.coat ? lk.coat : mat === M.object ? "#6a6a70" : lk.shoe;
      return [hex, deepen(hex)];
    },
  };
}
