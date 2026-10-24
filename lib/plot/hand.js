import { random } from "../random.js";
import { blade, box, ell, plane, rc, smin } from "./figure.js";
import { cross, lerp, madd, norm, rotate, toDir, toWorld } from "./math.js";

const FINGERS = [
  { z: 0.37, x: -0.003, r: 1.0, fan: 1.6 },
  { z: 0.125, x: 0, r: 1.06, fan: 0.45 },
  { z: -0.125, x: -0.004, r: 0.97, fan: -0.5 },
  { z: -0.37, x: -0.013, r: 0.84, fan: -1.5 },
];

const GESTURES = {
  hang: { curl: [0.32, 0.55, 0.36], cascade: 0.5, spread: 0.05, thumb: { a: 0.45, e: 0.6, bend: [0.25, 0.3], toward: [0.3, 1, -0.5] } },
  cradle: { curl: [0.08, 0.13, 0.1], cascade: 0.35, spread: 0.04, thumb: { dirs: [[0.45, 0.35, 0.82], [0.5, 0.7, -0.35], [0.45, 0.05, -0.88]] } },
  rest: { curl: [0.17, -0.1, 0.06], cascade: 0.08, spread: 0.035, thumb: { a: 0.42, e: 0.25, bend: [0.12, 0.16], toward: [0.6, 0.5, -0.3] } },
  palm: { curl: [0.04, 0.07, 0.05], cascade: 0.6, spread: 0.11, thumb: { a: 0.8, e: 0.1, bend: [0.05, 0.1], toward: [1, 0.2, 0] } },
  grip: { curl: [0.45, 0.65, 0.42], cascade: 0.3, spread: 0.05, thumb: { a: 0.85, e: 0.7, bend: [0.3, 0.35], toward: [0.6, 1, -0.6] } },
  wrap: { curl: [0.4, 0.55, 0.36], cascade: 0.25, spread: 0.06, thumb: { a: 0.6, e: 0.35, bend: [0.15, 0.2], toward: [1, 0.4, 0] } },
  cup: { curl: [0.12, 0.22, 0.15], cascade: 0.4, spread: 0.08, thumb: { a: 0.3, e: 0.35, bend: [0.15, 0.2], toward: [1, 0.6, -0.4] } },
  waist: { curl: [0.2, 0.3, 0.2], cascade: 0.35, spread: 0.09, thumb: { a: 0.8, e: 0.25, bend: [0.1, 0.15], toward: [1, 0.4, 0] } },
};

export function handGenome(sex, rng) {
  const f = sex === "f";
  const R = (a, b) => rng.range(a, b);
  const L = R(0.084, 0.094);
  const mid = L * (f ? R(0.98, 1.12) : R(0.9, 1.04));
  return {
    sex,
    seed: Math.floor(rng() * 1e9),
    palm: { L, W: f ? R(0.07, 0.078) : R(0.08, 0.09), T: f ? R(0.019, 0.022) : R(0.022, 0.026), wrist: R(0.8, 0.9) },
    fingers: [R(0.86, 0.95), 1, R(0.9, 0.98), R(0.7, 0.8)].map((ratio, i) => ({ len: mid * ratio, split: [R(0.47, 0.53), R(0.27, 0.31)], x: FINGERS[i].x + R(-0.003, 0.003) })),
    thick: f ? R(0.098, 0.108) : R(0.106, 0.118),
    taper: f ? R(0.42, 0.56) : R(0.6, 0.74),
    knuckle: f ? R(1.03, 1.08) : R(1.06, 1.14),
    thumb: { len: mid * R(0.88, 1.0), r: f ? R(0.98, 1.08) : R(1.05, 1.16), a: R(-0.12, 0.12), e: R(-0.1, 0.1) },
    nail: rng.pick(f ? ["almond", "almond", "round", "square"] : ["round", "square", "square"]),
    splay: R(0.7, 1.3),
    cascade: R(0.7, 1.4),
    curl: Array.from({ length: 4 }, () => R(0.85, 1.18)),
  };
}

function chain(base, dirs, lens, rad, bulge, m, k, flat = 1.12) {
  const pts = [base];
  for (let j = 0; j < lens.length; j++) pts.push(madd(pts[j], dirs[j].d, lens[j]));
  const total = lens.reduce((a, b) => a + b, 0);
  const at = (j) => lens.slice(0, j).reduce((a, b) => a + b, 0) / total;
  const leaves = [];
  for (let j = 0; j < lens.length; j++) {
    const { d, n } = dirs[j];
    const last = j === lens.length - 1;
    const r0 = rad(at(j)) * bulge;
    const r1 = last ? rad(1) : rad(at(j + 1)) * bulge;
    const mid = lerp(pts[j], pts[j + 1], 0.5);
    const rm = rad((at(j) + at(j + 1)) / 2) * 0.93;
    const b = last ? madd(pts[j + 1], d, -r1 * 0.6) : pts[j + 1];
    leaves.push(smin(j === 0 ? 0.004 * k : 0.0007 * k, [blade(pts[j], mid, r0, rm, n, flat, m)]));
    leaves.push(smin(0.0007 * k, [blade(mid, b, rm, r1, n, flat, m)]));
  }
  return { pts, leaves };
}

