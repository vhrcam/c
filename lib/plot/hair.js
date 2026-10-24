import { MAT, blade, ell, plane, rc, smin } from "./figure.js";
import { add, dot, len, lerp, madd, mul, norm, sub, toDir, toWorld } from "./math.js";

const SKULL = {
  f: { c: [-0.006, 0.02, 0], r: [0.088, 0.093, 0.08] },
  m: { c: [-0.006, 0.02, 0], r: [0.091, 0.096, 0.083] },
};

function radius(e, d) {
  return 1 / Math.sqrt((d[0] / e.r[0]) ** 2 + (d[1] / e.r[1]) ** 2 + (d[2] / e.r[2]) ** 2);
}

const scalp = (e, d, margin = 0) => madd(e.c, d, radius(e, d) + margin);

function glide(e, d0, d1, n, m0, m1) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return scalp(e, norm(lerp(d0, d1, t)), Array.isArray(m0) ? m0[i] : m0 + (m1 - m0) * t);
  });
}

function spline(P, t) {
  const n = P.length - 1;
  const x = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(x);
  const u = x - i;
  const p0 = P[Math.max(0, i - 1)];
  const p1 = P[i];
  const p2 = P[i + 1];
  const p3 = P[Math.min(n, i + 2)];
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u));
}

function along(G, f) {
  const L = G.slice(1).map((p, i) => len(sub(p, G[i])));
  let left = f * L.reduce((a, b) => a + b, 0);
  const out = [G[0]];
  for (let i = 0; i < L.length; i++) {
    if (left <= L[i]) {
      const p = lerp(G[i], G[i + 1], left / L[i]);
      if (left > 0.3 * L[i] || out.length < 2) out.push(p);
      else out[out.length - 1] = p;
      return out;
    }
    left -= L[i];
    out.push(G[i + 1]);
  }
  return out;
}

const perp = (v, a) => sub(v, mul(a, dot(v, a)));
const wobble = (rng, v, a) => add(v, [rng.range(-a, a), rng.range(-a, a), rng.range(-a, a)]);

function rig(sk, rng, wind, m) {
  const F = sk.head;
  const k = sk.hk;
  const e = sk.skull || SKULL[sk.spec.sex];
  const H = (l) => toWorld(F, l.map((v) => v * k));
  const fwd = norm([F.x[0], 0, F.x[2]]);
  const calm = madd(wind, fwd, -0.7 * Math.max(0, dot(wind, fwd)));
  const s = sk.s;
  const B = (Fr, o, l) => toWorld({ ...Fr, o }, l.map((v) => v * s));
  return { sk, rng, wind: calm, m, F, k, e, H, B, C: H(e.c), gust: [dot(calm, F.x), dot(calm, F.y), dot(calm, F.z)], down: [-F.x[1], -F.y[1], -F.z[1]], near: Math.sign(F.z[2]) || 1, items: [] };
}

function ribbon(h, pts, w, segs, { tip = 0.0005, power = 1, swell = 0.25, flat = 3, face = [0.15, 0.55], k = 0.0014, m = h.m } = {}) {
  const P = Array.from({ length: segs + 1 }, (_, i) => spline(pts, i / segs));
  const r = (t) => (tip + (w - tip) * (1 - t) ** power * (1 + swell * Math.sin(Math.PI * t))) * h.k;
  const leaves = P.slice(0, -1).map((a, i) => {
    const b = P[i + 1];
    const ax = norm(sub(b, a));
    const c = lerp(a, b, 0.5);
    const o = norm(sub(c, [h.C[0], Math.min(c[1], h.C[1]), h.C[2]]));
    const f = face[0] + (face[1] - face[0]) * (i / segs);
    let n = perp(add(mul(o, 1 - f), mul(h.F.z, f * (Math.sign(dot(o, h.F.z)) || 1))), ax);
    if (len(n) < 0.2) n = perp(h.F.z, ax);
    return blade(a, b, r(i / segs), r((i + 1) / segs), n, flat, m, [i / segs, (i + 1) / segs]);
  });
  h.items.push(smin(k * h.k, leaves));
}

