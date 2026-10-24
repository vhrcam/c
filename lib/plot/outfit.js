import { MAT, blade, box, ell, hmin, plane, rc, smin, sph } from "./figure.js";
import { add, cross, dot, frame, len as len3, lerp, madd, mul, norm, rotate, sub, toDir, toWorld } from "./math.js";

export function skirt(top, bottom, r1, r2, side, m, { folds = 11, depth = 0.016, sharp = 0, power = 1, thick = 0, ex = 1, bend, cut } = {}) {
  const axis = norm(sub(bottom, top));
  const u = norm(cross(axis, side));
  const v = cross(axis, u);
  const b = bend && madd(bend, axis, -dot(bend, axis));
  return { kind: "skirt", a: top, b: bottom, r1, r2, u, v, folds, depth, sharp, power, thick, ex, bend: b, m, axis, cut };
}

const gust = (wind, reach, cap) => {
  const raw = mul(wind, reach);
  return mul(raw, Math.min(1, cap / (len3(raw) || 1)));
};

function hips(sk, m, e) {
  const { s, F0 } = sk;
  return ell(toWorld(F0, [-0.012 * s, -0.025 * s, 0]), [0.1 * s * sk.D.hd + e, 0.13 * s, 0.152 * s * sk.D.hw + e], F0, m);
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

function shell(sk, e, m, sleeve, hem = true) {
  const { s, F0, F1, F2, arms, D } = sk;
  const S = (l) => l.map((v) => v * s);
  const E = e * s;
  const shoulders = [arms.L, arms.R].flatMap((A) => {
    const N = toWorld(F2, S([-0.018, 0.17, A.side * 0.04]));
    const T = madd(A.S, F2.y, 0.018 * s);
    const z = norm(sub(T, N));
    const y = norm(madd(F2.y, z, -dot(F2.y, z)));
    const Fr = { o: lerp(N, T, 0.5), x: cross(y, z), y, z };
    const half = [0.046 * s + E, 0.022 * s + E * 0.7, (len3(sub(T, N)) / 2) + 0.008 * s];
    return [box(Fr.o, half, 0.016 * s + E * 0.5, Fr, m, z), sph(A.S, 0.038 * s * D.arm + E * 0.7, m)];
  });
  const sleeves = [arms.L, arms.R].flatMap((A) => {
    const end = lerp(A.elbow, A.wrist, sleeve);
    const cuff = lerp(A.elbow, A.wrist, Math.max(0.05, sleeve - 0.07));
    const a = s * D.arm;
    const ease = E * 0.6;
    const side = Math.abs(norm(sub(end, cuff))[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return [rc(A.S, A.elbow, 0.04 * a + ease, 0.031 * a + ease, m), rc(A.elbow, cuff, 0.031 * a + ease, 0.026 * a + ease, m), skirt(cuff, end, 0.027 * a + ease * 1.3, 0.029 * a + ease * 1.4, side, m, { depth: 0, thick: 0.004 * s })];
  });
  return [
    ell(toWorld(F1, S([0.008, 0.01, 0])), [0.084 * s * D.wd + E, 0.12 * s * D.T, 0.12 * s * D.ww + E], F1, m),
    ell(F2.o, [0.1 * s * D.cd + E, 0.158 * s * D.T, 0.144 * s * D.cw + E], F2, m),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.048 * D.cd, 0.035, z * 0.062 * D.cw])), [0.045 * s + E, 0.068 * s, 0.07 * s * D.cw + E], F2, m)),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([-0.03 * D.cd, 0.02, z * 0.08 * D.cw])), [0.058 * s * D.cd + E, 0.12 * s * D.T, 0.068 * s + E], F2, m)),
    ...shoulders,
    ...sleeves,
    hem && ell(toWorld(F0, S([0, 0.05, 0])), [0.102 * s * D.hd + E, 0.07 * s, 0.158 * s * D.hw + E], F0, m),
  ];
}

