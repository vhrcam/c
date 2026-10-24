import { add, clamp, cross, dot, frame, len, lerp, madd, mul, norm, rotate, sub, toWorld, turn } from "./math.js";
import { wear } from "./outfit.js";

export const MAT = { skin: 1, hairA: 2, hairB: 3, top: 4, bottom: 5, dress: 6, shoe: 7, ground: 8, coat: 9, trim: 10 };

const BODY = {
  m: { height: 1.8, head: 1, ankle: 0.085, pelvis: 0.99, abdomen: 1.15, chest: 1.33, neck: 1.505, neckLen: 0.07, cranium: [0.014, 0.1, 0], shoulder: [-0.014, 0.122, 0.188], hipW: 0.088, upper: 0.3, fore: 0.262, hand: 1, thigh: 0.43, shin: 0.425 },
  f: { height: 1.64, head: 0.96, ankle: 0.075, pelvis: 0.905, abdomen: 1.05, chest: 1.205, neck: 1.37, neckLen: 0.08, cranium: [0.012, 0.094, 0], shoulder: [-0.012, 0.108, 0.155], hipW: 0.082, upper: 0.268, fore: 0.232, hand: 0.87, thigh: 0.4, shin: 0.39 },
};

export const sph = (c, r, m, axis = [0, 1, 0]) => ({ kind: "sph", c, r, m, axis });
export const ell = (c, r, F, m, axis = F.y, cut) => ({ kind: "ell", c, r, axes: [F.x, F.y, F.z], m, axis, cut });
export const rc = (a, b, r1, r2, m, aux, cut) => ({ kind: "rc", a, b, r1, r2, m, axis: norm(sub(b, a)), aux, cut });
export const blade = (a, b, r1, r2, n, f, m, aux) => ({ kind: "blade", a, b, r1, r2, n: norm(n), f, m, axis: norm(sub(b, a)), aux });
export const box = (c, half, round, F, m, axis = F.x, cut) => ({ kind: "box", c, half, round, axes: [F.x, F.y, F.z], m, axis, cut });
export const plane = (n, p) => ({ n: norm(n), d: dot(norm(n), p) });
export const smin = (k, items) => ({ op: "smin", k, items: items.filter(Boolean) });
export const hmin = (items) => ({ op: "min", items: items.filter(Boolean) });

export function ik(a, target, l1, l2, pole) {
  const d = sub(target, a);
  const D = clamp(len(d), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 2e-3);
  const n = norm(d);
  const cosA = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = norm(sub(pole, mul(n, dot(pole, n))));
  return { mid: add(a, add(mul(n, l1 * cosA), mul(p, l1 * sinA))), end: add(a, mul(n, D)) };
}

const limb = (a, b, hint) => frame(a, sub(b, a), hint);

export function proportions(spec) {
  const B0 = BODY[spec.sex];
  const b = { shoulder: 1, hip: 1, arm: 1, leg: 1, head: 1, neck: 1, ...spec.build };
  const grow = (B0.thigh + B0.shin) * (b.leg - 1);
  return {
    ...B0,
    height: B0.height + grow,
    pelvis: B0.pelvis + grow,
    abdomen: B0.abdomen + grow,
    chest: B0.chest + grow,
    neck: B0.neck + grow,
    thigh: B0.thigh * b.leg,
    shin: B0.shin * b.leg,
    upper: B0.upper * b.arm,
    fore: B0.fore * b.arm,
    shoulder: [B0.shoulder[0], B0.shoulder[1], B0.shoulder[2] * b.shoulder],
    hipW: B0.hipW * b.hip,
    neckLen: B0.neckLen * b.neck,
    head: B0.head * b.head,
  };
}