function blow(h, pts, amt, from = 0.3) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const t = Math.max(0, (i / (pts.length - 1) - from) / (1 - from));
    const d = sub(pts[i], pts[i - 1]);
    out.push(madd(out[i - 1], norm(madd(norm(d), h.wind, amt * t ** 1.2)), len(d)));
  }
  return out;
}

function strand(h, d0, d1, { lift = 0.01, n = 3, length = 0.04, out = [0, 0, 0], bend = [0, 0, 0], sink = -0.003 }) {
  const path = glide(h.e, norm(d0), norm(d1), n, sink, lift);
  const a = path[n - 1];
  const o = norm(add(norm(sub(a, path[n - 2])), out));
  const mid = madd(a, o, length * 0.5);
  return [...path, mid, madd(mid, norm(add(o, bend)), length * 0.5)];
}

function cap(h, grow, hairline = [0.066, 0.058]) {
  const { F, k, e, H } = h;
  h.items.push(ell(H([e.c[0] - 0.004, e.c[1] + 0.003, 0]), e.r.map((v) => (v + grow) * k), F, h.m, F.y, [plane(toDir(F, [0.78, -0.62, 0]), H([...hairline, 0]))]));
}

const accent = (h) => h.m - (h.m & 15) + MAT.dress;

function band(h, at, dir, r = 0.013) {
  const c = h.H(at);
  const a = norm(toDir(h.F, dir));
  h.items.push(rc(madd(c, a, -0.004 * h.k), madd(c, a, 0.004 * h.k), r * h.k, r * h.k, accent(h)));
}

function bangs(h, { count, z = 0.07, drop = 0.02, gap = 0, sweep = 0, lift = 0.01, width = 0.016, between = false, split = false }) {
  const { rng } = h;
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const away = Math.sign(u * z - gap) || 1;
    const zz = u * z + rng.range(-0.006, 0.006) + (split ? away * 0.01 : 0);
    const fall = Math.abs(zz) < 0.014 && between && !split ? drop + 0.026 : drop * (1 - 0.35 * u * u) + rng.range(-0.006, 0.008);
    const turn = split ? away * 0.9 : away * 0.25 + sweep * 0.6;
    const d0 = [0.25 + rng.range(-0.08, 0.08), 0.97, zz * 3.2 + sweep * 0.4];
    const d1 = [0.96, 0.2 + rng.range(-0.04, 0.04), zz * 7 + sweep * 0.3];
    const pts = strand(h, d0, d1, { lift: lift + rng.range(-0.002, 0.003), length: 0.026 + fall, out: [0.05, -1.4, turn + zz * 3], bend: [-0.15, -0.3, away * rng.range(0.1, 0.6) + sweep] });
    ribbon(h, blow(h, pts.map(h.H), 0.3), width * rng.range(0.85, 1.15), 5, { face: [0.1, 0.25], swell: 0.3 });
  }
}

function crown(h, { count = 10, part = 0, vol = 0.01, length = [0.04, 0.07], flow = 0.6 }) {
  const { rng } = h;
  for (let i = 0; i < count; i++) {
    const u = (i / (count - 1)) * 2 - 1;
    const side = Math.sign(u) || 1;
    const pts = strand(h, [-0.05, 0.99, part * 0.3], [0.1 - Math.abs(u) * 0.6, 0.1, u * 0.95], { lift: vol, length: rng.range(...length), out: [-0.4, -0.8, side * 0.3], bend: [rng.range(-0.3, 0.1), -0.2, side * 0.3] });
    ribbon(h, blow(h, pts.map(h.H), flow), rng.range(0.02, 0.026), 5, { face: [0.2, 0.7] });
  }
}