function pants(sk, m, o) {
  const { s, F0, legs, D } = sk;
  const S = (l) => l.map((v) => v * s);
  const w = (o.slim ?? 1) * D.leg;
  return smin(0.02 * s, [
    ell(toWorld(F0, S([-0.004, 0.005, 0])), S([0.104 * D.hd, 0.106, 0.16 * D.hw]), F0, m),
    ...[-1, 1].map((z) => ell(toWorld(F0, S([-0.045 * D.hd, -0.055, z * 0.068 * D.hw])), S([0.074 * D.hd, 0.09, 0.076 * D.hw]), F0, m)),
    ...[legs.L, legs.R].flatMap((L) => {
      const hem = madd(L.ankle, [0, 1, 0], 0.035 * s);
      return [rc(L.H, L.knee, 0.094 * s * D.leg, 0.062 * s * w, m), rc(L.knee, madd(hem, [0, 1, 0], -0.02 * s), 0.061 * s * w, 0.056 * s * w, m, undefined, plane([0, -1, 0], hem))];
    }),
  ]);
}

function chestSurface(sk, E) {
  const { s, F1, F2, D } = sk;
  const shapes = [
    { F: F2, c: [0, 0, 0], r: [0.1 * s * D.cd + E, 0.158 * s * D.T, 0.144 * s * D.cw + E] },
    { F: F1, c: [0.008 * s, 0.01 * s, 0], r: [0.084 * s * D.wd + E, 0.12 * s * D.T, 0.12 * s * D.ww + E] },
    ...[-1, 1].map((z) => ({ F: F2, c: [0.048 * s * D.cd, 0.035 * s, z * 0.062 * s * D.cw], r: [0.045 * s + E, 0.068 * s, 0.07 * s * D.cw + E] })),
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
  const { s, F2, P3, neckTop } = sk;
  if (kind === "crew" || kind === "turtle") {
    const n = norm(sub(neckTop, P3));
    const a = norm(madd(F2.x, n, -dot(F2.x, n)));
    const b = cross(n, a);
    const r = (0.05 * sk.D.neck + 0.012) * s;
    if (kind === "crew") return loop(madd(P3, n, -0.006 * s), a, b, r, r, 14, 0.011 * s, m);
    const top = lerp(P3, neckTop, 0.72);
    return [rc(madd(P3, n, -0.03 * s), top, r, r - 0.003 * s, m, undefined, plane(n, top)), ...loop(top, a, b, r, r, 14, 0.01 * s, m)];
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
  const len = rng.range(0.12, 0.24);
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
    return ribbon(pts, 0.048 * s, (t, a, b) => rotate(norm(cross(sub(b, a), F2.z)), sub(b, a), t * twist + j), m, 1.8, 0.85);
  });
  return smin(0.01 * s, [...ring, ...tails]);
}

function tails(sk, m, o) {
  const { s, F1, P0 } = sk;
  const top = madd(F1.o, F1.y, -0.02 * s);
  const end = add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.01 * s));
  return [-1, 1].map((z) => {
    const n = norm(add(mul(F1.x, Math.sin(o.gap)), mul(F1.z, -z * Math.cos(o.gap))));
    return skirt(top, end, 0.15 * s, 0.2 * s, F1.z, m, { folds: o.folds, depth: 0, power: 0.8, thick: 0.006 * s, ex: 0.7, cut: { n, d: dot(n, top) } });
  });
}

function shoes(sk, m, f, strap) {
  const { s, legs } = sk;
  return [legs.L, legs.R].map((L) => {
    const F = L.foot;
    const W = (l) => toWorld(F, l.map((v) => v * s * sk.D.foot));
    if (f) {
      const sole = plane(mul(F.y, -1), W([0, -0.068, 0]));
      return smin(0.008 * s, [
        rc(W([-0.02, -0.048, 0]), W([0.15, -0.055, 0]), 0.034 * s, 0.01 * s, m, undefined, sole),
        rc(W([-0.025, -0.05, 0]), W([-0.025, -0.075, 0]), 0.012 * s, 0.009 * s, m),
        ...(strap ? loop(W([0.035, -0.05, 0]), F.z, F.y, 0.036 * s, 0.024 * s, 12, 0.003 * s, m) : []),
      ]);
    }
    const toe = plane(add(mul(F.x, 0.55), F.y), W([0.15, -0.045, 0]));
    return hmin([
      smin(0.006 * s, [
        box(W([0.065, -0.052, 0]), [0.118 * s, 0.026 * s, 0.043 * s], 0.018 * s, F, m, F.x, [plane(mul(F.y, -1), W([0, -0.077, 0])), toe]),
        rc(W([-0.012, -0.022, 0]), W([-0.012, -0.05, 0]), 0.033 * s, 0.036 * s, m, undefined, plane(mul(F.y, -1), W([0, -0.077, 0]))),
      ]),
      box(W([0.07, -0.081, 0]), [0.126 * s, 0.0045 * s, 0.046 * s], 0.003 * s, F, m, F.x),
      box(W([-0.03, -0.08, 0]), [0.033 * s, 0.0075 * s, 0.041 * s], 0.003 * s, F, m, F.x),
    ]);
  });
}

