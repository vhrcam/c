import { add, clamp, cross, dot, frame, len, lerp, madd, mul, norm, rotate, sub, toWorld, turn } from "./math.js";
import { hand } from "./hand.js";
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

const DEFAULT = { tone: 0.5, head: 1, neck: [1, 1], shoulder: 1, slope: 0, chest: [1, 1], bust: 1, waist: [1, 1], hips: [1, 1], torso: 1, arm: [1, 1], leg: [1, 1], foot: 1, skull: [1, 1, 1], jaw: 1, chin: 0, fwd: 0, cheek: 0, nose: [1, 1], ear: 1, posture: { sway: 0, slouch: 0, tilt: 0 } };

export const genes = (spec) => ({ ...DEFAULT, ...spec.genome });

export function proportions(spec) {
  const B0 = BODY[spec.sex];
  const g = genes(spec);
  const grow = (B0.thigh + B0.shin) * (g.leg[0] - 1);
  const pelvis = B0.pelvis + grow;
  const up = (v) => pelvis + (v - B0.pelvis) * g.torso;
  return {
    ...B0,
    height: B0.height + grow + (B0.neck - B0.pelvis) * (g.torso - 1),
    pelvis,
    abdomen: up(B0.abdomen),
    chest: up(B0.chest),
    neck: up(B0.neck),
    thigh: B0.thigh * g.leg[0],
    shin: B0.shin * g.leg[0],
    upper: B0.upper * g.arm[0],
    fore: B0.fore * g.arm[0],
    shoulder: [B0.shoulder[0], B0.shoulder[1] - g.slope * 0.012, B0.shoulder[2] * g.shoulder],
    hipW: B0.hipW * g.hips[0],
    neckLen: B0.neckLen * g.neck[0],
    head: B0.head * g.head,
    foot: g.foot,
  };
}

export function skeleton(spec, pose) {
  const B = proportions(spec);
  const s = spec.height / B.height;
  const root = frame(pose.base, pose.facing, [0, 1, 0]);
  const lift = pose.tiptoe || 0;
  const lean = pose.lean || 0;
  const twist = pose.twist || 0;

  const G = genes(spec);
  const sway = G.posture.sway;
  const P0 = toWorld(root, [pose.hipShift || 0, B.pelvis * s + lift - (pose.drop || 0), 0]);
  let F0 = turn(root, root.z, -lean * 0.18 - G.posture.slouch * 0.03, P0);
  F0 = turn(F0, F0.y, twist * 0.3);
  F0 = turn(F0, F0.x, sway * 0.05);
  const P1 = madd(P0, F0.y, (B.abdomen - B.pelvis) * s);
  let F1 = turn(F0, F0.z, -lean * 0.34, P1);
  F1 = turn(F1, F1.y, twist * 0.35);
  const P2 = madd(P1, F1.y, (B.chest - B.abdomen) * s);
  let F2 = turn(F1, F1.z, -lean * 0.48, P2);
  F2 = turn(F2, F2.y, twist * 0.35);
  F2 = turn(F2, F2.x, (pose.side || 0) - sway * 0.07 + G.posture.tilt * 0.03);
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
    arms[key] = { side, S, elbow, wrist: end, hand: frame(end, hand.x, hand.y), gesture: a.gesture || "hang", loose: a.loose || 0, curl: a.curl || [0.28, 0.4, 0.22], thumb: a.thumb ?? 0.4, spread: a.spread ?? 0.06 };
  }

  const legs = {};
  for (const [key, side] of [["L", -1], ["R", 1]]) {
    const Hj = hipJoint(side);
    const l = pose.legs?.[key] || {};
    const ankle = toWorld(root, [l.forward || 0, B.ankle * s + (l.lift ?? lift), side * (l.wide ?? 0.1) * s]);
    const pole = l.pole || add(root.x, mul(root.z, side * 0.15));
    const { mid: knee, end } = ik(Hj, ankle, B.thigh * s, B.shin * s, pole);
    const toes = rotate(root.x, [0, 1, 0], -side * 0.12);
    const tip = l.lift ?? lift;
    const foot = turn(frame(end, toes, [0, 1, 0]), cross(toes, [0, 1, 0]), tip > 0.005 ? -Math.asin(Math.min(0.9, tip / (0.14 * s))) : 0);
    legs[key] = { side, H: Hj, knee, ankle: end, foot };
  }

  const D = { tone: G.tone, cw: G.chest[0], cd: G.chest[1], ww: G.waist[0], wd: G.waist[1], hw: G.hips[0], hd: G.hips[1], bust: G.bust, T: G.torso, arm: G.arm[1], leg: G.leg[1], neck: G.neck[1], foot: G.foot };
  return { spec, s, hk, root, F0, F1, F2, P0, P1, P2, P3, neckTop, head, arms, legs, B, G, D };
}