function sidelocks(h, { tuck, count = 2, long = true, flow = 0.8 }) {
  const { sk, rng, B } = h;
  for (const side of [-1, 1]) {
    const tucked = tuck === side;
    if (!long) {
      if (tucked) continue;
      for (let j = 0; j < count; j++) {
        const pts = strand(h, [0.5 - j * 0.2, 0.55, side * 0.7], [0.32 - j * 0.15, -0.15, side * 0.92], { lift: 0.008, length: rng.range(0.05, 0.09), out: [0.1, -1.2, side * 0.15], bend: [0.3, -0.2, -side * 0.2] });
        ribbon(h, blow(h, pts.map(h.H), flow), rng.range(0.014, 0.018), 6, { face: [0.4, 0.8] });
      }
      continue;
    }
    const shoulder = (side < 0 ? sk.arms.L : sk.arms.R).S;
    for (let j = 0; j < count; j++) {
      const path = glide(h.e, norm([0.42 - j * 0.3, 0.62, side * 0.68]), norm(tucked ? [-0.35, -0.2, side * 0.92] : [0.42 - j * 0.25, -0.35, side * 0.86]), 3, -0.003, 0.01);
      const S1 = B(sk.F2, shoulder, [tucked ? -0.09 : 0.06 - j * 0.03, 0.06, -side * 0.025]);
      const S2 = B(sk.F2, sk.P2, [tucked ? -0.12 : 0.1 - j * 0.02, -0.03 - j * 0.04 + rng.range(-0.03, 0.02), side * 0.08]);
      ribbon(h, blow(h, [...path.map(h.H), S1, S2], flow, 0.4), rng.range(0.016, 0.02), 7, { power: 0.8, face: [0.3, 0.8] });
    }
  }
}

function longBack(h, { count = 16, reach = 0.8, stagger = 0.3, flow = 1, bulk = 0.05, wave = 0, width = 0.027 }) {
  const { sk, rng, B } = h;
  const { F0, F1, F2, P0, P1, P2, P3 } = sk;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const az = Math.PI * (0.56 + t * 0.88) + rng.range(-0.05, 0.05);
    const el = rng.range(-0.1, 0.7);
    const d0 = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const z = d0[2];
    const path = glide(h.e, d0, norm([-0.72, -0.64, z * 0.8]), 3, -0.003, 0.014);
    const spread = z * 0.1 + rng.range(-0.012, 0.012);
    const out = rng.range(0, bulk);
    const ph = rng.range(0, 6.28);
    const wv = (q) => wave * Math.sin(ph + q * 2.2);
    const j = (a = 0.01) => rng.range(-a, a);
    const G = [
      B(F2, P3, [-0.105 - out * 0.5 + j(), -0.03, spread]),
      B(F2, P2, [-0.13 - out + j() + wv(1), -0.03, spread * 1.12]),
      B(F1, P1, [-0.12 - out * 0.8 + j() + wv(2), 0.02, spread * 1.05]),
      B(F1, P1, [-0.115 - out * rng.range(0.4, 1.2) + wv(3), -0.12, spread]),
      B(F0, P0, [-0.1 - out * rng.range(0.2, 1.4) + j(0.02) + wv(4), -0.12, spread * 0.9]),
    ];
    const pts = [...path.map(h.H), ...along(G, reach * (1 - stagger * rng() * (0.6 + Math.abs(t - 0.5))))];
    ribbon(h, blow(h, pts, flow * rng.range(0.7, 1.3), 0.35), width * rng.range(0.9, 1.1), Math.max(5, pts.length), { power: 0.75, swell: 0.35, face: [0.3, 0.75], flat: 2.5 });
  }
}

function tail(h, tie, dir, { count, length, spread = 0.03, rise = 0.03, reach = 0.6, flow = 1, side = 0, width = 0.024 }) {
  const { sk, rng, B, H } = h;
  const back = side ? 0.03 : 0.09;
  const swing = rng.range(0.02, 0.06);
  for (let j = 0; j < count; j++) {
    const u = (j / (count - 1)) * 2 - 1;
    const z = u * spread + rng.range(-0.006, 0.006);
    const fan = rng.range(-1, 1);
    const p1 = add(tie, [-0.02 - back * 0.25, rise, side * 0.04 + z * 0.5]);
    const p2 = add(tie, [-back * (1 + fan * 0.3), rise * 0.4 - 0.02 + fan * 0.012, side * 0.09 + z]);
    const W = H(p2);
    const drop = (f, x, zz) => add(madd(W, [0, -1, 0], length * f), add(mul(h.F.x, x * h.k), mul(h.F.z, side * zz * h.k)));
    const G = side
      ? [W, drop(0.3, -swing * 0.5, 0.04), drop(0.65, fan * 0.03 - swing, 0.03), drop(1, fan * 0.07 - swing * 0.6, 0.02)]
      : [W, B(sk.F2, sk.P3, [-0.15 - 0.03 * (1 + fan), 0.02, z * 1.5]), B(sk.F2, sk.P2, [-0.16 - 0.045 * (1 + fan), -0.02, z * 1.8]), B(sk.F1, sk.P1, [-0.15 - 0.06 * (1 + fan), -0.04, z * 1.6])];
    const pts = [H(tie), H(p1), ...along(G, side ? rng.range(0.6, 1) : reach * rng.range(0.55, 1))];
    ribbon(h, blow(h, pts, flow * rng.range(0.7, 1.3), 0.3), width * rng.range(0.85, 1.15), Math.max(6, pts.length + 1), { power: 0.8, swell: 0.5, face: side ? [0.2, 0.4] : [0.6, 0.9] });
  }
  band(h, tie, dir);
}

