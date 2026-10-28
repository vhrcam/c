import { random } from "../random";
import { H, W } from "./world";

const SKIN = ["#f2d6c3", "#e9bd9c", "#d29c76", "#b07a55", "#8a5a3c", "#64402a", "#4a2e1f"];
const HAIR = ["#1f1a17", "#3b2618", "#5c3b24", "#7a5232", "#a4733f", "#cfa25e", "#8f3f22", "#6d6d70", "#2a2a33"];
const CLOTH = ["#2b3a67", "#c8553d", "#e0a458", "#3f7a4a", "#efe9dc", "#1f2a44", "#7a4f9a", "#b3502e", "#5c7290", "#d9c9a3", "#8a2f3a", "#2f6f73", "#3a3a3a", "#e58fa8", "#6b6f3a"];
const M = { skin: 1, hair: 2, top: 4, bottom: 5, dress: 6, shoe: 7, coat: 9 };

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const deepen = (hex, k = 0.55) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;

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

function shape(sex, subject, r) {
  const f = sex === "f";
  const child = subject?.age === "child";
  return {
    h: child ? r.range(0.58, 0.72) : r.range(0.93, 1.05) * (f ? 0.96 : 1),
    head: child ? r.range(0.16, 0.18) : r.range(0.122, 0.14),
    torso: r.range(0.28, 0.31),
    leg: r.range(0.46, 0.52),
    neck: r.range(0.026, 0.04),
    upper: r.range(0.165, 0.18),
    fore: r.range(0.148, 0.165),
    shoulder: f ? r.range(0.088, 0.105) : r.range(0.1, 0.124),
    hip: f ? r.range(0.088, 0.11) : r.range(0.076, 0.095),
    chest: r.range(0.085, 0.112),
    waist: f ? r.range(0.064, 0.08) : r.range(0.074, 0.094),
    limb: r.range(0.85, 1.2),
  };
}

function dressFor(subject, ctx, sex, r) {
  const said = String(subject?.clothing || "").toLowerCase();
  if (/dress|gown|skirt/.test(said)) return { kind: "dress", sleeve: r.range(0.2, 1) };
  if (/coat|jacket|raincoat|parka/.test(said)) return { kind: "coat", sleeve: 1 };
  if (/sweater|hoodie|knit|jumper/.test(said)) return { kind: "top", sleeve: 1, pants: true };
  if (/shorts/.test(said)) return { kind: "top", sleeve: 0.4, shorts: true };
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
  const pool = sex === "f" ? ["long", "long", "ponytail", "bob", "short", "bun", "curly"] : ["short", "short", "short", "curly", "bob", "none", "long"];
  return r.pick(ctx.pose === "run" ? pool.map((p) => (p === "long" ? "ponytail" : p)) : pool);
}

function look(subject, sex, ctx, r, i, seed) {
  const said = `${subject?.appearance || ""}`.toLowerCase();
  const tone = /\b(dark|black|brown)[- ]skin/.test(said) ? 5 : /\b(pale|fair|light)[- ]skin/.test(said) ? 0 : /\b(tan|olive)/.test(said) ? 3 : Math.floor(random((seed ^ (0x5a17 + i * 131)) >>> 0)() * SKIN.length);
  const top = subject?.clothColor || r.pick(CLOTH);
  return {
    skin: SKIN[tone],
    hair: subject?.hairColor || r.pick(HAIR),
    top,
    bottom: r.pick(["#1f2a44", "#2b2b30", "#4a6a95", "#6b5a45", "#d9c9a3", "#3a3a3a"]),
    dress: subject?.clothColor || r.pick(CLOTH),
    shoe: r.pick(["#1f1d22", "#3b2a20", "#efe9dc", "#5a4030"]),
    coat: subject?.clothColor || r.pick(CLOTH),
    dressing: dressFor(subject, ctx, sex, r),
    style: hairFor(subject, ctx, sex, r),
  };
}

