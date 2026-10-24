import { MAT, blade, box, ell, hmin, plane, rc, smin, sph } from "./figure.js";
import { add, cross, dot, frame, len as len3, lerp, madd, mul, norm, rotate, sub, toDir, toWorld } from "./math.js";

export function skirt(top, bottom, r1, r2, side, m, { folds = 11, depth = 0.016, sharp = 0, power = 1, thick = 0, ex = 1, cut } = {}) {
  const axis = norm(sub(bottom, top));
  const u = norm(cross(axis, side));
  const v = cross(axis, u);
  return { kind: "skirt", a: top, b: bottom, r1, r2, u, v, folds, depth, sharp, power, thick, ex, m, axis, cut };
}

function hips(sk, m, e) {
  const { s, F0 } = sk;
  return ell(toWorld(F0, [-0.012 * s, -0.025 * s, 0]), [0.1 * s + e, 0.13 * s, 0.152 * s + e], F0, m);
}

function ribbon(points, width, normal, m, f = 3.5, tip = 0.25) {
  const items = [];
  for (let i = 0; i < points.length - 1; i++) {
    const t0 = i / (points.length - 1);
    const t1 = (i + 1) / (points.length - 1);
    const r = (t) => width * (1 - (1 - tip) * t ** 1.6);
    items.push(blade(points[i], points[i + 1], r(t0), r(t1), normal(t0, points[i], points[i + 1]), f, m, [t0, t1]));
  }
  return smin(width * 0.25, items);
}

function shell(sk, e, m, sleeve) {
  const { s, F0, F1, F2, arms } = sk;
  const S = (l) => l.map((v) => v * s);
  const E = e * s;
  const shoulders = [arms.L, arms.R].flatMap((A) => {
    const N = toWorld(F2, S([-0.018, 0.17, A.side * 0.04]));
    const T = madd(A.S, F2.y, 0.018 * s);
    const z = norm(sub(T, N));
    const y = norm(madd(F2.y, z, -dot(F2.y, z)));
    const Fr = { o: lerp(N, T, 0.5), x: cross(y, z), y, z };
    const half = [0.052 * s + E, 0.028 * s + E, (len3(sub(T, N)) / 2) + 0.012 * s];
    return [box(Fr.o, half, 0.018 * s + E * 0.5, Fr, m, z), sph(A.S, 0.044 * s + E, m)];
  });
  const sleeves = [arms.L, arms.R].flatMap((A) => {
    const end = lerp(A.elbow, A.wrist, sleeve);
    const cuff = lerp(A.elbow, A.wrist, Math.max(0.05, sleeve - 0.07));
    return [rc(A.S, A.elbow, 0.046 * s + E, 0.036 * s + E, m), rc(A.elbow, end, 0.037 * s + E, 0.031 * s + E, m), rc(cuff, end, 0.035 * s + E * 1.25, 0.034 * s + E * 1.25, m, undefined, plane(sub(end, cuff), end))];
  });
  return [
    ell(toWorld(F1, S([0.008, 0.01, 0])), [0.084 * s + E, 0.12 * s, 0.12 * s + E], F1, m),
    ell(F2.o, [0.1 * s + E, 0.158 * s, 0.144 * s + E], F2, m),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.048, 0.035, z * 0.062])), [0.045 * s + E, 0.068 * s, 0.07 * s + E], F2, m)),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([-0.03, 0.02, z * 0.08])), [0.058 * s + E, 0.12 * s, 0.068 * s + E], F2, m)),
    ...shoulders,
    ...sleeves,
    ell(toWorld(F0, S([0, 0.05, 0])), [0.102 * s + E, 0.07 * s, 0.158 * s + E], F0, m),
  ];
}

function pants(sk, m, o) {
  const { s, F0, legs } = sk;
  const S = (l) => l.map((v) => v * s);
  const w = o.slim ?? 1;
  return smin(0.02 * s, [
    ell(toWorld(F0, S([-0.004, 0.005, 0])), S([0.104, 0.106, 0.16]), F0, m),
    ...[-1, 1].map((z) => ell(toWorld(F0, S([-0.045, -0.055, z * 0.068])), S([0.074, 0.09, 0.076]), F0, m)),
    ...[legs.L, legs.R].flatMap((L) => {
      const hem = madd(L.ankle, [0, 1, 0], 0.035 * s);
      return [rc(L.H, L.knee, 0.094 * s, 0.062 * s * w, m), rc(L.knee, madd(hem, [0, 1, 0], -0.02 * s), 0.061 * s * w, 0.056 * s * w, m, undefined, plane([0, -1, 0], hem))];
    }),
  ]);
}