function pulled(h, tieD, starts) {
  for (const d0 of starts) {
    const path = glide(h.e, norm(d0), tieD, 4, 0.001, 0.007);
    ribbon(h, path.map(h.H), 0.019, 4, { tip: 0.004, power: 0.5, swell: 0.1, face: [0, 0] });
  }
}

function fib(i, n, lo = -0.6) {
  const y = 1 - ((i + 0.5) / n) * (1 - lo);
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = i * 2.39996;
  return [Math.cos(phi) * ring, y, Math.sin(phi) * ring];
}

function flowAt(sweep, d) {
  const t = perp(sweep, d);
  return norm(len(t) < 0.3 ? add(t, perp([0, -1, 0], d)) : t);
}

const forehead = (d) => d[0] > 0.3 && Math.abs(d[2]) < 0.55 && d[1] < 0.8;

function flowLocks(h, { count, field, vol, lift, length, width = [0.022, 0.03], arc = [0.5, 0.9], lo = -0.3, skip = forehead, flow = 0.6, fall = 0.3, hug = false }) {
  const { rng } = h;
  for (let i = 0; i < count; i++) {
    const d0 = norm(wobble(rng, fib(i, count, lo), 0.06));
    if (skip(d0)) continue;
    const t = norm(add(field(d0), mul(perp(h.down, d0), fall)));
    const d1 = norm(madd(d0, t, rng.range(...arc)));
    const up = lift * (1 - 0.75 * Math.max(0, -dot(d1, h.down)));
    const v = vol * rng.range(0.6, 1.3);
    const L = rng.range(...length);
    const out = wobble(rng, mul(d1, up), 0.12);
    const bend = add(mul(d1, up * rng.range(0.5, 1.6)), mul(t, 0.2));
    const d2 = norm(madd(d1, t, L / 0.09));
    const pts = hug && d2[1] > -0.45 && rng() > 0.2 ? glide(h.e, d0, d2, 5, [-0.003, v * 0.7, v, v + up * L * 0.3, v + up * L * 0.9]) : strand(h, d0, d1, { lift: v, length: L, out, bend });
    ribbon(h, blow(h, pts.map(h.H), flow), rng.range(...width), 5, { face: [0.05, 0.3], flat: 2.4 });
  }
}

function spiky(h) {
  const { rng, gust } = h;
  const sweep = norm(add([-1, rng.range(-0.1, 0.25), rng.range(-0.5, 0.5)], mul(gust, rng.range(0.8, 1.6))));
  const vol = rng.range(0.008, 0.014);
  cap(h, 0.01, [0.068, 0.056]);
  flowLocks(h, { count: rng.int(30, 36), field: (d) => flowAt(sweep, d), vol, lift: rng.range(0.15, 0.45), length: [0.035, 0.065] });
  bangs(h, { count: rng.int(3, 5), z: 0.055, drop: rng.range(0.012, 0.026), sweep: rng.range(-0.4, 0.4), lift: vol * 0.9, width: 0.024, between: rng.chance(0.5) });
}