function sundress(sk, m, o, wind) {
  const { s, F1, F2, P0, D } = sk;
  const bust = D.bust ** 0.8;
  const S = (l) => l.map((v) => v * s);
  const e = 0.007 * s;
  const cut = { n: F2.y, d: dot(F2.y, toWorld(F2, S([0, o.neck, 0]))) };
  const bottom = add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.03 * s));
  const bend = gust(wind, o.length * s * o.sway * 1.6, 0.26 * s);
  return smin(0.016 * s, [
    ell(F2.o, [0.084 * s * D.cd + e, 0.134 * s * D.T, 0.112 * s * D.cw + e], F2, m, F2.y, cut),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.058 * D.cd + 0.006 * (bust - 1), -0.03, z * 0.05 * D.cw])), [0.046 * s * bust + e, 0.05 * s * bust + e, 0.052 * s * bust + e], F2, m, F2.y, cut)),
    ell(toWorld(F1, S([0.006, 0, 0])), [0.066 * s * D.wd + e, 0.1 * s * D.T, 0.09 * s * D.ww + e], F1, m),
    hips(sk, m, e),
    skirt(madd(F1.o, F1.y, -0.03 * s), bottom, 0.1 * s, o.flare * s, F1.z, m, { folds: o.folds, depth: 0.017 * s, sharp: o.sharp, power: o.power, thick: 0.005 * s, ex: 0.78, bend }),
    ...[-1, 1].flatMap((z) => [rc(toWorld(F2, S([0.064, 0.04, z * 0.07])), toWorld(F2, S([-0.02, 0.172, z * 0.1])), 0.0065 * s, 0.0065 * s, m), rc(toWorld(F2, S([-0.02, 0.172, z * 0.1])), toWorld(F2, S([-0.085, 0.06, z * 0.07])), 0.0065 * s, 0.0065 * s, m)]),
  ]);
}

function blouse(sk, m) {
  const { s, F1, F2, arms, D } = sk;
  const bust = D.bust ** 0.8;
  const S = (l) => l.map((v) => v * s);
  const e = 0.01 * s;
  return smin(0.018 * s, [
    ell(F2.o, [0.084 * s * D.cd + e, 0.15 * s * D.T, 0.112 * s * D.cw + e], F2, m),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.058 * D.cd + 0.006 * (bust - 1), -0.03, z * 0.05 * D.cw])), [0.046 * s * bust + e, 0.05 * s * bust + e, 0.052 * s * bust + e], F2, m)),
    ell(toWorld(F1, S([0.006, 0.01, 0])), [0.066 * s * D.wd + e, 0.11 * s * D.T, 0.09 * s * D.ww + e], F1, m),
    ...[arms.L, arms.R].flatMap((A) => {
      const end = lerp(A.S, A.elbow, 0.55);
      const mid = lerp(A.S, end, 0.6);
      const side = Math.abs(norm(sub(end, A.S))[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      return [sph(A.S, 0.046 * s * D.arm, m), rc(A.S, mid, 0.046 * s * D.arm, 0.044 * s * D.arm, m), skirt(mid, end, 0.044 * s * D.arm, 0.045 * s * D.arm, side, m, { depth: 0, thick: 0.004 * s })];
    }),
  ]);
}

