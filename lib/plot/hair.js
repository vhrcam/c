import { ell, rc, smin } from "./figure.js";
import { add, dot, lerp, madd, mul, norm, sub, toDir, toWorld } from "./math.js";

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
    return scalp(e, norm(lerp(d0, d1, t)), m0 + (m1 - m0) * t);
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

function lock(points, r0, m, segs, { tip = 0.0012, bulge = 0.12, power = 0.8 } = {}) {
  const pts = Array.from({ length: segs + 1 }, (_, i) => spline(points, i / segs));
  const r = (t) => tip + (r0 - tip) * (1 - t) ** power * (1 + bulge * Math.sin(Math.PI * t));
  return smin(
    r0 * 0.3,
    pts.slice(0, -1).map((p, i) => rc(p, pts[i + 1], r(i / segs), r((i + 1) / segs), m, [i / segs, (i + 1) / segs])),
  );
}

const jitter = (rng, v, a) => norm(add(v, [rng.range(-a, a), rng.range(-a, a), rng.range(-a, a)]));

function cap(sk, e, grow, m, hairline) {
  const F = sk.head;
  const k = sk.hk;
  const H = (l) => toWorld(F, l.map((v) => v * k));
  const n = norm(toDir(F, [0.78, -0.62, 0]));
  return ell(H([e.c[0] - 0.006, e.c[1] + 0.004, 0]), e.r.map((v) => (v + grow) * k), F, m, F.y, { n, d: dot(n, H(hairline)) });
}

function fibonacci(i, n) {
  const y = 1 - ((i + 0.5) / n) * 1.25;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = i * 2.39996;
  return [Math.cos(phi) * ring, y, Math.sin(phi) * ring];
}

export function messyHair(sk, rng, wind, m) {
  const e = SKULL.m;
  const F = sk.head;
  const k = sk.hk;
  const H = (l) => toWorld(F, l.map((v) => v * k));
  const items = [cap(sk, e, 0.011, m, [0.07, 0.055, 0])];
  let count = 0;
  for (let i = 0; i < 160 && count < 46; i++) {
    const d0 = norm(add(fibonacci(i, 96), [rng.range(-0.05, 0.05), 0, rng.range(-0.05, 0.05)]));
    if (d0[1] < -0.05 || (d0[0] > 0.5 && d0[1] < 0.5)) continue;
    count++;
    const side = Math.sign(d0[2]) || 1;
    let dT;
    let L;
    if (d0[0] > 0.25 && d0[1] > 0.45) {
      dT = [0.94, 0.08 + rng.range(-0.06, 0.08), d0[2] * 1.5 + rng.range(-0.2, 0.2)];
      L = rng.range(0.03, 0.05);
    } else if (Math.abs(d0[2]) > 0.5 && d0[0] > -0.4) {
      dT = [d0[0] * 0.4, -0.5, side * 0.85];
      L = rng.range(0.035, 0.06);
    } else if (d0[1] > 0.75) {
      dT = add(d0, [-0.55, -0.25, d0[2] * 0.9]);
      L = rng.range(0.025, 0.05);
    } else {
      dT = [-0.72, -0.6, d0[2] * 0.9];
      L = rng.range(0.04, 0.065);
    }
    dT = jitter(rng, norm(dT), 0.22);
    const path = glide(e, d0, dT, 4, -0.004, rng.range(0.012, 0.02));
    const last = path[3];
    const tangent = norm(sub(last, path[2]));
    const flick = jitter(rng, add(tangent, mul(norm(sub(last, e.c)), rng.range(0.15, 0.7))), 0.3);
    const tip = madd(last, flick, L);
    const pts = [...path, tip].map(H);
    pts[4] = madd(pts[4], wind, L * 0.6);
    items.push(lock(pts, rng.range(0.016, 0.023) * k, m, 4, { power: 0.7 }));
  }
  return smin(0.006 * k, items);
}

export function longHair(sk, rng, wind, m, { tuck = 0 } = {}) {
  const e = SKULL.f;
  const F = sk.head;
  const k = sk.hk;
  const H = (l) => toWorld(F, l.map((v) => v * k));
  const { F1, F2, P1, P2, P3, s } = sk;
  const B = (Fr, o, l) => toWorld({ ...Fr, o }, l.map((v) => v * s));
  const items = [cap(sk, e, 0.009, m, [0.066, 0.058, 0])];
  const part = rng.range(-0.25, 0.25);

  for (let i = 0; i < 11; i++) {
    const z = (i / 10 - 0.5) * 1.5;
    const away = z - part;
    const d0 = norm([0.42, 0.9, z * 0.32]);
    const d1 = norm([0.97, 0.1 - Math.abs(z) * 0.18 + rng.range(-0.03, 0.04), z * 0.62 + Math.sign(away) * Math.min(0.2, Math.abs(away) * 0.3)]);
    const path = glide(e, d0, d1, 4, -0.004, 0.009);
    const tip = add(path[3], [0.004, -rng.range(0.012, 0.026), Math.sign(away) * 0.004]);
    items.push(lock([...path, tip].map(H), rng.range(0.011, 0.015) * k, m, 4, { power: 0.7 }));
  }

  for (const side of [-1, 1]) {
    const tucked = tuck === side;
    const shoulder = (side < 0 ? sk.arms.L : sk.arms.R).S;
    for (let j = 0; j < 2; j++) {
      const d0 = norm([0.42 - j * 0.3, 0.62, side * 0.68]);
      const d1 = tucked ? norm([-0.35, -0.2, side * 0.92]) : norm([0.42 - j * 0.25, -0.35, side * 0.86]);
      const path = glide(e, d0, d1, 3, -0.004, 0.012);
      const S1 = B(F2, shoulder, [tucked ? -0.09 : 0.06 - j * 0.03, 0.06, -side * 0.025]);
      const S2 = B(F2, P2, [tucked ? -0.12 : 0.105 - j * 0.02, -0.03 - j * 0.03, side * 0.08]);
      const pts = [...path.map(H), S1, madd(S2, wind, 0.12)];
      items.push(lock(pts, rng.range(0.015, 0.018) * k, m, 7, { power: 0.55 }));
    }
  }

  const N = 24;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const az = Math.PI * (0.55 + t * 0.9) + rng.range(-0.04, 0.04);
    const el = rng.range(-0.2, 0.8);
    const d0 = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const z = d0[2];
    const path = glide(e, d0, norm([-0.7, -0.66, z * 0.75]), 3, -0.004, 0.014);
    const spread = z * 0.095 + rng.range(-0.01, 0.01);
    const fall = rng.range(-0.08, 0.04);
    const pts = [
      ...path.map(H),
      B(F2, P3, [-0.1, -0.03, spread * 0.95]),
      B(F2, P2, [-0.125, -0.05, spread * 1.08]),
      madd(B(F1, P1, [-0.118, -0.07 + fall, spread * 1.2]), wind, 0.22),
    ];
    items.push(lock(pts, rng.range(0.019, 0.025) * k, m, 8, { power: 0.5, bulge: 0.18 }));
  }
  return smin(0.008 * k, items);
}