function sweptBack(h) {
  const { rng, gust } = h;
  const vol = rng.range(0.014, 0.024);
  const sweep = norm(add([-1, rng.range(0.1, 0.4), rng.range(-0.2, 0.2)], mul(gust, 0.6)));
  cap(h, 0.01, [0.072, 0.06]);
  flowLocks(h, { count: rng.int(26, 32), field: (d) => flowAt(sweep, d), vol, lift: rng.range(0.2, 0.45), length: [0.035, 0.065], arc: [0.8, 1.3], lo: -0.2, skip: (d) => d[0] < -0.75 || (d[0] > 0.55 && d[1] < 0.75), flow: 0.7, fall: 0.6, hug: true });
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const pts = strand(h, [0.6, 0.25 - j * 0.25, side * 0.75], [-0.45, 0.05 - j * 0.2, side * 0.88], { lift: vol * 0.5, length: rng.range(0.025, 0.045), out: [-0.8, 0.2, side * 0.3], bend: [-0.2, 0.3, side * 0.2] });
      ribbon(h, blow(h, pts.map(h.H), 0.7), rng.range(0.018, 0.024), 5, { face: [0.05, 0.3], flat: 2.4 });
    }
  }
  for (let j = rng.int(1, 3); j > 0; j--) {
    const z = rng.range(-0.25, 0.25);
    const pts = strand(h, [0.5, 0.85, z], [0.97, 0.3, z * 1.5], { lift: vol * 0.9, length: rng.range(0.03, 0.05), out: [0.2, -1.3, z], bend: [-0.3, -0.2, rng.range(-0.8, 0.8)] });
    ribbon(h, blow(h, pts.map(h.H), 0.5), rng.range(0.008, 0.012), 5);
  }
}

function shaggy(h) {
  const { rng, e, gust } = h;
  const vol = rng.range(0.01, 0.016);
  const whorl = norm([-0.3 + rng.range(-0.1, 0.1), 0.95, rng.range(-0.2, 0.2)]);
  const fall = [-0.2, -1, 0];
  cap(h, 0.011, [0.07, 0.054]);
  flowLocks(h, { count: rng.int(30, 36), field: (d) => flowAt(add(add(mul(norm(sub(d, whorl)), 1.2), mul(fall, 0.8)), mul(gust, 0.6)), d), vol, lift: rng.range(0.15, 0.4), length: [0.045, 0.085], arc: [0.6, 1], lo: -0.4, fall: 0.8 });
  bangs(h, { count: rng.int(5, 7), z: 0.065, drop: rng.range(0.016, 0.03), sweep: rng.range(-0.3, 0.3), lift: vol * 0.8, width: 0.018, between: rng.chance(0.7) });
  if (rng.chance(0.75)) {
    const dir = norm([-0.85, -0.45, 0]);
    const tie = scalp(e, dir, 0.01);
    const drop = rng.range(0.05, 0.1);
    for (let j = 0; j < 4; j++) {
      const z = (j / 3 - 0.5) * 0.016;
      const pts = [tie, add(tie, [-0.012, -0.03, z]), add(tie, [-0.02, -0.03 - drop * 0.6, z * 1.5]), add(tie, [-0.03 - rng.range(0, 0.02), -0.03 - drop, z * 2])];
      ribbon(h, blow(h, pts.map(h.H), 1), 0.013, 5, { face: [0.6, 0.9], swell: 0.4 });
    }
    band(h, tie, [0.3, -1, 0], 0.01);
  }
}

function curtain(h) {
  const { rng, gust } = h;
  const part = rng.range(-0.12, 0.12);
  const vol = rng.range(0.009, 0.015);
  cap(h, 0.01, [0.068, 0.056]);
  for (const side of [-1, 1]) {
    for (let j = rng.int(2, 3) - 1; j >= 0; j--) {
      const pts = strand(h, [0.5 - j * 0.15, 0.86, part + side * (0.04 + j * 0.1)], [0.94, 0.25 - j * 0.05, side * (0.3 + j * 0.18)], { lift: vol, length: rng.range(0.03, 0.045), out: [-0.25, -1.1, side * 0.9], bend: [-0.4, -0.1, side * 0.3] });
      ribbon(h, blow(h, pts.map(h.H), 0.5), rng.range(0.019, 0.023), 5, { face: [0.1, 0.4] });
    }
  }
  flowLocks(h, { count: rng.int(28, 34), field: (d) => flowAt(add(add([0, 0, Math.sign(d[2] - part) * 1.2], [-0.3, -1, 0]), mul(gust, 0.5)), d), vol, lift: rng.range(0.15, 0.4), length: [0.035, 0.065], arc: [0.6, 1], lo: -0.4, skip: (d) => d[0] > 0.3 && d[1] < 0.75, fall: 0.8 });
}