export function faceShape(spec) {
  const f = spec.sex === "f";
  const g = genes(spec);
  const wide = Math.sqrt(g.skull[2]);
  return {
    c: f ? [0.01, -0.036, 0] : [0.012, -0.038, 0],
    r: f ? [0.072, 0.097, 0.067 * wide] : [0.076, 0.1, 0.072 * wide],
    chin: f ? [0.053 + g.fwd, -0.099 - g.chin, 0] : [0.058 + g.fwd, -0.108 - g.chin, 0],
    jaw: (z) => (f ? [-0.026, -0.058, z * 0.058 * g.jaw * wide] : [-0.03, -0.066, z * 0.064 * g.jaw * wide]),
    cheek: (z) => (f ? [0.046, -0.04 + g.cheek * 0.01, z * 0.062 * g.jaw * wide] : [0.05, -0.044 + g.cheek * 0.01, z * 0.066 * g.jaw * wide]),
  };
}

export function headShape(sk, m) {
  const F = sk.head;
  const k = sk.hk;
  const f = sk.spec.sex === "f";
  const W = (l) => toWorld(F, l.map((v) => v * k));
  const g = sk.G;
  const skull = (f ? [0.088, 0.093, 0.08] : [0.091, 0.096, 0.083]).map((v, i) => v * g.skull[i]);
  const shape = faceShape(sk.spec);
  const chin = W(shape.chin);
  const orient = (n, ref) => (dot(n, ref) < 0 ? mul(n, -1) : n);
  const facet = (z) => {
    const n = orient(norm(cross(sub(W(shape.jaw(z)), chin), sub(W(shape.cheek(z)), chin))), mul(F.z, z));
    return { n, d: dot(n, chin) };
  };
  const under = orient(norm(cross(sub(W(shape.jaw(1)), chin), sub(W(shape.jaw(-1)), chin))), mul(F.y, -1));
  const face = ell(W(shape.c), shape.r.map((v) => v * k), F, m, F.y, [facet(-1), facet(1), { n: under, d: dot(under, chin) }]);
  const root = [0.081, -0.026, 0];
  const tip = f ? [0.092, -0.045, 0] : [0.095, -0.049, 0];
  const nose = rc(W(root), W(root.map((v, i) => v + (tip[i] - v) * g.nose[0])), (f ? 0.0042 : 0.005) * g.nose[1] * k, 0.0011 * k, m);
  const ears = [-1, 1].map((z) => ell(W([-0.014, -0.03, z * 0.073 * g.skull[2]]), [0.011 * g.ear * k, 0.021 * g.ear * k, 0.005 * k], F, m));
  return smin(0.004 * k, [smin(0.011 * k, [ell(W([-0.006, 0.02, 0]), skull.map((v) => v * k), F, m), face]), nose, ...ears]);
}