function chestSurface(sk, E) {
  const { s, F1, F2 } = sk;
  const shapes = [
    { F: F2, c: [0, 0, 0], r: [0.1 * s + E, 0.158 * s, 0.144 * s + E] },
    { F: F1, c: [0.008 * s, 0.01 * s, 0], r: [0.084 * s + E, 0.12 * s, 0.12 * s + E] },
    ...[-1, 1].map((z) => ({ F: F2, c: [0.048 * s, 0.035 * s, z * 0.062 * s], r: [0.045 * s + E, 0.068 * s, 0.07 * s + E] })),
  ];
  const inside = (P) =>
    shapes.some(({ F, c, r }) => {
      const d = sub(P, toWorld(F, c));
      return (dot(d, F.x) / r[0]) ** 2 + (dot(d, F.y) / r[1]) ** 2 + (dot(d, F.z) / r[2]) ** 2 < 1;
    });
  return (y, z, lift) => {
    let x = 0.3 * s;
    while (x > 0 && !inside(toWorld(F2, [x, y, z]))) x -= 0.003 * s;
    return toWorld(F2, [x + lift, y, z]);
  };
}

function lapels(sk, m, E, open) {
  const { s, F2 } = sk;
  const on = chestSurface(sk, E);
  return [-1, 1].map((z) => {
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => on((0.15 - t * 0.33) * s, z * (0.075 - t * (0.075 - open)) * s, 0.004 * s));
    return ribbon(pts, 0.04 * s, () => F2.x, m, 6, 0.15);
  });
}

function collar(sk, m, kind) {
  const { s, F2 } = sk;
  if (kind === "stand") {
    const items = [];
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI * (0.32 + (i / 6) * 1.36);
      const a1 = Math.PI * (0.32 + ((i + 1) / 6) * 1.36);
      const at = (a, up) => toWorld(F2, [(Math.cos(a) * (0.07 + up * 0.25) - 0.01) * s, (0.2 + up) * s, Math.sin(a) * (0.075 + up * 0.25) * s]);
      const mid = (a0 + a1) / 2;
      const n = toDir(F2, [Math.cos(mid), -0.25, Math.sin(mid)]);
      items.push(blade(at(a0, 0.01), at(a1, 0.01), 0.04 * s, 0.04 * s, n, 6, m));
    }
    return items;
  }
  return [-1, 1].map((z) => blade(toWorld(F2, [0.035 * s, 0.175 * s, z * 0.05 * s]), toWorld(F2, [0.108 * s, 0.11 * s, z * 0.034 * s]), 0.022 * s, 0.003 * s, toDir(F2, [1, 0.5, z * 0.3]), 3.5, m));
}

function scarf(sk, m, wind, rng) {
  const { s, F2, P3, neckTop } = sk;
  const c = lerp(P3, neckTop, 0.25);
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    const at = (a) => add(c, add(mul(F2.x, Math.cos(a) * 0.072 * s), mul(F2.z, Math.sin(a) * 0.072 * s)));
    ring.push(blade(at(a0), at(a1), 0.036 * s, 0.036 * s, norm(sub(lerp(at(a0), at(a1), 0.5), c)), 3, m));
  }
  const side = rng.chance(0.5) ? 1 : -1;
  const len = rng.range(0.3, 0.5);
  const twist = rng.range(1.5, 3.5);
  const tails = [0, 1].map((j) => {
    const start = toWorld(F2, [0.075 * s, (0.13 - j * 0.02) * s, side * (0.055 - j * 0.02) * s]);
    const reach = len * (1 - j * 0.3);
    const pts = [start];
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const fall = madd(madd(start, [0, -1, 0], (0.06 + t * (0.14 + j * 0.06)) * s), F2.x, 0.035 * s);
      pts.push(add(madd(fall, wind, reach * t * t), mul(F2.z, Math.sin(t * 5 + side + j) * 0.03 * s)));
    }
    return ribbon(pts, 0.042 * s, (t, a, b) => rotate(norm(cross(sub(b, a), F2.z)), sub(b, a), t * twist + j), m, 2.4, 0.8);
  });
  return smin(0.01 * s, [...ring, ...tails]);
}