function longStraight(h, { tuck }) {
  const { rng } = h;
  const part = rng.range(-0.3, 0.3);
  const vol = rng.range(0.006, 0.012);
  cap(h, 0.008);
  bangs(h, { count: rng.int(5, 8), z: 0.066, drop: rng.range(0.01, 0.022), gap: part * 0.05, sweep: part * rng.range(0, 0.6), lift: vol, width: 0.015, between: rng.chance(0.6) });
  crown(h, { part, vol });
  sidelocks(h, { tuck });
  const layered = rng.chance(0.6);
  longBack(h, { count: layered ? 14 : 16, reach: rng.range(0.6, 1), flow: rng.range(0.6, 1.2) });
  if (layered) longBack(h, { count: 7, reach: rng.range(0.22, 0.38), stagger: 0.3, bulk: 0.09, flow: 1.2 });
}

function windBlown(h, { tuck }) {
  const { rng } = h;
  const w = { ...h, wind: mul(norm(h.wind), Math.min(0.6, Math.max(len(h.wind), 0.4))) };
  const part = rng.range(-0.3, 0.3);
  const vol = rng.range(0.008, 0.014);
  cap(h, 0.008);
  bangs(w, { count: rng.int(5, 7), z: 0.066, drop: rng.range(0.012, 0.024), gap: part * 0.05, sweep: Math.sign(h.gust[2]) * rng.range(0.2, 0.6), lift: vol, width: 0.015 });
  crown(w, { part, vol, length: [0.05, 0.09], flow: 1.4 });
  sidelocks(w, { tuck, flow: 1.8 });
  longBack(w, { reach: rng.range(0.7, 1), flow: rng.range(1.8, 2.8), wave: rng.range(0.02, 0.04), stagger: 0.4, bulk: 0.07 });
}

function ponytail(h, { tuck }) {
  const { rng, e } = h;
  const tieD = norm([-0.62 + rng.range(-0.15, 0.1), 0.7 + rng.range(-0.2, 0.15), 0]);
  const tie = scalp(e, tieD, 0.012);
  cap(h, 0.006);
  pulled(h, tieD, Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI * (-0.85 + (1.7 * i) / 9);
    return [Math.cos(a) * 0.85, 0.35 + 0.15 * Math.cos(a), Math.sin(a) * 0.9];
  }));
  tail(h, tie, tieD, { count: rng.int(8, 11), spread: rng.range(0.02, 0.035), rise: rng.range(0.02, 0.06), reach: rng.range(0.45, 1), flow: rng.range(0.8, 1.8) });
  bangs(h, { count: rng.int(5, 7), z: 0.064, drop: rng.range(0.008, 0.02), sweep: rng.range(-0.4, 0.4), lift: 0.008, width: 0.015, between: rng.chance(0.5), split: rng.chance(0.3) });
  sidelocks(h, { tuck, count: 1, long: false });
}

function twinTails(h, { tuck }) {
  const { rng, e } = h;
  const high = rng.range(0.35, 0.75);
  const length = rng.range(0.22, 0.42);
  cap(h, 0.006);
  bangs(h, { count: rng.int(5, 7), z: 0.064, drop: rng.range(0.008, 0.02), lift: 0.008, width: 0.015, between: rng.chance(0.5), split: rng.chance(0.4) });
  sidelocks(h, { tuck, count: 1, long: false });
  for (const side of [-1, 1]) {
    const tieD = norm([-0.3, high, side * 0.85]);
    pulled(h, tieD, [[0.6, 0.6, side * 0.3], [0.1, 0.98, side * 0.15], [-0.6, 0.5, side * 0.3], [-0.6, -0.2, side * 0.6]]);
    tail(h, scalp(e, tieD, 0.01), tieD, { count: rng.int(5, 7), length, spread: 0.02, rise: rng.range(0.01, 0.03), side, flow: 1.2, width: 0.022 });
  }
}

const STYLES = {
  m: [spiky, sweptBack, shaggy, curtain],
  f: [longStraight, windBlown, ponytail, twinTails],
};

export function hairdo(sk, rng, wind, m, opts = {}) {
  const h = rig(sk, rng, wind, m);
  rng.pick(STYLES[sk.spec.sex])(h, opts);
  return smin(0.004 * h.k, h.items);
}