function cap(a, b, ra, rb, mat, z) {
  return { kind: "cap", a, b, ra, rb, mat, z, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
function ell(c, rx, ry, rotation, mat, z) {
  return { kind: "ell", c, rx, ry, rotation, mat, z, ang: rotation + Math.PI / 2 };
}

function person(view, pr, lk, f, bx, cfg, zb) {
  const s = pr.h;
  const parts = [];
  const put = (p) => parts.push(p);
  const lw = pr.limb;
  const d = lk.dressing;
  const hipY = (cfg.hipY ?? pr.leg) * s;
  const P = [bx, hipY];
  const lean = cfg.lean || 0;
  const td = view === "side" ? [f * Math.sin(lean), Math.cos(lean)] : [Math.sin(cfg.sway || 0), Math.cos(cfg.sway || 0)];
  const C = add(P, mul(td, pr.torso * s));
  const N = add(C, mul(td, pr.neck * s));
  const tilt = cfg.tilt || 0;
  const hs = pr.head * s;
  const hd = view === "side" ? [f * Math.sin(lean + tilt), Math.cos(lean + tilt)] : rot(td, -(cfg.tiltX || 0));
  const Hc = add(N, mul(hd, hs * 0.5));
  const sleeveMat = d.kind === "coat" ? M.coat : d.kind === "dress" ? M.dress : M.top;
  const torsoMat = sleeveMat;
  const legMat = d.kind === "dress" ? M.skin : M.bottom;
  const shinMat = d.kind === "dress" || d.shorts ? M.skin : M.bottom;
  const j = { P, C, N, Hc, hs, s, f, td };

  const leg = (hipJ, target, z, bend) => {
    const l1 = pr.leg * 0.53 * s;
    const l2 = pr.leg * 0.47 * s;
    const { mid, end } = view === "side" ? ik(hipJ, target, l1, l2, bend) : { mid: lerp(hipJ, target, 0.5), end: target };
    put(cap(hipJ, mid, 0.064 * lw * s, 0.046 * lw * s, legMat, z));
    put(cap(mid, end, 0.046 * lw * s, 0.03 * lw * s, shinMat, z));
    const toe = view === "side" ? add(end, [f * 0.075 * s, -0.018 * s]) : add(end, [0, -0.012 * s]);
    put(cap(end, toe, 0.028 * s, 0.022 * s, M.shoe, z + 0.1));
    return { knee: mid, ankle: end };
  };
  const arm = (S, target, z, bend) => {
    const l1 = pr.upper * s;
    const l2 = pr.fore * s;
    const { mid, end } = ik(S, target, l1, l2, bend);
    const long = d.sleeve > 0.7;
    put(cap(S, mid, 0.038 * lw * s, 0.031 * lw * s, d.kind === "dress" && d.sleeve < 0.3 ? M.skin : sleeveMat, z));
    put(cap(mid, end, 0.031 * lw * s, 0.022 * lw * s, long ? sleeveMat : M.skin, z));
    const dir = Math.atan2(end[1] - mid[1], end[0] - mid[0]);
    put(ell(add(end, [Math.cos(dir) * 0.03 * s, Math.sin(dir) * 0.03 * s]), 0.034 * s, 0.022 * s, dir, M.skin, z + 0.1));
    return { elbow: mid, wrist: end };
  };

  if (view === "side") {
    const legs = cfg.legs || { near: [0.03, 0.02], far: [-0.03, 0.02] };
    j.near = leg(P, add([P[0], 0], [f * legs.near[0] * s, legs.near[1] * s]), zb + 8, f);
    j.far = leg(P, add([P[0], 0], [f * legs.far[0] * s, legs.far[1] * s]), zb + 1, f);
    const Wst = add(P, mul(td, 0.12 * s));
    const Cn = add(C, mul(td, -0.035 * s));
    put(cap(P, Wst, 0.094 * s, 0.078 * s, d.kind === "coat" ? M.coat : d.kind === "dress" ? M.dress : M.bottom, zb + 3));
    put(cap(Wst, Cn, 0.078 * s, 0.096 * s, torsoMat, zb + 3));
    if (d.kind === "coat") put(cap(add(P, [0, -0.02 * s]), Wst, 0.1 * s, 0.085 * s, M.coat, zb + 3.2));
    if (d.kind === "dress") {
      const hem = [P[0] + f * 0.02 * s, (pr.leg * 0.42 + (cfg.hipY ? cfg.hipY - pr.leg : 0)) * s];
      put(cap(Wst, hem, 0.085 * s, 0.15 * s, M.dress, zb + 5));
    }
  } else {
    const HL = add(P, [-pr.hip * 0.55 * s, -0.02 * s]);
    const HR = add(P, [pr.hip * 0.55 * s, -0.02 * s]);
    if (cfg.seated) put(ell(add(P, [0, -0.03 * s]), pr.hip * 1.35 * s, 0.075 * s, 0, d.kind === "dress" ? M.dress : M.bottom, zb + 1));
    else {
      const step = cfg.step || 0;
      j.near = leg(HL, [HL[0] - 0.01 * s, (step > 0 ? 0.06 : 0) * s], zb + 1, 1);
      j.far = leg(HR, [HR[0] + 0.01 * s, (step < 0 ? 0.06 : 0) * s], zb + 1, 1);
    }
    const Wst = add(P, mul(td, 0.12 * s));
    const Cn = add(C, mul(td, -0.035 * s));
    put(cap(P, Wst, pr.hip * s, pr.waist * s, d.kind === "dress" ? M.dress : d.kind === "coat" ? M.coat : M.bottom, zb + 3));
    put(cap(Wst, Cn, pr.waist * s, pr.chest * s, torsoMat, zb + 3));
    put(cap(add(C, [-pr.shoulder * 0.85 * s, -0.02 * s]), add(C, [pr.shoulder * 0.85 * s, -0.02 * s]), 0.05 * s, 0.05 * s, torsoMat, zb + 3.1));
    if (d.kind === "dress" && !cfg.seated) put(cap(Wst, [P[0], pr.leg * 0.4 * s], pr.waist * 1.1 * s, pr.hip * 1.7 * s, M.dress, zb + 3.3));
    if (d.kind === "coat") put(cap(add(P, [0, -0.06 * s]), Wst, pr.hip * 1.12 * s, pr.waist * 1.15 * s, M.coat, zb + 3.2));
  }

  put(cap(add(C, mul(td, -0.01 * s)), add(Hc, mul(hd, -hs * 0.3)), 0.031 * s, 0.028 * s, M.skin, zb + 5));
  if (view === "side") {
    const a = Math.atan2(hd[1], hd[0]) - Math.PI / 2;
    const at = (x, y) => add(Hc, rot([f * x * hs, y * hs], a));
    put(ell(Hc, hs * 0.42, hs * 0.5, a, M.skin, zb + 6));
    put(cap(at(-0.02, -0.28), at(0.3, -0.4), hs * 0.16, hs * 0.1, M.skin, zb + 6));
    put(cap(at(0.36, 0.02), at(0.42, -0.06), hs * 0.06, hs * 0.045, M.skin, zb + 6));
    const style = lk.style;
    if (style !== "none") put(ell(at(-0.08, 0.1), hs * 0.46, hs * (style === "curly" ? 0.48 : 0.42), a, M.hair, zb + 7));
    if (style === "long") put(cap(at(-0.25, 0), at(-0.35 - (cfg.wind || 0) * 0.6, -1.15), hs * 0.32, hs * 0.2, M.hair, zb + 7));
    if (style === "bob") put(ell(at(-0.12, -0.08), hs * 0.5, hs * 0.5, a, M.hair, zb + 7));
    if (style === "ponytail") put(cap(at(-0.4, 0.18), at(-0.95 - (cfg.wind || 0) * 0.5, -0.4 + (cfg.wind || 0) * 0.3), hs * 0.14, hs * 0.07, M.hair, zb + 7));
    if (style === "bun") put(ell(at(-0.42, 0.32), hs * 0.2, hs * 0.2, 0, M.hair, zb + 7));
    if (style === "curly") put(ell(at(-0.2, 0.05), hs * 0.52, hs * 0.5, a, M.hair, zb + 7));
  } else {
    put(ell(Hc, hs * 0.38, hs * 0.5, -(cfg.tiltX || 0), M.skin, zb + 6));
    const style = lk.style;
    if (style !== "none") put(ell(add(Hc, [0, hs * 0.05]), hs * (style === "curly" ? 0.48 : 0.41), hs * (style === "short" ? 0.47 : 0.5), -(cfg.tiltX || 0), M.hair, zb + 7));
    if (style === "long") put(cap(add(Hc, [0, -hs * 0.1]), add(Hc, [0, -hs * 1.3]), hs * 0.4, hs * 0.3, M.hair, zb + 7));
    if (style === "bob") put(ell(add(Hc, [0, -hs * 0.15]), hs * 0.47, hs * 0.48, 0, M.hair, zb + 7));
    if (style === "ponytail") put(cap(add(Hc, [0, 0]), add(Hc, [(cfg.wind || 0) * hs, -hs * 0.95]), hs * 0.13, hs * 0.08, M.hair, zb + 7.5));
    if (style === "bun") put(ell(add(Hc, [0, hs * 0.48]), hs * 0.2, hs * 0.18, 0, M.hair, zb + 7.5));
  }
  j.S = view === "side" ? add(C, [-f * 0.012 * s, -0.012 * s]) : null;
  j.SL = add(C, [-pr.shoulder * s, -0.02 * s]);
  j.SR = add(C, [pr.shoulder * s, -0.02 * s]);
  j.arm = arm;
  j.parts = parts;
  return j;
}

function ground(parts) {
  let lo = Infinity;
  for (const p of parts) {
    if (p.mat !== M.shoe && !(p.kind === "ell" && p.z % 10 === 1)) continue;
    for (const q of p.kind === "cap" ? [p.b[1] - p.rb, p.a[1] - p.ra] : [p.c[1] - p.ry]) lo = Math.min(lo, q);
  }
  return lo === Infinity ? 0 : lo;
}

function shift(parts, dy) {
  for (const p of parts) {
    if (p.kind === "cap") {
      p.a = [p.a[0], p.a[1] - dy];
      p.b = [p.b[0], p.b[1] - dy];
    } else p.c = [p.c[0], p.c[1] - dy];
  }
}

function scene(plan, seed, wind) {
  const r = random((seed ^ 0x6f1d2) >>> 0);
  const pose = plan.people.pose;
  const count = plan.people.count;
  const subjects = Array.from({ length: count }, (_, i) => plan.people.subjects[i] || {});
  const sexes = subjects.map((x, i) => (x.gender === "woman" ? "f" : x.gender === "man" ? "m" : random((seed ^ (0x9e37 + i * 977)) >>> 0)() < 0.5 ? "f" : "m"));
  const { place, time, weather } = plan.setting;
  const ctx = { pose, cold: weather === "snow" || place === "snow" || place === "mountains" || time === "night", wet: weather === "rain", warm: ["sea", "field", "garden", "desert"].includes(place) && time !== "night" };
  const prs = subjects.map((x, i) => shape(sexes[i], x, random((seed ^ (0x1234 + i * 7919)) >>> 0)));
  const lks = subjects.map((x, i) => look(x, sexes[i], ctx, random((seed ^ (0x4321 + i * 104729)) >>> 0), i, seed));
  const f = r.chance(0.5) ? 1 : -1;
  const out = [];
  let view = "side";

  if (pose === "embrace" && count === 2) {
    if (prs[1].h > prs[0].h) prs[1].h = prs[0].h * r.range(0.94, 0.99);
    const tall = prs[0].h >= prs[1].h ? 0 : 1;
    const cfg = [0, 1].map((i) => ({ lean: i === tall ? r.range(0.06, 0.12) : r.range(0, 0.04), tilt: i === tall ? r.range(0.15, 0.3) : r.range(-0.2, -0.05), wind, legs: { near: [r.range(-0.02, 0.06), 0], far: [r.range(-0.08, 0), i === tall ? 0 : r.range(0, 0.08)] } }));
    const A = person("side", prs[0], lks[0], f, 0, cfg[0], 0);
    const B0 = person("side", prs[1], lks[1], -f, 0, cfg[1], 10);
    const faceA = A.Hc[0] + f * A.hs * 0.42;
    const faceB = B0.Hc[0] - f * B0.hs * 0.42;
    const B = person("side", prs[1], lks[1], -f, faceA - faceB - f * 0.012, cfg[1], 10);
    const waistB = add(B.P, [f * 0.07 * B.s, 0.1 * B.s]);
    A.arm(A.S, waistB, 30, -f);
    A.arm(A.S, add(B.P, [f * 0.03 * B.s, 0.16 * B.s]), 0.5, -f);
    const neckA = add(A.N, [-f * 0.05 * A.s, -0.03 * A.s]);
    B.arm(B.S, neckA, 29, f);
    B.arm(B.S, add(A.C, [-f * 0.03 * A.s, -0.05 * A.s]), 10.5, f);
    out.push(A, B);
  } else if (pose === "sit" && count >= 1) {
    view = r.chance(0.65) ? "back" : "side";
    if (view === "back") {
      const sep = ((prs[0].shoulder * prs[0].h + (prs[1]?.shoulder || 0) * (prs[1]?.h || 0)) * 1.05) || 0;
      const lean = r.range(0.06, 0.14);
      const A = person("back", prs[0], lks[0], 1, count === 2 ? -sep / 2 : 0, { hipY: 0.13, seated: true, sway: count === 2 ? lean * 0.3 : 0, tiltX: count === 2 ? -0.05 : 0, wind }, 0);
      out.push(A);
      if (count === 2) {
        const B = person("back", prs[1], lks[1], 1, sep / 2, { hipY: 0.13, seated: true, sway: -lean, tiltX: r.range(0.25, 0.45), wind }, 10);
        A.arm(A.SR, add(B.SR, [0.01 * B.s, 0.025 * B.s]), 30, -1);
        A.arm(A.SL, add(A.SL, [-0.04 * A.s, -0.3 * A.s]), 4, -1);
        B.arm(B.SR, add(B.SR, [0.04 * B.s, -0.3 * B.s]), 14, 1);
        out.push(B);
      } else {
        A.arm(A.SL, add(A.SL, [-0.04 * A.s, -0.3 * A.s]), 4, -1);
        A.arm(A.SR, add(A.SR, [0.04 * A.s, -0.3 * A.s]), 4, 1);
      }
    } else {
      const hug = r.chance(0.5);
      out.push(
        ...subjects.map((_, i) => {
          const J = person("side", prs[i], lks[i], f, i ? -f * r.range(0.05, 0.14) : 0, { hipY: 0.11, lean: hug ? r.range(0.15, 0.3) : r.range(-0.12, 0.05), tilt: r.range(-0.1, 0.15), wind, legs: { near: [r.range(0.36, 0.44), 0.02], far: [r.range(0.3, 0.4), 0.02] } }, i * 10);
          if (hug) {
            J.arm(J.S, add(J.near.knee, [-f * 0.02 * J.s, -0.03 * J.s]), i * 10 + 9, -f);
            J.arm(J.S, add(J.far.knee, [-f * 0.02 * J.s, -0.05 * J.s]), i * 10 + 0.5, -f);
          } else {
            J.arm(J.S, [J.P[0] - f * 0.14 * J.s, 0.01], i * 10 + 9, f);
            J.arm(J.S, [J.P[0] - f * 0.12 * J.s, 0.01], i * 10 + 0.5, f);
          }
          return J;
        })
      );
    }
  } else if (pose === "run") {
    const runner = (i, bx, zb) => {
      const lead = r.chance(0.5);
      const J = person("side", prs[i], lks[i], f, bx, { lean: r.range(0.2, 0.3), tilt: -0.05, wind: 0.8, legs: lead ? { near: [0.2, 0.2], far: [-0.38, 0.3] } : { near: [-0.38, 0.3], far: [0.2, 0.2] } }, zb);
      const front = [f * 0.16 * J.s, -0.1 * J.s];
      const back = [-f * 0.2 * J.s, -0.2 * J.s];
      J.arm(J.S, add(J.S, lead ? back : front), zb + 9, -f);
      J.arm(J.S, add(J.S, lead ? front : back), zb + 0.5, -f);
      shift(J.parts, ground(J.parts));
      return J;
    };
    out.push(runner(0, 0, 10));
    if (count === 2) out.push(runner(1, -f * r.range(0.35, 0.9), 0));
  } else if (pose === "walk" || (pose === "stand" && count === 2)) {
    view = pose === "walk" ? (r.chance(0.5) ? "side" : "back") : r.chance(0.7) ? "back" : "side";
    if (view === "back") {
      const sep = (prs[0].shoulder * prs[0].h + (prs[1]?.shoulder || prs[0].shoulder) * (prs[1]?.h || 1)) * 1.25;
      out.push(
        ...subjects.map((_, i) => {
          const J = person("back", prs[i], lks[i], 1, (i ? 1 : -1) * (count === 2 ? sep / 2 : 0), { step: pose === "walk" ? (i ? -1 : 1) : 0, tiltX: count === 2 ? (i ? 0.12 : -0.08) : 0, wind }, i * 10);
          const hold = [0, 0.45 * J.s];
          if (count === 2) J.arm(i ? J.SL : J.SR, add(hold, [i ? 0.012 : -0.012, 0]), i * 10 + 4, i ? 1 : -1);
          const outer = i ? J.SR : J.SL;
          J.arm(outer, add(outer, [(i ? 0.03 : -0.03) * J.s, -0.31 * J.s]), i * 10 + 4, i ? 1 : -1);
          if (count === 1) J.arm(J.SR, add(J.SR, [0.03 * J.s, -0.31 * J.s]), 4, 1);
          shift(J.parts, ground(J.parts));
          return J;
        })
      );
    } else {
      out.push(
        ...subjects.map((_, i) => {
          const stride = pose === "walk" ? r.range(0.18, 0.26) : 0.03;
          const J = person("side", prs[i], lks[i], f, i ? -f * r.range(-0.08, 0.12) : 0, { lean: pose === "walk" ? 0.05 : 0.01, tilt: r.range(-0.1, 0.1), wind, legs: { near: [stride, 0], far: [-stride * 0.9, pose === "walk" ? 0.05 : 0] } }, i ? 0 : 10);
          J.arm(J.S, add(J.S, [-f * 0.1 * J.s, -0.3 * J.s]), (i ? 0 : 10) + 9, -f);
          J.arm(J.S, add(J.S, [f * 0.1 * J.s, -0.3 * J.s]), (i ? 0 : 10) + 0.5, -f);
          shift(J.parts, ground(J.parts));
          return J;
        })
      );
    }
  } else {
    view = r.chance(0.6) ? "back" : "side";
    const J = person(view, prs[0], lks[0], f, 0, { tilt: r.range(-0.2, 0.05), tiltX: r.range(-0.1, 0.1), wind, legs: { near: [0.04, 0], far: [-0.04, 0] } }, 0);
    if (view === "side") {
      J.arm(J.S, add(J.S, [f * 0.02 * J.s, -0.31 * J.s]), 9, -f);
      J.arm(J.S, add(J.S, [-f * 0.02 * J.s, -0.31 * J.s]), 0.5, -f);
    } else {
      J.arm(J.SL, add(J.SL, [-0.03 * J.s, -0.31 * J.s]), 4, -1);
      J.arm(J.SR, add(J.SR, [0.03 * J.s, -0.31 * J.s]), 4, 1);
    }
    shift(J.parts, ground(J.parts));
    out.push(J);
  }
  out.forEach((J, i) => J.parts.forEach((p) => (p.person = i + 1)));
  return { people: out, looks: lks, view, pose };
}

function distance(p, x, y) {
  if (p.kind === "cap") {
    const vx = p.b[0] - p.a[0];
    const vy = p.b[1] - p.a[1];
    const t = Math.min(1, Math.max(0, ((x - p.a[0]) * vx + (y - p.a[1]) * vy) / (vx * vx + vy * vy || 1)));
    const ox = x - (p.a[0] + vx * t);
    const oy = y - (p.a[1] + vy * t);
    const r = p.ra + (p.rb - p.ra) * t;
    const l = Math.hypot(ox, oy);
    return [l - r, ox / r, oy / r];
  }
  const c = Math.cos(-p.rotation);
  const s = Math.sin(-p.rotation);
  const qx = ((x - p.c[0]) * c - (y - p.c[1]) * s) / p.rx;
  const qy = ((x - p.c[0]) * s + (y - p.c[1]) * c) / p.ry;
  const k = Math.hypot(qx, qy);
  const [nx, ny] = rot([qx, qy], p.rotation);
  return [(k - 1) * Math.min(p.rx, p.ry), nx, ny];
}

const A = { fur: 11, fur2: 12, dark: 13, beak: 14, crown: 15 };
const UNIT = 1 / 1.75;

function quadruped(b, f) {
  const B = b.build || {};
  const L = Math.max(0.2, Math.min(3, b.size || 0.6)) * UNIT;
  const legH = L * (0.42 + (B.legs ?? 0.5) * 0.6);
  const R = L * (0.13 + (B.body ?? 0.5) * 0.14);
  const neck = L * (0.18 + (B.neck ?? 0.4) * 0.6);
  const head = L * (0.22 + (B.head ?? 0.5) * 0.14);
  const snout = head * (0.25 + (B.snout ?? 0.5) * 0.9);
  const m = b.motion || "stand";
  const parts = [];
  const put = (p) => parts.push(p);
  let hip = [-f * L * 0.5, legH];
  let sh = [f * L * 0.5, legH + R * 0.15];
  if (m === "sit") {
    hip = [-f * L * 0.1, R * 0.95];
    sh = [f * L * 0.16, legH * 0.82 + R * 0.5];
  } else if (m === "lie") {
    hip = [-f * L * 0.5, R * 0.95];
    sh = [f * L * 0.5, R * 1.15];
  } else if (m === "run") {
    hip = [-f * L * 0.55, legH * 0.9];
    sh = [f * L * 0.55, legH * 0.95];
  }
  const body = Math.atan2(sh[1] - hip[1], sh[0] - hip[0]);
  put(cap(hip, sh, R * 0.9, R, A.fur, 3));
  put(ell(add(lerp(hip, sh, 0.55), [0, -R * 0.55]), Math.hypot(sh[0] - hip[0], sh[1] - hip[1]) * 0.32, R * 0.32, body + (f < 0 ? Math.PI : 0), A.fur2, 3.05));
  const leg = (top, target, z, bend, r1) => {
    const { mid, end } = ik(top, target, legH * 0.56, legH * 0.52, bend);
    put(cap(top, mid, r1, r1 * 0.72, A.fur, z));
    put(cap(mid, end, r1 * 0.6, r1 * 0.42, A.fur, z));
    put(ell(add(end, [f * r1 * 0.35, r1 * 0.1]), r1 * 0.62, r1 * 0.36, 0, A.fur2, z + 0.05));
  };
  const front = add(sh, [-f * R * 0.25, -R * 0.35]);
  const hind = add(hip, [f * R * 0.25, -R * 0.25]);
  const rl = R * 0.46;
  const T = {
    stand: [[0.05, 0], [-0.04, 0], [0.04, 0], [-0.06, 0]],
    walk: [[0.2, 0], [-0.12, 0.04], [-0.15, 0], [0.18, 0.04]],
    run: [[0.5, 0.12], [0.3, 0.04], [-0.5, 0.18], [-0.25, 0.03]],
    sit: [[0.06, 0], [-0.02, 0], [0.36, 0], [0.3, 0]],
    lie: [[0.55, 0.02], [0.45, 0.02], [0.32, 0.02], [0.22, 0.02]],
  }[m] || [[0.05, 0], [-0.04, 0], [0.04, 0], [-0.06, 0]];
  const at = (base, [dx, dy]) => [base[0] + f * dx * L, dy * L];
  leg(front, at(sh, T[1]), 1, -f, rl);
  leg(hind, at(hip, T[3]), 1, f, rl * 1.1);
  leg(front, at(sh, T[0]), 6, -f, rl);
  leg(hind, at(hip, T[2]), 6, f, rl * 1.1);
  const na = m === "run" ? 0.35 : m === "lie" ? 0.75 : m === "sit" ? 1.05 : 0.85;
  const nb = add(sh, [f * R * 0.3, R * 0.25]);
  const nt = add(nb, [f * Math.cos(na) * neck, Math.sin(na) * neck]);
  put(cap(nb, nt, R * 0.62, R * 0.46, A.fur, 4));
  const hc = add(nt, [f * head * 0.2, head * 0.05]);
  put(ell(hc, head * 0.52, head * 0.43, 0, A.fur, 5));
  const tip = add(hc, [f * (head * 0.35 + snout), -head * 0.2]);
  put(cap(add(hc, [f * head * 0.22, -head * 0.04]), tip, head * 0.26, head * 0.15, A.fur, 5.1));
  put(ell(tip, head * 0.085, head * 0.075, 0, A.dark, 5.2));
  put(ell(add(hc, [f * head * 0.16, head * 0.13]), head * 0.07, head * 0.07, 0, A.dark, 5.3));
  const ears = B.ears || "pointed";
  if (ears === "pointed") {
    put(cap(add(hc, [-f * head * 0.02, head * 0.3]), add(hc, [-f * head * 0.1, head * (b.kind && /rabbit|hare/.test(b.kind) ? 1.4 : 0.78)]), head * 0.15, head * 0.03, A.fur, 5.4));
    put(cap(add(hc, [-f * head * 0.2, head * 0.28]), add(hc, [-f * head * 0.3, head * 0.72]), head * 0.14, head * 0.03, A.fur, 4.9));
  } else if (ears === "floppy") put(cap(add(hc, [-f * head * 0.22, head * 0.28]), add(hc, [-f * head * 0.36, -head * 0.32]), head * 0.15, head * 0.11, A.fur2, 5.4));
  else if (ears === "round") put(ell(add(hc, [-f * head * 0.12, head * 0.42]), head * 0.17, head * 0.15, 0, A.fur, 5.4));
  const tail = B.tail || "long";
  const low = m === "sit" || m === "lie";
  const root = add(hip, [-f * R * 0.65, R * 0.3]);
  if (tail === "long") put(cap(root, low ? [hip[0] - f * L * 0.45, R * 0.15] : add(hip, [-f * L * 0.5, -L * 0.12]), R * 0.2, R * 0.08, A.fur, 2.9));
  if (tail === "bushy") {
    const end = low ? [hip[0] - f * L * 0.55, R * 0.3] : add(hip, [-f * L * 0.62, -L * 0.04]);
    put(cap(root, end, R * 0.3, R * 0.36, A.fur, 2.9));
    put(ell(end, R * 0.3, R * 0.26, 0, A.fur2, 2.95));
  }
  if (tail === "short") put(cap(root, add(root, [-f * L * 0.15, R * 0.3]), R * 0.16, R * 0.1, A.fur, 2.9));
  if (tail === "curled") {
    const mid = add(root, [-f * L * 0.12, R * 1.0]);
    put(cap(root, mid, R * 0.17, R * 0.13, A.fur, 2.9));
    put(cap(mid, add(mid, [f * L * 0.1, R * 0.35]), R * 0.13, R * 0.1, A.fur, 2.9));
  }
  return { parts, head: hc };
}

function avian(b, f) {
  const L = Math.max(0.08, Math.min(1.6, b.size || 0.35)) * UNIT;
  const m = b.motion || "stand";
  const parts = [];
  const put = (p) => parts.push(p);
  const swim = m === "swim";
  const fly = m === "fly";
  const c = [0, swim ? L * 0.1 : fly ? L * 1.2 : L * 0.42];
  put(ell(c, L * 0.5, L * 0.27, f * 0.06, A.fur, 3));
  const hc = add(c, [f * L * 0.42, L * (swim ? 0.4 : 0.32)]);
  put(cap(add(c, [f * L * 0.28, L * 0.08]), hc, L * 0.15, L * 0.11, A.crown, 3.5));
  put(ell(hc, L * 0.16, L * 0.14, 0, A.crown, 4));
  put(cap(add(hc, [f * L * 0.12, -L * 0.02]), add(hc, [f * L * 0.3, -L * 0.05]), L * 0.05, L * 0.02, A.beak, 4.1));
  put(ell(add(hc, [f * L * 0.05, L * 0.04]), L * 0.026, L * 0.026, 0, A.dark, 4.2));
  put(cap(add(c, [-f * L * 0.38, L * 0.04]), add(c, [-f * L * 0.68, L * 0.15]), L * 0.1, L * 0.03, A.fur2, 2.9));
  if (fly) {
    put(cap(add(c, [0, L * 0.12]), add(c, [-f * L * 0.2, L * 0.85]), L * 0.2, L * 0.05, A.fur2, 5));
    put(cap(add(c, [f * L * 0.05, L * 0.12]), add(c, [f * L * 0.1, L * 0.78]), L * 0.17, L * 0.05, A.fur2, 2));
  } else put(ell(add(c, [-f * L * 0.06, L * 0.06]), L * 0.36, L * 0.15, f * 0.12, A.fur2, 3.2));
  if (!swim && !fly)
    for (const d of [-1, 1]) put(cap(add(c, [d * L * 0.06, -L * 0.18]), [d * L * 0.06 + f * L * 0.02, 0], L * 0.025, L * 0.02, A.beak, 2.5));
  return { parts, head: hc };
}

const toLocal = (b, f) => (b.family === "bird" ? avian(b, f) : quadruped(b, f));

export function figures(plan, comp, world, seed) {
  const beings = (plan.beings || []).filter((b) => b.role !== "context" || b.family === "bird");
  const people = plan.people.count && plan.people.pose !== "none" && !plan.people.inside;
  if ((!people && !beings.length) || comp.framing === "none") return null;
  const wind = random((seed ^ 0x77) >>> 0).range(-0.6, 0.6);
  const r = random((seed ^ 0xb1e5) >>> 0);
  const actors = [];
  let unit = 0;
  let sc = null;
  let heads = [];
  if (people) {
    sc = scene(plan, seed, wind);
    const seatedFrac = sc.pose === "sit" ? (sc.view === "back" ? 0.6 : 0.62) : sc.pose === "run" ? 0.95 : 1;
    unit = comp.body / seatedFrac;
    for (const J of sc.people) actors.push({ parts: J.parts, ox: comp.focusX, oy: comp.feet, unit, who: null });
    heads = sc.people.map((J) => [comp.focusX + J.Hc[0] * unit, comp.feet - J.Hc[1] * unit]);
  }
  const hz = Math.min(world.horizon, H);
  const water = world.layers.find((L) => L.kind === "water");
  beings.forEach((b, i) => {
    const n = Math.max(1, Math.min(8, b.count || 1));
    for (let c = 0; c < n; c++) {
      const toward = comp.focusX < W / 2 ? 1 : -1;
      const f = b.motion === "run" || b.motion === "walk" || b.motion === "fly" ? toward : r.chance(0.5) ? 1 : -1;
      const built = toLocal(b, f);
      let top = 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of built.parts) {
        top = Math.max(top, p.kind === "cap" ? Math.max(p.a[1] + p.ra, p.b[1] + p.rb) : p.c[1] + p.ry);
        for (const q of p.kind === "cap" ? [p.a[0] - p.ra, p.b[0] - p.rb, p.a[0] + p.ra, p.b[0] + p.rb] : [p.c[0] - p.rx, p.c[0] + p.rx]) {
          lo = Math.min(lo, q);
          hi = Math.max(hi, q);
        }
      }
      let u = unit || comp.body / Math.max(0.05, top, (hi - lo) * 0.55);
      let ox = comp.focusX;
      let oy = comp.feet;
      let clip = null;
      const spread = (c - (n - 1) / 2) * top * u * 1.6;
      if (b.motion === "swim" && water) {
        oy = hz + (water.bottom(ox) - hz) * r.range(0.35, 0.92);
        const depth = Math.max(0.12, Math.min(1, (oy - hz) / Math.max(1, (comp.feet || H) - hz)));
        u *= people ? depth : 1;
        ox = comp.focusX + (people ? r.range(-0.35, 0.35) * W : spread * 1.4) + (people ? 0 : r.range(-0.05, 0.05) * W);
        clip = oy;
      } else if (b.motion === "fly") {
        oy = hz * r.range(0.15, 0.6);
        ox = W * r.range(0.15, 0.85);
        u *= r.range(0.4, 0.9);
      } else if (people && (b.size > 0.9 || b.motion === "run" || b.motion === "walk") && b.role !== "focal") {
        oy = hz + (Math.min(comp.feet, H) - hz) * r.range(0.25, 0.5);
        const depth = Math.max(0.12, Math.min(1, (oy - hz) / Math.max(1, comp.feet - hz)));
        u *= depth;
        ox = W * (0.5 + (comp.focusX < W / 2 ? 0.18 : -0.18)) + (c - (n - 1) / 2) * top * u * 1.8;
      } else if (people) {
        ox = comp.focusX + toward * (W * 0.12 + c * top * u * 1.4) * (i % 2 ? -1 : 1);
        oy = comp.feet + H * r.range(0, 0.04);
      } else {
        ox = comp.focusX + spread;
        const back = Math.abs(c - (n - 1) / 2) * 0.08;
        oy = comp.feet - H * back;
        u *= 1 - back;
      }
      actors.push({ parts: built.parts, ox, oy, unit: u, who: 3 + i, clip });
      if (!heads.length && c === 0) heads = [[ox + built.head[0] * u, oy - built.head[1] * u]];
    }
  });
  if (!unit) unit = actors[0]?.unit || 1;
  const parts = [];
  for (const a of actors)
    for (const p of a.parts) {
      const toScreen = (q) => [a.ox + q[0] * a.unit, a.oy - q[1] * a.unit];
      const q = { ...p, clip: a.clip };
      if (a.who) q.person = a.who;
      if (p.kind === "cap") {
        q.a = toScreen(p.a);
        q.b = toScreen(p.b);
        q.ra = p.ra * a.unit;
        q.rb = p.rb * a.unit;
        q.ang = Math.atan2(q.b[1] - q.a[1], q.b[0] - q.a[0]);
      } else {
        q.c = toScreen(p.c);
        q.rx = p.rx * a.unit;
        q.ry = p.ry * a.unit;
        q.rotation = -p.rotation;
        q.ang = q.rotation + Math.PI / 2;
      }
      const R = q.kind === "cap" ? Math.max(q.ra, q.rb) : Math.max(q.rx, q.ry);
      const pts = q.kind === "cap" ? [q.a, q.b] : [q.c];
      q.box = [Math.min(...pts.map((v) => v[0])) - R - 4, Math.min(...pts.map((v) => v[1])) - R - 4, Math.max(...pts.map((v) => v[0])) + R + 4, Math.max(...pts.map((v) => v[1])) + R + 4];
      q.zz = (a.oy / H) * 100 + q.z;
      parts.push(q);
    }
  parts.sort((a, b) => a.zz - b.zz || a.person - b.person);
  if (!parts.length) return null;
  const bx0 = Math.max(0, Math.floor(Math.min(...parts.map((p) => p.box[0]))));
  const by0 = Math.max(0, Math.floor(Math.min(...parts.map((p) => p.box[1]))));
  const bx1 = Math.min(W, Math.ceil(Math.max(...parts.map((p) => p.box[2]))));
  const by1 = Math.min(H, Math.ceil(Math.max(...parts.map((p) => p.box[3]))));
  if (bx1 <= bx0 || by1 <= by0) return null;
  const step = (bx1 - bx0) * (by1 - by0) > 500000 ? 2 : 1;
  const gw = Math.ceil((bx1 - bx0) / step) + 1;
  const gh = Math.ceil((by1 - by0) / step) + 1;
  const idx = new Int16Array(gw * gh).fill(-1);
  const nx = new Float32Array(gw * gh);
  const ny = new Float32Array(gw * gh);
  const blend = 0.022 * unit;
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const x = bx0 + gx * step;
      const y = by0 + gy * step;
      let dmin = 1e9;
      let best = -1;
      let near = -1;
      let nearD = 1e9;
      let bn = null;
      let nn = null;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (x < p.box[0] || x > p.box[2] || y < p.box[1] || y > p.box[3] || (p.clip && y > p.clip)) continue;
        const [d, ox, oy] = distance(p, x, y);
        const h = Math.max(blend - Math.abs(dmin - d), 0) / blend;
        dmin = Math.min(dmin, d) - h * h * blend * 0.25;
        if (d < 0) {
          best = i;
          bn = [ox, oy];
        }
        if (d < nearD) {
          nearD = d;
          near = i;
          nn = [ox, oy];
        }
      }
      if (dmin >= 0) continue;
      const k = gy * gw + gx;
      idx[k] = best >= 0 ? best : near;
      const nrm = best >= 0 ? bn : nn;
      nx[k] = Math.max(-1, Math.min(1, nrm[0]));
      ny[k] = Math.max(-1, Math.min(1, nrm[1]));
    }
  const cell = (x, y) => {
    const gx = Math.round((x - bx0) / step);
    const gy = Math.round((y - by0) / step);
    return gx < 0 || gy < 0 || gx >= gw || gy >= gh ? -1 : gy * gw + gx;
  };
  const partAt = (x, y) => {
    const k = cell(x, y);
    return k < 0 || idx[k] < 0 ? null : parts[idx[k]];
  };
  const focus = heads.length > 1 ? lerp(heads[0], heads[1], 0.5) : heads[0] || [comp.focusX, comp.feet - comp.body * 0.6];
  const light = world.lights[0] ? [world.lights[0].x, world.lights[0].y] : [comp.lightX, hz * 0.5];
  const lv = [light[0] - focus[0], light[1] - focus[1]];
  const ll = Math.hypot(...lv) || 1;
  const backlit = sc?.view === "back" || (world.lights[0] && world.lights[0].y < focus[1]);
  const L = [lv[0] / ll, lv[1] / ll, backlit ? -0.35 : 0.6];
  const Ln = Math.hypot(...L);
  const shade = (x, y) => {
    const k = cell(x, y);
    if (k < 0 || idx[k] < 0) return [0, 0];
    const ox = nx[k];
    const oy = ny[k];
    const nz = Math.sqrt(Math.max(0, 1 - ox * ox - oy * oy));
    const lam = Math.max(0, (ox * L[0] + oy * L[1] + nz * L[2]) / Ln);
    const rim = Math.max(0, ox * L[0] + oy * L[1]) * (1 - nz) ** 2 * (backlit ? 1.4 : 0.5);
    return [0.55 + lam * 0.45, Math.min(1, rim)];
  };
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let gy = 0; gy < gh; gy += 2)
    for (let gx = 0; gx < gw; gx += 2)
      if (idx[gy * gw + gx] >= 0) {
        const x = bx0 + gx * step;
        const y = by0 + gy * step;
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
  if (box[0] === Infinity) return null;
  const furOf = (b) => (b.colors[0] || (b.family === "bird" ? "#8a6a4a" : "#a07850"));
  const lift = (hex, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * k).toString(16).padStart(2, "0")).join("")}`;
  return {
    k: unit / 700,
    box,
    focus,
    view: sc?.view || "side",
    parts,
    people: sc ? sc.people.length : 0,
    inside: (x, y) => partAt(x, y) !== null,
    code: (x, y) => {
      const p = partAt(x, y);
      return p ? p.person * 16 + p.mat : 0;
    },
    mat: (x, y) => partAt(x, y)?.mat || 0,
    person: (x, y) => partAt(x, y)?.person || 0,
    light: (x, y) => shade(x, y)[0],
    rim: (x, y) => shade(x, y)[1],
    ao: () => 1,
    along: (x, y, out) => {
      const p = partAt(x, y);
      const a = p ? p.ang : 0;
      out[0] = Math.cos(a);
      out[1] = Math.sin(a);
      return out;
    },
    fill: (mat, who) => {
      if (who >= 3) {
        const b = beings[who - 3] || beings[0];
        const fur = furOf(b);
        const under = b.colors[1] ? `#${[1, 3, 5].map((i) => Math.round((parseInt(fur.slice(i, i + 2), 16) + parseInt(b.colors[1].slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0")).join("")}` : lift(fur, 0.3);
        const hex = mat === A.fur ? fur : mat === A.fur2 ? under : mat === A.crown ? b.colors[2] || fur : mat === A.beak ? b.colors[3] || "#d9a03a" : "#1b1512";
        return [hex, deepen(hex)];
      }
      const lk = sc.looks[(who || 1) - 1] || sc.looks[0];
      const hex = mat === M.skin ? lk.skin : mat === M.hair ? lk.hair : mat === M.top ? lk.top : mat === M.bottom ? lk.bottom : mat === M.dress ? lk.dress : mat === M.coat ? lk.coat : lk.shoe;
      return [hex, deepen(hex)];
    },
  };
}