function tails(sk, m, o, wind) {
  const { s, F1, P0 } = sk;
  const top = madd(F1.o, F1.y, -0.02 * s);
  const bottom = add(add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.02 * s)), mul(wind, o.length * s * o.sway));
  const opt = { folds: o.folds, depth: 0.018 * s, sharp: o.sharp, power: o.power, thick: 0.006 * s };
  const gap = o.gap;
  return [-1, 1].map((z) => {
    const n = add(mul(F1.x, Math.sin(gap)), mul(F1.z, -z * Math.cos(gap)));
    return skirt(top, bottom, 0.118 * s, o.flare * s, F1.z, m, { ...opt, cut: { n: norm(n), d: dot(norm(n), top) } });
  });
}

function shoes(sk, m, f) {
  const { s, legs } = sk;
  return [legs.L, legs.R].map((L) => {
    const F = L.foot;
    const W = (l) => toWorld(F, l.map((v) => v * s));
    const sole = plane(mul(F.y, -1), W([0, f ? -0.068 : -0.078, 0]));
    return f
      ? smin(0.012 * s, [rc(W([-0.02, -0.048, 0]), W([0.15, -0.055, 0]), 0.034 * s, 0.012 * s, m, undefined, sole), rc(W([-0.025, -0.05, 0]), W([-0.025, -0.08, 0]), 0.012 * s, 0.009 * s, m)])
      : smin(0.014 * s, [rc(W([-0.028, -0.05, 0]), W([0.17, -0.06, 0]), 0.044 * s, 0.026 * s, m, undefined, sole), rc(W([-0.01, -0.01, 0]), W([-0.02, -0.06, 0]), 0.042 * s, 0.044 * s, m, undefined, sole)]);
  });
}

function sundress(sk, m, o, wind) {
  const { s, F1, F2, P0 } = sk;
  const S = (l) => l.map((v) => v * s);
  const e = 0.007 * s;
  const cut = { n: F2.y, d: dot(F2.y, toWorld(F2, S([0, o.neck, 0]))) };
  const bottom = add(add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.03 * s)), mul(wind, o.length * s * o.sway));
  return smin(0.016 * s, [
    ell(F2.o, [0.084 * s + e, 0.134 * s, 0.112 * s + e], F2, m, F2.y, cut),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.058, -0.03, z * 0.05])), [0.046 * s + e, 0.05 * s + e, 0.052 * s + e], F2, m, F2.y, cut)),
    ell(toWorld(F1, S([0.006, 0, 0])), [0.066 * s + e, 0.1 * s, 0.09 * s + e], F1, m),
    hips(sk, m, e),
    skirt(madd(F1.o, F1.y, -0.03 * s), bottom, 0.1 * s, o.flare * s, F1.z, m, { folds: o.folds, depth: 0.017 * s, sharp: o.sharp, power: o.power, thick: 0.005 * s, ex: 0.78 }),
    ...[-1, 1].flatMap((z) => [rc(toWorld(F2, S([0.064, 0.04, z * 0.07])), toWorld(F2, S([-0.02, 0.172, z * 0.1])), 0.0065 * s, 0.0065 * s, m), rc(toWorld(F2, S([-0.02, 0.172, z * 0.1])), toWorld(F2, S([-0.085, 0.06, z * 0.07])), 0.0065 * s, 0.0065 * s, m)]),
  ]);
}

function blouse(sk, m) {
  const { s, F1, F2, arms } = sk;
  const S = (l) => l.map((v) => v * s);
  const e = 0.01 * s;
  return smin(0.018 * s, [
    ell(F2.o, [0.084 * s + e, 0.15 * s, 0.112 * s + e], F2, m),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.058, -0.03, z * 0.05])), [0.046 * s + e, 0.05 * s + e, 0.052 * s + e], F2, m)),
    ell(toWorld(F1, S([0.006, 0.01, 0])), [0.066 * s + e, 0.11 * s, 0.09 * s + e], F1, m),
    ...[arms.L, arms.R].flatMap((A) => {
      const end = lerp(A.S, A.elbow, 0.55);
      return [sph(A.S, 0.046 * s, m), rc(A.S, end, 0.046 * s, 0.043 * s, m, undefined, plane(sub(end, A.S), end))];
    }),
  ]);
}