export function handRig(arm, k, g) {
  const H = arm.hand;
  const ts = arm.side;
  const G = GESTURES[arm.gesture] || GESTURES.hang;
  const hr = random((g.seed ^ (ts > 0 ? 0x2545f491 : 0x9e3779b9)) >>> 0);
  const L = (l) => toWorld(H, [l[0] * k, l[1] * k, l[2] * k * ts]);
  const D = (l) => norm(toDir(H, [l[0], l[1], l[2] * ts]));
  const { W, T } = g.palm;
  const fingers = g.fingers.map((f, i) => {
    const F = FINGERS[i];
    const fan = G.spread * g.splay * F.fan + hr.range(-0.025, 0.025);
    let d = rotate(H.x, H.y, -fan * ts);
    const axis = norm(cross(H.y, d));
    const r0 = W * g.thick * F.r * k;
    const lens = [f.split[0], f.split[1], 1 - f.split[0] - f.split[1]].map((s) => s * f.len * k);
    const dirs = G.curl.map((c, j) => {
      const amt = c * g.curl[i] * (1 + G.cascade * g.cascade * (i / 3) * [1, 0.6, 0.5][j]) + hr.range(-0.04, 0.04);
      d = rotate(d, axis, -amt);
      return { d, n: norm(cross(axis, d)) };
    });
    return { base: L([g.palm.L + f.x, -0.1 * T, F.z * W]), dirs, lens, axis, rad: (t) => r0 * (1 - (1 - g.taper) * t ** 1.3), r0 };
  });
  const tg = G.thumb;
  const a = (tg.a || 0) + g.thumb.a + hr.range(-0.08, 0.08);
  const e = (tg.e || 0) + g.thumb.e + hr.range(-0.06, 0.06);
  let td = D([Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]);
  const tlens = [0.42, 0.32, 0.26].map((s) => s * g.thumb.len * k);
  const tdirs = [0, 1, 2].map((j) => {
    if (tg.dirs) td = D(tg.dirs[j].map((v, c) => v + (c === 1 ? g.thumb.e * 0.3 : 0) + hr.range(-0.05, 0.05)));
    else if (j) td = rotate(td, norm(cross(td, D(tg.toward))), tg.bend[j - 1]);
    const side = norm(cross(td, H.y));
    return { d: td, n: norm(cross(side, td)) };
  });
  const rt = W * g.thick * FINGERS[1].r * g.thumb.r * k;
  const thumb = { base: L([0.02, 0.1 * T, W / 2 - 0.012]), dirs: tdirs, lens: tlens, rad: (t) => rt * (1 - (1 - g.taper) * t ** 1.2), r0: rt };
  return { H, k, ts, L, D, fingers, thumb };
}

export function hand(arm, k, m, g = {}) {
  const genome = g.palm ? g : handGenome(g.sex || "m", random(g.seed || 1));
  const rig = handRig(arm, k, genome);
  const { H, L, D } = rig;
  const { L: PL, W, T, wrist } = genome.palm;
  const x0 = 0.004;
  const dw = (W - W * wrist) / 2;
  const cuts = [-1, 1].map((s) => plane(D([-dw, 0, s * (PL - x0)]), L([PL, 0, (s * W) / 2])));
  const items = [
    smin(0.006 * k, [box(L([(x0 + PL) / 2, 0, 0]), [((PL - x0) / 2) * k, (T / 2) * k, (W / 2) * k], T * 0.42 * k, H, m, H.x, cuts)]),
    smin(0.008 * k, [ell(L([0.034, 0.18 * T, W / 2 - 0.013]), [0.03 * k, T * 0.5 * k, 0.016 * k], H, m)]),
    smin(0.008 * k, [ell(L([0.032, 0.15 * T, -(W / 2 - 0.011)]), [0.03 * k, T * 0.45 * k, 0.012 * k], H, m)]),
  ];
  const fi = rig.fingers[0];
  const fp = rig.fingers[3];
  items.push(smin(0.005 * k, [rc(fi.base, fp.base, fi.r0 * 1.02, fp.r0 * 1.02, m)]));
  const out = [];
  for (const f of rig.fingers) {
    const c = chain(f.base, f.dirs, f.lens, f.rad, genome.knuckle, m, k);
    items.push(...c.leaves);
    out.push({ pts: c.pts, dirs: f.dirs, rad: f.rad, lens: f.lens });
  }
  const t = rig.thumb;
  const knuckle = madd(t.base, t.dirs[0].d, t.lens[0]);
  items.push(smin(0.008 * k, [rc(t.base, knuckle, t.r0 * 1.15, t.rad(0.42) * genome.knuckle, m)]));
  const tc = chain(knuckle, t.dirs.slice(1), t.lens.slice(1), (u) => t.rad(0.42 + u * 0.58), genome.knuckle, m, k, 1.08);
  items.push(...tc.leaves);
  arm.rig = { fingers: out, thumb: { pts: [t.base, ...tc.pts], dirs: t.dirs, rad: t.rad, lens: t.lens }, H, k, ts: rig.ts, nail: genome.nail, sex: genome.sex };
  return smin(0.006 * k, items);
}