export function body(sk, person, outfit, rng, wind) {
  const { s, F0, F1, F2, P3, neckTop, arms, legs, D } = sk;
  const f = sk.spec.sex === "f";
  const skin = person * 16 + MAT.skin;
  const S = (l) => l.map((v) => v * s);
  const bust = D.bust ** 0.8;

  const torso = f
    ? [
        ell(toWorld(F0, S([-0.004, 0, 0])), S([0.092 * D.hd, 0.1, 0.146 * D.hw]), F0, skin),
        ...[-1, 1].map((z) => ell(toWorld(F0, S([-0.045 * D.hd, -0.055, z * 0.064 * D.hw])), S([0.066 * D.hd, 0.085, 0.068 * D.hw]), F0, skin)),
        ell(toWorld(F1, S([0.006, 0, 0])), S([0.066 * D.wd, 0.1 * D.T, 0.09 * D.ww]), F1, skin),
        ell(F2.o, S([0.084 * D.cd, 0.13 * D.T, 0.112 * D.cw]), F2, skin),
        ...[-1, 1].map((z) => ell(toWorld(F2, S([0.058 * D.cd + 0.006 * (bust - 1), -0.03, z * 0.05 * D.cw])), S([0.046 * bust, 0.05 * bust, 0.052 * bust]), F2, skin)),
        ...[-1, 1].map((z) => rc(toWorld(F2, S([0.07 * D.cd, 0.13 * D.T, z * 0.012])), toWorld(F2, S([0.03 * D.cd, 0.155 * D.T, z * 0.11 * D.cw])), 0.011 * s, 0.009 * s, skin)),
      ]
    : [
        ell(toWorld(F0, S([-0.01, 0, 0])), S([0.088 * D.hd, 0.1, 0.14 * D.hw]), F0, skin),
        ell(toWorld(F1, S([0.006, 0, 0])), S([0.076 * D.wd, 0.12 * D.T, 0.11 * D.ww]), F1, skin),
        ell(toWorld(F2, S([0.004, 0.01, 0])), S([0.094 * D.cd, 0.15 * D.T, 0.135 * D.cw]), F2, skin),
        ell(toWorld(F2, S([-0.008, 0.06 * D.T, 0])), S([0.07 * D.cd, 0.088, 0.156 * D.cw]), F2, skin),
        ...[-1, 1].map((z) => ell(toWorld(F2, S([0.05 * D.cd, 0.055 * D.T, z * 0.052 * D.cw])), S([0.042, 0.045, 0.06]), F2, skin)),
        ...[-1, 1].map((z) => rc(toWorld(F2, S([-0.02, 0.19 * D.T, z * 0.02])), (z < 0 ? arms.L : arms.R).S, 0.03 * s * D.neck, 0.026 * s, skin)),
      ];
  const shoulders = [-1, 1].map((side) => {
    const A = side < 0 ? arms.L : arms.R;
    return [rc(toWorld(F2, S([-0.03, 0.15 * D.T, side * 0.035])), A.S, (f ? 0.036 : 0.041) * s * D.arm, (f ? 0.033 : 0.037) * s * D.arm, skin), sph(A.S, (f ? 0.038 : 0.042) * s * D.arm, skin)];
  });
  const neck = smin(0.008 * s, [
    rc(madd(P3, F2.y, -0.03 * s), neckTop, (f ? 0.038 : 0.05) * s * D.neck, (f ? 0.033 : 0.044) * s * D.neck, skin),
    !f && ell(madd(lerp(P3, neckTop, 0.55), F2.x, 0.042 * s * D.neck), S([0.01, 0.014, 0.009]), F2, skin),
  ]);

  const tone = 0.6 + 0.6 * D.tone;
  const bend = (a, joint, b, fallback) => {
    const out = sub(joint, lerp(a, b, 0.5));
    return len(out) > 0.01 * s ? norm(out) : fallback;
  };

  const armShape = (A) => {
    const ua = limb(A.S, A.elbow, F2.x);
    const fa = limb(A.elbow, A.wrist, F2.y);
    const t = (f ? [0.034, 0.025, 0.026, 0.017] : [0.039, 0.029, 0.03, 0.02]).map((v) => v * s * D.arm);
    const point = bend(A.S, A.elbow, A.wrist, mul(F2.x, -1));
    return smin(0.012 * s, [
      rc(A.S, A.elbow, t[0], t[1], skin),
      ell(madd(lerp(A.S, A.elbow, 0.44), ua.y, 0.008 * s), S(f ? [0.07, 0.024, 0.026] : [0.075, 0.027, 0.029]).map((v) => v * D.arm * tone), ua, skin, ua.x),
      sph(madd(A.elbow, point, 0.014 * s * D.arm), (f ? 0.009 : 0.012) * s * tone, skin),
      rc(A.elbow, A.wrist, t[2], t[3], skin),
      ell(lerp(A.elbow, A.wrist, 0.26), S(f ? [0.054, 0.026, 0.028] : [0.062, 0.031, 0.033]).map((v) => v * D.arm * (0.85 + 0.25 * D.tone)), fa, skin, fa.x),
      hand(A, s * sk.B.hand, skin, sk.spec.hand),
    ]);
  };

  const legShape = (Lg) => {
    const th = limb(Lg.H, Lg.knee, sk.root.x);
    const sh = limb(Lg.knee, Lg.ankle, sk.root.x);
    const t = (f ? [0.078, 0.042, 0.042, 0.021] : [0.086, 0.05, 0.048, 0.027]).map((v) => v * s * D.leg);
    const cap = bend(Lg.H, Lg.knee, Lg.ankle, sk.root.x);
    return smin(0.016 * s, [
      rc(Lg.H, Lg.knee, t[0], t[1], skin),
      ell(add(lerp(Lg.H, Lg.knee, 0.36), mul(th.y, 0.01 * s)), S(f ? [0.13, 0.06, 0.062] : [0.14, 0.068, 0.07]).map((v) => v * D.leg), th, skin, th.x),
      sph(madd(Lg.knee, cap, 0.022 * s * D.leg), (f ? 0.02 : 0.024) * s * (0.85 + 0.2 * D.tone), skin),
      rc(Lg.knee, Lg.ankle, t[2], t[3], skin),
      ell(add(lerp(Lg.knee, Lg.ankle, 0.3), mul(sh.y, -0.018 * s)), S(f ? [0.1, 0.034, 0.036] : [0.11, 0.041, 0.042]).map((v) => v * D.leg * (0.85 + 0.3 * D.tone)), sh, skin, sh.x),
      ...[-1, 1].map((z) => sph(madd(madd(Lg.ankle, Lg.foot.z, z * 0.017 * s * D.leg), [0, 1, 0], 0.004 * s), 0.009 * s, skin)),
    ]);
  };

  const skinNode = smin(0.012 * s, [
    smin(0.024 * s, [smin(0.03 * s, [...torso, neck, ...shoulders.flat()]), armShape(arms.L), armShape(arms.R)]),
    headShape(sk, skin),
    legShape(legs.L),
    legShape(legs.R),
  ]);

  return hmin([skinNode, ...wear(sk, person, outfit, rng, wind)]);
}