function sailor(sk, o, wind, codes) {
  const { s, F1, F2, P0 } = sk;
  const cut = [plane(F2.x, toWorld(F2, [-0.03 * s, 0, 0])), plane(mul(F2.y, -1), toWorld(F2, [0, 0.03 * s, 0]))];
  const panel = ell(F2.o, [0.102 * s * sk.D.cd, 0.158 * s * sk.D.T, 0.13 * s * sk.D.cw], F2, codes.bottom, F2.y, cut);
  const vee = [-1, 1].map((z) => ribbon([toWorld(F2, [-0.02 * s, 0.165 * s, z * 0.1 * s]), toWorld(F2, [0.07 * s, 0.11 * s, z * 0.07 * s]), toWorld(F2, [0.115 * s, 0.02 * s, z * 0.008 * s])], 0.03 * s, () => toDir(F2, [1, 0.6, 0]), codes.bottom, 4, 0.25));
  const knot = toWorld(F2, [0.122 * s, 0.03 * s, 0]);
  const bow = [-1, 1].flatMap((z) => [
    blade(knot, toWorld(F2, [0.118 * s, 0.05 * s, z * 0.055 * s]), 0.012 * s, 0.022 * s, F2.x, 3, codes.trim),
    ribbon([knot, toWorld(F2, [0.13 * s, -0.04 * s, z * 0.022 * s]), madd(toWorld(F2, [0.135 * s, -0.1 * s, z * 0.035 * s]), wind, 0.05)], 0.014 * s, () => F2.x, codes.trim, 3, 0.6),
  ]);
  const bottom = add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.02 * s));
  const bend = gust(wind, o.length * s * o.sway * 1.6, 0.2 * s);
  return [
    blouse(sk, codes.top),
    smin(0.006 * s, [panel, ...vee]),
    smin(0.004 * s, [sph(knot, 0.012 * s, codes.trim), ...bow]),
    smin(0.012 * s, [hips(sk, codes.bottom, 0.008 * s), skirt(madd(F1.o, F1.y, -0.035 * s), bottom, 0.104 * s, o.flare * s, F1.z, codes.bottom, { folds: o.folds, depth: 0.011 * s, sharp: 1, power: 0.85, thick: 0.005 * s, ex: 0.8, bend })]),
  ];
}

function yukata(sk, o, wind, codes) {
  const { s, F1, F2, P0, arms, D } = sk;
  const bust = D.bust ** 0.8;
  const S = (l) => l.map((v) => v * s);
  const m = codes.dress;
  const e = 0.012 * s;
  const robe = [
    ell(F2.o, [0.086 * s * D.cd + e, 0.15 * s * D.T, 0.114 * s * D.cw + e], F2, m),
    ...[-1, 1].map((z) => ell(toWorld(F2, S([0.056 * D.cd + 0.006 * (bust - 1), -0.03, z * 0.05 * D.cw])), [0.046 * s * bust + e, 0.05 * s * bust + e, 0.052 * s * bust + e], F2, m)),
    ell(toWorld(F1, S([0.006, 0, 0])), [0.07 * s * D.wd + e, 0.11 * s * D.T, 0.094 * s * D.ww + e], F1, m),
    ...[-1, 1].map((z) => ribbon([toWorld(F2, S([-0.03, 0.172, z * 0.06])), toWorld(F2, S([0.07, 0.12, z * 0.055])), toWorld(F2, S([0.112, 0.0, -z * 0.03]))], 0.016 * s, () => toDir(F2, [1, 0.5, 0]), m, 3, 0.9)),
  ];
  const sleeves = [arms.L, arms.R].flatMap((A) => {
    const along = norm(sub(A.wrist, A.elbow));
    const end = lerp(A.elbow, A.wrist, 0.82);
    const sag = add(mul(madd([0, -1, 0], along, -dot([0, -1, 0], along)), 0.1 * s), mul(wind, 0.05 * s));
    return [
      sph(A.S, 0.05 * s * D.arm, m),
      rc(A.S, A.elbow, 0.05 * s * D.arm, 0.05 * s * D.arm, m),
      skirt(A.elbow, end, 0.05 * s, 0.1 * s, Math.abs(along[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], m, { folds: 5, depth: 0.008 * s, sharp: 0.5, power: 0.8, thick: 0.005 * s, bend: sag }),
    ];
  });
  const obiFrame = { ...F1, o: madd(F1.o, F1.y, -0.01 * s) };
  const obi = ell(obiFrame.o, [0.088 * s * D.wd, 0.4 * s, 0.112 * s * D.ww], F1, codes.trim, F1.z, [plane(F1.y, madd(obiFrame.o, F1.y, 0.058 * s)), plane(mul(F1.y, -1), madd(obiFrame.o, F1.y, -0.058 * s))]);
  const knot = toWorld(F1, [-0.1 * s, 0, 0]);
  const bow = [-1, 1].flatMap((z) => [
    blade(knot, add(toWorld(F1, [-0.13 * s, 0.05 * s, z * 0.12 * s]), mul(wind, 0.03)), 0.04 * s, 0.05 * s, F1.x, 4, codes.trim),
    ribbon([knot, toWorld(F1, [-0.12 * s, -0.1 * s, z * 0.03 * s]), madd(toWorld(F1, [-0.13 * s, -0.22 * s, z * 0.05 * s]), wind, 0.08)], 0.03 * s, () => F1.x, codes.trim, 4, 0.8),
  ]);
  const bottom = add(madd(P0, [0, 1, 0], -o.length * s), mul(F1.x, 0.02 * s));
  const bend = gust(wind, o.length * s * o.sway, 0.16 * s);
  return [
    smin(0.014 * s, [...robe, hips(sk, m, e), skirt(madd(F1.o, F1.y, -0.02 * s), bottom, 0.11 * s, o.flare * s, F1.z, m, { folds: o.folds, depth: 0.012 * s, sharp: 0.8, power: 0.7, thick: 0.005 * s, ex: 0.82, bend })]),
    smin(0.01 * s, sleeves),
    obi,
    smin(0.006 * s, [sph(knot, 0.03 * s, codes.trim), ...bow]),
  ];
}

function loop(c, a, b, rx, ry, n, r, m) {
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return add(c, add(mul(a, Math.cos(t) * rx), mul(b, Math.sin(t) * ry)));
  });
  return pts.map((p, i) => rc(p, pts[(i + 1) % n], r, r, m));
}