function sailor(sk, o, wind, codes) {
  const { s, F1, F2, P0 } = sk;
  const back = frame(toWorld(F2, [-0.098 * s, 0.11 * s, 0]), F2.y, mul(F2.x, -1));
  const panel = box(back.o, [0.075 * s, 0.006 * s, 0.11 * s], 0.004 * s, { x: back.x, y: back.y, z: back.z }, codes.bottom);
  const vee = [-1, 1].map((z) => ribbon([toWorld(F2, [-0.02 * s, 0.165 * s, z * 0.1 * s]), toWorld(F2, [0.07 * s, 0.11 * s, z * 0.07 * s]), toWorld(F2, [0.115 * s, 0.02 * s, z * 0.008 * s])], 0.03 * s, () => toDir(F2, [1, 0.6, 0]), codes.bottom, 4, 0.25));
  const knot = toWorld(F2, [0.122 * s, 0.03 * s, 0]);
  const bow = [-1, 1].flatMap((z) => [
    blade(knot, toWorld(F2, [0.118 * s, 0.05 * s, z * 0.055 * s]), 0.012 * s, 0.022 * s, F2.x, 3, codes.trim),
    ribbon([knot, toWorld(F2, [0.13 * s, -0.04 * s, z * 0.022 * s]), madd(toWorld(F2, [0.135 * s, -0.1 * s, z * 0.035 * s]), wind, 0.05)], 0.014 * s, () => F2.x, codes.trim, 3, 0.6),
  ]);
  const bottom = add(add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.02 * s)), mul(wind, o.length * s * o.sway));
  return [
    blouse(sk, codes.top),
    smin(0.006 * s, [panel, ...vee]),
    smin(0.004 * s, [sph(knot, 0.012 * s, codes.trim), ...bow]),
    smin(0.012 * s, [hips(sk, codes.bottom, 0.008 * s), skirt(madd(F1.o, F1.y, -0.035 * s), bottom, 0.104 * s, o.flare * s, F1.z, codes.bottom, { folds: o.folds, depth: 0.011 * s, sharp: 1, power: 0.85, thick: 0.005 * s, ex: 0.8 })]),
  ];
}

function yukata(sk, o, wind, codes) {
  const { s, F1, F2, P0, arms } = sk;
  const S = (l) => l.map((v) => v * s);
  const m = codes.dress;
  const e = 0.012 * s;
  const robe = [
    ell(F2.o, [0.086 * s + e, 0.15 * s, 0.114 * s + e], F2, m),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.056, -0.03, z * 0.05])), [0.046 * s + e, 0.05 * s + e, 0.052 * s + e], F2, m)),
    ell(toWorld(F1, S([0.006, 0, 0])), [0.07 * s + e, 0.11 * s, 0.094 * s + e], F1, m),
    ...[-1, 1].map((z) => ribbon([toWorld(F2, S([-0.03, 0.172, z * 0.06])), toWorld(F2, S([0.07, 0.12, z * 0.055])), toWorld(F2, S([0.112, 0.0, -z * 0.03]))], 0.016 * s, () => toDir(F2, [1, 0.5, 0]), m, 3, 0.9)),
  ];
  const sleeves = [arms.L, arms.R].flatMap((A) => {
    const along = norm(sub(A.wrist, A.elbow));
    const down = norm(sub(madd([0, -1, 0], along, -dot([0, -1, 0], along)), mul(wind, 0.6)));
    const F = frame(madd(lerp(A.elbow, A.wrist, 0.32), down, 0.1 * s), along, mul(down, -1));
    return [
      sph(A.S, 0.05 * s, m),
      rc(A.S, A.elbow, 0.05 * s, 0.05 * s, m),
      rc(A.elbow, lerp(A.elbow, A.wrist, 0.72), 0.05 * s, 0.052 * s, m, undefined, plane(along, lerp(A.elbow, A.wrist, 0.72))),
      box(F.o, [0.12 * s, 0.11 * s, 0.022 * s], 0.019 * s, F, m, along),
    ];
  });
  const obiFrame = { ...F1, o: madd(F1.o, F1.y, -0.01 * s) };
  const obi = ell(obiFrame.o, [0.088 * s, 0.4 * s, 0.112 * s], F1, codes.trim, F1.z, [plane(F1.y, madd(obiFrame.o, F1.y, 0.058 * s)), plane(mul(F1.y, -1), madd(obiFrame.o, F1.y, -0.058 * s))]);
  const knot = toWorld(F1, [-0.1 * s, 0, 0]);
  const bow = [-1, 1].flatMap((z) => [
    blade(knot, add(toWorld(F1, [-0.13 * s, 0.05 * s, z * 0.12 * s]), mul(wind, 0.03)), 0.04 * s, 0.05 * s, F1.x, 4, codes.trim),
    ribbon([knot, toWorld(F1, [-0.12 * s, -0.1 * s, z * 0.03 * s]), madd(toWorld(F1, [-0.13 * s, -0.22 * s, z * 0.05 * s]), wind, 0.08)], 0.03 * s, () => F1.x, codes.trim, 4, 0.8),
  ]);
  const bottom = add(add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.02 * s)), mul(wind, o.length * s * o.sway * 0.5));
  return [
    smin(0.014 * s, [...robe, hips(sk, m, e), skirt(madd(F1.o, F1.y, -0.02 * s), bottom, 0.11 * s, o.flare * s, F1.z, m, { folds: o.folds, depth: 0.012 * s, sharp: 0.8, power: 0.7, thick: 0.005 * s, ex: 0.82 })]),
    smin(0.01 * s, sleeves),
    obi,
    smin(0.006 * s, [sph(knot, 0.03 * s, codes.trim), ...bow]),
  ];
}