export function skeleton(spec, pose) {
  const B = proportions(spec);
  const s = spec.height / B.height;
  const root = frame(pose.base, pose.facing, [0, 1, 0]);
  const lift = pose.tiptoe || 0;
  const lean = pose.lean || 0;
  const twist = pose.twist || 0;

  const P0 = toWorld(root, [pose.hipShift || 0, B.pelvis * s + lift, 0]);
  let F0 = turn(root, root.z, -lean * 0.18, P0);
  F0 = turn(F0, F0.y, twist * 0.3);
  const P1 = madd(P0, F0.y, (B.abdomen - B.pelvis) * s);
  let F1 = turn(F0, F0.z, -lean * 0.34, P1);
  F1 = turn(F1, F1.y, twist * 0.35);
  const P2 = madd(P1, F1.y, (B.chest - B.abdomen) * s);
  let F2 = turn(F1, F1.z, -lean * 0.48, P2);
  F2 = turn(F2, F2.y, twist * 0.35);
  F2 = turn(F2, F2.x, pose.side || 0);
  const P3 = madd(P2, F2.y, (B.neck - B.chest) * s);

  let Fh = turn(F2, F2.y, pose.yaw || 0);
  Fh = turn(Fh, Fh.z, pose.pitch || 0);
  Fh = turn(Fh, Fh.x, pose.roll || 0);
  const neckDir = norm(add(F2.y, Fh.y));
  const neckTop = madd(P3, neckDir, B.neckLen * s);
  const hk = s * B.head;
  const head = { ...Fh, o: toWorld({ ...Fh, o: neckTop }, B.cranium.map((v) => v * hk)) };

  const shoulder = (side) => toWorld(F2, [B.shoulder[0] * s, B.shoulder[1] * s, side * B.shoulder[2] * s]);
  const hipJoint = (side) => toWorld(F0, [0.005 * s, -0.055 * s, side * B.hipW * s]);

  const arms = {};
  for (const [key, side] of [["L", -1], ["R", 1]]) {
    const S = shoulder(side);
    const a = pose.arms?.[key] || { kind: "hang" };
    let wrist = a.wrist;
    let hand = a.hand;
    if (a.kind === "hang") {
      wrist = toWorld(root, [0.02 * s, (B.pelvis - 0.12) * s + lift, side * (B.shoulder[2] + 0.02) * s]);
      wrist = add(S, mul(norm(sub(wrist, S)), (B.upper + B.fore) * s * 0.97));
      hand = { x: norm(add(sub(wrist, S), mul(root.x, 0.1))), y: mul(root.z, -side) };
    }
    const pole = a.pole || add(mul(root.x, -0.6), add(mul(root.z, side * 0.5), [0, -0.3, 0]));
    const { mid: elbow, end } = ik(S, wrist, B.upper * s, B.fore * s, pole);
    arms[key] = { side, S, elbow, wrist: end, hand: frame(end, hand.x, hand.y), curl: a.curl || [0.28, 0.4, 0.22], thumb: a.thumb ?? 0.4, spread: a.spread ?? 0.06 };
  }

  const legs = {};
  for (const [key, side] of [["L", -1], ["R", 1]]) {
    const Hj = hipJoint(side);
    const l = pose.legs?.[key] || {};
    const ankle = toWorld(root, [l.forward || 0, B.ankle * s + (l.lift ?? lift), side * (l.wide ?? 0.1) * s]);
    const pole = add(root.x, mul(root.z, side * 0.15));
    const { mid: knee, end } = ik(Hj, ankle, B.thigh * s, B.shin * s, pole);
    const toes = rotate(root.x, [0, 1, 0], -side * 0.12);
    const tip = l.lift ?? lift;
    const foot = turn(frame(end, toes, [0, 1, 0]), cross(toes, [0, 1, 0]), tip > 0.005 ? -Math.asin(Math.min(0.9, tip / (0.14 * s))) : 0);
    legs[key] = { side, H: Hj, knee, ankle: end, foot };
  }

  return { spec, s, hk, root, F0, F1, F2, P0, P1, P2, P3, neckTop, head, arms, legs, B };
}