function trinkets(sk, x, codes) {
  const { s, hk: k, head: F, arms, P3, neckTop, F2 } = sk;
  const W = (l) => toWorld(F, l.map((v) => v * k));
  const out = [];
  if (x.glasses) {
    const items = [];
    for (const z of [-1, 1]) {
      const a = norm(add(mul(F.z, Math.cos(0.45)), mul(F.x, -z * Math.sin(0.45))));
      items.push(...loop(W([0.092, -0.027, z * 0.033]), a, F.y, 0.022 * k, x.glasses * k, 12, 0.0016 * k, codes.shoe));
      items.push(rc(W([0.083, -0.024, z * 0.052]), W([-0.006, -0.022, z * 0.077]), 0.0016 * k, 0.0016 * k, codes.shoe));
    }
    items.push(rc(W([0.1, -0.021, -0.012]), W([0.1, -0.021, 0.012]), 0.0018 * k, 0.0018 * k, codes.shoe));
    out.push(hmin(items));
  }
  if (x.choker) {
    const n = norm(sub(neckTop, P3));
    const a = norm(madd(F2.x, n, -dot(F2.x, n)));
    const r = (0.0355 * sk.D.neck + 0.004) * s;
    out.push(hmin(loop(lerp(P3, neckTop, 0.4), a, cross(n, a), r, r, 16, 0.0045 * s, x.choker === "dark" ? codes.shoe : codes.trim)));
  }
  if (x.earrings) {
    for (const z of [-1, 1]) out.push(smin(0.002 * k, [sph(W([-0.012, -0.056, z * 0.074]), 0.004 * k, codes.trim), rc(W([-0.012, -0.056, z * 0.074]), W([-0.012, -0.074, z * 0.074]), 0.0022 * k, 0.005 * k, codes.trim)]));
  }
  if (x.bracelet) {
    const A = arms[x.bracelet];
    const n = norm(sub(A.wrist, A.elbow));
    const a = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const r = (sk.spec.sex === "f" ? 0.021 : 0.027) * s * sk.D.arm;
    out.push(hmin(loop(lerp(A.elbow, A.wrist, 0.94), a, cross(n, a), r, r, 12, 0.003 * s, codes.trim)));
  }
  return out;
}