export function wear(sk, person, o, rng, wind) {
  const code = (mat) => person * 16 + mat;
  const codes = { top: code(MAT.top), bottom: code(MAT.bottom), dress: code(MAT.dress), coat: code(MAT.coat), trim: code(MAT.trim), shoe: code(MAT.shoe) };
  const f = sk.spec.sex === "f";
  const out = [...shoes(sk, codes.shoe, f)];
  if (f) {
    if (o.kind === "sailor") out.push(...sailor(sk, o, wind, codes));
    else if (o.kind === "yukata") out.push(...yukata(sk, o, wind, codes));
    else out.push(sundress(sk, codes.dress, o, wind));
    return out;
  }
  const s = sk.s;
  out.push(pants(sk, codes.bottom, o));
  const layered = o.kind === "coat" || o.kind === "jacket";
  out.push(smin(0.016 * s, [...shell(sk, 0.013, codes.top, layered ? 1 : o.sleeve), ...(layered ? [] : collar(sk, codes.top, "point"))]));
  if (layered) {
    const heavy = o.kind === "coat";
    out.push(smin(0.012 * s, [...shell(sk, heavy ? 0.02 : 0.017, codes.coat, 1.0), ...lapels(sk, codes.coat, (heavy ? 0.02 : 0.017) * s, o.open), ...collar(sk, codes.coat, o.collar)]));
    out.push(...tails(sk, codes.coat, o, wind));
  }
  if (o.scarf) out.push(scarf(sk, codes.trim, wind, rng));
  return out;
}

export function dress(sex, rng) {
  if (sex === "f") {
    const kind = rng.pick(["sundress", "sundress", "sailor", "yukata"]);
    if (kind === "sailor") return { kind, length: rng.range(0.36, 0.48), flare: rng.range(0.2, 0.27), folds: rng.int(18, 26), sway: rng.range(0.15, 0.35) };
    if (kind === "yukata") return { kind, length: rng.range(0.8, 0.86), flare: rng.range(0.15, 0.19), folds: rng.int(6, 9), sway: rng.range(0.1, 0.25) };
    return { kind, length: rng.range(0.44, 0.62), flare: rng.range(0.22, 0.34), folds: rng.int(8, 14), sharp: rng.range(0.3, 1), power: rng.range(0.75, 1.4), neck: rng.range(0.02, 0.06), sway: rng.range(0.15, 0.4) };
  }
  const kind = rng.pick(["shirt", "coat", "coat", "jacket"]);
  const base = { kind, slim: rng.range(0.9, 1.05), sleeve: rng.chance(0.55) ? rng.range(0.42, 0.6) : 1.02, scarf: rng.chance(kind === "shirt" ? 0.2 : 0.45) };
  if (kind === "coat") return { ...base, length: rng.range(0.5, 0.82), flare: rng.range(0.2, 0.3), folds: rng.int(6, 10), sharp: rng.range(0.6, 1), power: rng.range(0.8, 1.2), sway: rng.range(0.35, 0.8), gap: rng.range(0.2, 0.45), open: rng.range(0.02, 0.05), collar: rng.pick(["stand", "stand", "point"]) };
  if (kind === "jacket") return { ...base, length: rng.range(0.16, 0.24), flare: rng.range(0.15, 0.19), folds: rng.int(4, 7), sharp: 0.8, power: 1, sway: rng.range(0.2, 0.5), gap: rng.range(0.25, 0.5), open: rng.range(0.02, 0.05), collar: "point" };
  return base;
}