function hand(arm, s, m) {
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

export function faceShape(spec) {
  const f = spec.sex === "f";
  const fc = { jaw: 1, chin: 0, fwd: 0, ...spec.face };
  return {
    c: f ? [0.01, -0.036, 0] : [0.012, -0.038, 0],
    r: f ? [0.072, 0.097, 0.067] : [0.076, 0.1, 0.072],
    chin: f ? [0.053 + fc.fwd, -0.099 - fc.chin, 0] : [0.058 + fc.fwd, -0.108 - fc.chin, 0],
    jaw: (z) => (f ? [-0.026, -0.058, z * 0.058 * fc.jaw] : [-0.03, -0.066, z * 0.064 * fc.jaw]),
    cheek: (z) => (f ? [0.046, -0.04 + fc.cheek * 0.01, z * 0.062 * fc.jaw] : [0.05, -0.044 + fc.cheek * 0.01, z * 0.066 * fc.jaw]),
  };
}

export function headShape(sk, m) {
  const F = sk.head;
  const k = sk.hk;
  const f = sk.spec.sex === "f";
  const W = (l) => toWorld(F, l.map((v) => v * k));
  const skull = f ? [0.088, 0.093, 0.08] : [0.091, 0.096, 0.083];
  const shape = faceShape(sk.spec);
  const chin = W(shape.chin);
  const orient = (n, ref) => (dot(n, ref) < 0 ? mul(n, -1) : n);
  const facet = (z) => {
    const n = orient(norm(cross(sub(W(shape.jaw(z)), chin), sub(W(shape.cheek(z)), chin))), mul(F.z, z));
    return { n, d: dot(n, chin) };
  };
  const under = orient(norm(cross(sub(W(shape.jaw(1)), chin), sub(W(shape.jaw(-1)), chin))), mul(F.y, -1));
  const face = ell(W(shape.c), shape.r.map((v) => v * k), F, m, F.y, [facet(-1), facet(1), { n: under, d: dot(under, chin) }]);
  const nose = rc(W([0.081, -0.026, 0]), W([f ? 0.092 : 0.095, f ? -0.045 : -0.049, 0]), (f ? 0.0042 : 0.005) * k, 0.0011 * k, m);
  const ears = [-1, 1].map((z) => ell(W([-0.014, -0.03, z * 0.073]), [0.011 * k, 0.021 * k, 0.005 * k], F, m));
  return smin(0.004 * k, [smin(0.011 * k, [ell(W([-0.006, 0.02, 0]), skull.map((v) => v * k), F, m), face]), nose, ...ears]);
}

export function body(sk, person, outfit, rng, wind) {
  const { s, F0, F1, F2, P3, neckTop, arms, legs } = sk;
  const f = sk.spec.sex === "f";
  const L = sk.spec.build?.limb ?? 1;
  const skin = person * 16 + MAT.skin;
  const S = (l) => l.map((v) => v * s);

  const torso = f
    ? [
        ell(toWorld(F0, S([-0.004, 0, 0])), S([0.092, 0.1, 0.146]), F0, skin),
        ...[-1, 1].map((z) => ell(toWorld(F0, S([-0.045, -0.055, z * 0.064])), S([0.066, 0.085, 0.068]), F0, skin)),
        ell(toWorld(F1, S([0.006, 0, 0])), S([0.066, 0.1, 0.09]), F1, skin),
        ell(F2.o, S([0.084, 0.13, 0.112]), F2, skin),
        ...[-1, 1].map((z) => ell(toWorld(F2, S([0.058, -0.03, z * 0.05])), S([0.046, 0.05, 0.052]), F2, skin)),
        ...[-1, 1].map((z) => rc(toWorld(F2, S([0.07, 0.13, z * 0.012])), toWorld(F2, S([0.03, 0.155, z * 0.11])), 0.011 * s, 0.009 * s, skin)),
      ]
    : [
        ell(toWorld(F0, S([-0.004, 0, 0])), S([0.1, 0.1, 0.155]), F0, skin),
        ell(toWorld(F1, S([0.008, 0.01, 0])), S([0.082, 0.12, 0.118]), F1, skin),
        ell(F2.o, S([0.098, 0.15, 0.142]), F2, skin),
      ];
  const shoulders = [-1, 1].map((side) => {
    const A = side < 0 ? arms.L : arms.R;
    return [rc(toWorld(F2, S([-0.03, 0.15, side * 0.035])), A.S, (f ? 0.036 : 0.048) * s, (f ? 0.033 : 0.044) * s, skin), sph(A.S, (f ? 0.038 : 0.05) * s, skin)];
  });
  const neck = rc(madd(P3, F2.y, -0.03 * s), neckTop, (f ? 0.038 : 0.05) * s * L, (f ? 0.033 : 0.044) * s * L, skin);

  const armShape = (A) => {
    const fa = limb(A.elbow, A.wrist, F2.y);
    const t = (f ? [0.034, 0.025, 0.026, 0.017] : [0.046, 0.034, 0.036, 0.023]).map((v) => v * s * L);
    return smin(0.012 * s, [
      rc(A.S, A.elbow, t[0], t[1], skin),
      rc(A.elbow, A.wrist, t[2], t[3], skin),
      ell(lerp(A.elbow, A.wrist, 0.26), S(f ? [0.058, 0.028, 0.03] : [0.072, 0.038, 0.041]).map((v) => v * L), fa, skin, fa.x),
      hand(A, s * sk.B.hand, skin),
    ]);
  };

  const legShape = (Lg) => {
    const th = limb(Lg.H, Lg.knee, sk.root.x);
    const sh = limb(Lg.knee, Lg.ankle, sk.root.x);
    const t = (f ? [0.078, 0.042, 0.042, 0.021] : [0.086, 0.05, 0.048, 0.027]).map((v) => v * s * L);
    return smin(0.016 * s, [
      rc(Lg.H, Lg.knee, t[0], t[1], skin),
      ell(add(lerp(Lg.H, Lg.knee, 0.36), mul(th.y, 0.01 * s)), S(f ? [0.13, 0.06, 0.062] : [0.14, 0.068, 0.07]).map((v) => v * L), th, skin, th.x),
      rc(Lg.knee, Lg.ankle, t[2], t[3], skin),
      ell(add(lerp(Lg.knee, Lg.ankle, 0.3), mul(sh.y, -0.018 * s)), S(f ? [0.1, 0.034, 0.036] : [0.11, 0.041, 0.042]).map((v) => v * L), sh, skin, sh.x),
    ]);
  };

  const skinNode = smin(0.012 * s, [
    smin(0.03 * s, [...torso, neck, ...shoulders.flat()]),
    headShape(sk, skin),
    armShape(arms.L),
    armShape(arms.R),
    legShape(legs.L),
    legShape(legs.R),
  ]);

  return hmin([skinNode, ...wear(sk, person, outfit, rng, wind)]);
}
