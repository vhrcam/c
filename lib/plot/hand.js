import { ell, hmin, rc, smin } from "./figure.js";
import { add, cross, madd, mul, norm, rotate, toWorld } from "./math.js";

export function handGenome(sex, rng) {
  return { sex, seed: Math.floor(rng() * 1e9) };
}

export function hand(arm, s, m, g = {}) {
  const H = arm.hand;
  const ts = arm.side;
  const k = s;
  const W = (l) => toWorld(H, l.map((v) => v * k));
  const parts = [
    ell(W([0.05, 0, 0]), [0.05 * k, 0.015 * k, 0.039 * k], H, m, H.x),
    ell(W([0.028, 0.006, 0.022 * ts]), [0.03 * k, 0.015 * k, 0.018 * k], H, m, H.x),
    ell(W([0.045, 0.002, -0.026 * ts]), [0.04 * k, 0.014 * k, 0.016 * k], H, m, H.x),
  ];
  const fingers = [
    { z: 0.026, x: 0.095, l: [0.043, 0.027, 0.022], r: 0.0088, spread: 1.1 },
    { z: 0.0085, x: 0.099, l: [0.047, 0.03, 0.023], r: 0.009, spread: 0.35 },
    { z: -0.0085, x: 0.096, l: [0.044, 0.029, 0.022], r: 0.0086, spread: -0.35 },
    { z: -0.025, x: 0.088, l: [0.035, 0.022, 0.019], r: 0.0076, spread: -1.1 },
  ];
  const chains = fingers.map((f, i) => {
    let p = W([f.x - 0.012, 0, f.z * ts]);
    let d = rotate(H.x, H.y, -f.spread * arm.spread * ts);
    const axis = norm(cross(H.y, d));
    const segs = [];
    const curl = arm.curl.map((c, j) => c * (1 + (i - 1.5) * 0.06 * (j === 0 ? 1 : 0.5)));
    let r = f.r * k;
    for (let j = 0; j < 3; j++) {
      d = rotate(d, axis, -curl[j]);
      const q = madd(p, d, f.l[j] * k + (j === 0 ? 0.012 * k : 0));
      const r2 = r * (j === 2 ? 0.62 : 0.9);
      segs.push(rc(p, q, r, r2, m));
      p = q;
      r = r2;
    }
    return smin(0.0015 * k, segs);
  });
  let p = W([0.024, 0.006, 0.02 * ts]);
  let d = norm(add(add(mul(H.x, 0.62), mul(H.z, ts * 0.62)), mul(H.y, 0.38 + arm.thumb * 0.25)));
  const thumb = [];
  const tl = [0.042, 0.033, 0.028];
  const tr = [0.013, 0.0098, 0.0088];
  for (let j = 0; j < 3; j++) {
    const q = madd(p, d, tl[j] * k);
    thumb.push(rc(p, q, tr[j] * k, (j === 2 ? 0.0055 : tr[j + 1]) * k, m));
    p = q;
    d = norm(add(d, add(mul(H.y, 0.18 * (0.5 + arm.thumb)), mul(H.z, -ts * 0.16 * arm.thumb))));
  }
  return smin(0.006 * k, [smin(0.008 * k, parts), hmin(chains), smin(0.003 * k, thumb)]);
}