export function wear(sk, person, o, rng, wind) {
  const code = (mat) => person * 16 + mat;
  const codes = { top: code(MAT.top), bottom: code(MAT.bottom), dress: code(MAT.dress), coat: code(MAT.coat), trim: code(MAT.trim), shoe: code(MAT.shoe) };
  const f = sk.spec.sex === "f";
  const out = [...shoes(sk, codes.shoe, f, o.extras?.strap), ...trinkets(sk, o.extras || {}, codes)];
  if (f) {
    if (o.kind === "sailor") out.push(...sailor(sk, o, wind, codes));
    else if (o.kind === "yukata") out.push(...yukata(sk, o, wind, codes));
    else out.push(sundress(sk, codes.dress, o, wind));
    return out;
  }
  const s = sk.s;
  out.push(pants(sk, codes.bottom, o));
  const layered = o.kind === "jacket";
  const knit = o.kind === "sweater";
  out.push(smin(0.016 * s, [...shell(sk, knit ? 0.017 : 0.013, codes.top, layered ? 0.92 : o.sleeve, !layered), ...(layered ? [] : collar(sk, codes.top, knit ? o.neck : "point"))]));
  if (layered) {
    out.push(smin(0.012 * s, [...shell(sk, 0.017, codes.coat, 0.93, false), ...lapels(sk, codes.coat, 0.017 * s, o.open), ...collar(sk, codes.coat, "point")]));
    out.push(...tails(sk, codes.coat, o));
  }
  if (o.scarf) out.push(scarf(sk, codes.trim, wind, rng));
  return out;
}

function extras(sex, rng) {
  const side = () => rng.pick(["L", "R"]);
  if (sex === "f") return { choker: rng.chance(0.35) && rng.pick(["dark", "accent"]), earrings: rng.chance(0.4), bracelet: rng.chance(0.3) && side(), strap: rng.chance(0.5) };
  return { glasses: rng.chance(0.25) && rng.range(0.012, 0.017), bracelet: rng.chance(0.2) && side() };
}

function patterns(sex, kind, rng) {
  const pick = (list) => rng.pick(list);
  if (sex === "f") return { [MAT.dress]: pick(["plain", "plain", "stripes", "plaid", "pinstripe"]), [MAT.bottom]: kind === "sailor" ? pick(["plain", "plaid", "plaid"]) : "plain" };
  const top = kind === "sweater" ? pick(["rib", "rib", "stripes", "plain"]) : pick(["plain", "plain", "stripes", "pinstripe", "plaid"]);
  return { [MAT.top]: top, [MAT.bottom]: pick(["plain", "plain", "plaid", "pinstripe"]), [MAT.coat]: pick(["plain", "plain", "plaid"]) };
}

export function dress(sex, rng) {
  const o = outfit(sex, rng);
  return { ...o, extras: extras(sex, rng), pattern: patterns(sex, o.kind, rng) };
}

function outfit(sex, rng) {
  if (sex === "f") {
    const kind = rng.pick(["sundress", "sundress", "sailor", "yukata"]);
    if (kind === "sailor") return { kind, length: rng.range(0.36, 0.48), flare: rng.range(0.2, 0.27), folds: rng.int(18, 26), sway: rng.range(0.15, 0.35) };
    if (kind === "yukata") return { kind, length: rng.range(0.8, 0.86), flare: rng.range(0.15, 0.19), folds: rng.int(6, 9), sway: rng.range(0.1, 0.25) };
    return { kind, length: rng.range(0.44, 0.62), flare: rng.range(0.22, 0.34), folds: rng.int(8, 14), sharp: rng.range(0.3, 1), power: rng.range(0.75, 1.4), neck: rng.range(0.02, 0.06), sway: rng.range(0.15, 0.4) };
  }
  const kind = rng.pick(["shirt", "shirt", "sweater", "sweater", "jacket"]);
  const base = { kind, slim: rng.range(0.9, 1.05), sleeve: rng.chance(0.55) ? rng.range(0.42, 0.6) : 1.02, scarf: rng.chance(kind === "shirt" ? 0.2 : 0.4) };
  if (kind === "sweater") {
    const neck = rng.pick(["crew", "crew", "turtle"]);
    return { ...base, sleeve: rng.chance(0.35) ? rng.range(0.6, 0.78) : 0.97, neck, scarf: base.scarf && neck === "crew" };
  }
  if (kind === "jacket") return { ...base, length: rng.range(0.08, 0.14), folds: 4, power: 1, sway: 0, gap: rng.range(0.35, 0.55), open: rng.range(0.02, 0.05), collar: "point" };
  return base;
}
