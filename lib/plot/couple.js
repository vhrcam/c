import { random } from "../random.js";
import { MAT, body, hmin, skeleton } from "./figure.js";
import { genome } from "./genome.js";
import { hairdo } from "./hair.js";
import { handGenome } from "./hand.js";
import { dress } from "./outfit.js";
import { add, cross, dot, frame, lerp, madd, mul, norm, rotate, sub, toWorld } from "./math.js";

const LIPS = [0.078, -0.066, 0];
const lips = (sk) => toWorld(sk.head, LIPS.map((v) => v * sk.hk));

function solveMan(man, pose, target, gap, facing) {
  let best = null;
  for (let lean = 0.04; lean <= 0.42; lean += 0.02) {
    for (let pitch = -0.6; pitch <= 0.0; pitch += 0.03) {
      const sk = skeleton(man, { ...pose, lean, pitch, hipShift: -lean * 0.12 });
      const l = lips(sk);
      const err = Math.abs(l[1] - target[1]) * 10 + Math.abs(lean - 0.2) * 0.4 + Math.abs(pitch + 0.25) * 0.3;
      if (!best || err < best.err) best = { err, lean, pitch, l };
    }
  }
  const along = dot(sub(target, best.l), facing) + gap;
  return { lean: best.lean, pitch: best.pitch, shift: mul(facing, along) };
}

export function couple(seed, opts = {}) {
  const rng = random(seed);
  const girlLeft = opts.girlLeft ?? rng.chance(0.5);
  const fg = girlLeft ? [1, 0, 0] : [-1, 0, 0];
  const fm = mul(fg, -1);
  const near = (facing) => (cross(facing, [0, 1, 0])[2] > 0 ? "R" : "L");
  const far = (facing) => (near(facing) === "R" ? "L" : "R");
  const wind = mul(norm([rng.range(-1, 1), rng.range(-0.1, 0.15), rng.range(-0.3, 1)]), rng.range(0.3, 0.95));
  const cast = random((seed ^ 0x2c1b3c6d) >>> 0);
  const handRng = random((seed ^ 0x51ed270b) >>> 0);
  const him = genome("m", cast);
  const her = genome("f", cast);
  const man = { sex: "m", height: him.height, genome: him, hand: handGenome("m", handRng) };
  const girl = { sex: "f", height: Math.min(her.height, him.height - 0.07), genome: her, hand: handGenome("f", handRng) };
  const tilt = rng.chance(0.5) ? 1 : -1;
  const pop = rng.chance(0.5);
  const sep = rng.range(0.27, 0.34);

  const turnBody = rng.range(-0.35, 0.35);
  const gPose = {
    base: mul(fg, -sep / 2),
    facing: rotate(fg, [0, 1, 0], turnBody),
    tiptoe: pop ? 0 : rng.range(0.015, 0.045),
    lean: rng.range(0.03, 0.1),
    pitch: rng.range(0.28, 0.44),
    roll: tilt * rng.range(0.12, 0.24),
    yaw: -turnBody * 0.75 + rng.range(-0.06, 0.06),
    twist: rng.range(-0.08, 0.08),
    legs: pop ? { [far(fg)]: { forward: -0.2, lift: 0.22, wide: 0.07 } } : { [near(fg)]: { forward: 0.04 }, [far(fg)]: { forward: -0.03 } },
  };
  let gSk = skeleton(girl, gPose);
  const target = add(lips(gSk), [0, rng.range(0.002, 0.012), 0]);
  const gap = rng.range(0.026, 0.042);
  const mPose = {
    base: mul(fm, -sep / 2),
    facing: fm,
    roll: tilt * rng.range(0.12, 0.22),
    yaw: rng.range(-0.05, 0.05),
    twist: rng.range(-0.06, 0.06),
    legs: { [near(fm)]: { forward: rng.range(-0.06, 0.06), wide: 0.11 }, [far(fm)]: { forward: rng.range(-0.08, 0.02), wide: 0.1 } },
  };
  const solved = solveMan(man, mPose, target, -gap, fm);
  mPose.lean = solved.lean;
  mPose.pitch = solved.pitch;
  mPose.hipShift = -solved.lean * 0.12;
  mPose.base = add(mPose.base, solved.shift);
  let mSk = skeleton(man, mPose);

  const high = rng.chance(0.3);
  const hold = high
    ? [lerp(gSk.P2, mSk.P2, rng.range(0.42, 0.55))[0], lerp(gSk.P2, mSk.P2, 0.5)[1] - rng.range(0.04, 0.1), 0.15 + rng.range(0, 0.03)]
    : [lerp(gSk.P0, mSk.P0, rng.range(0.42, 0.55))[0], rng.range(0.9, 0.98), 0.21 + rng.range(0, 0.04)];
  const mk = mSk.s * mSk.B.hand;
  const gk = gSk.s * gSk.B.hand;
  const clasp = frame(hold, add(fm, [0, 0.18, -0.08]), [0, 1, 0]);
  const gHand = { x: mul(clasp.x, -1), y: mul(clasp.y, -1) };
  const gPalm = add(madd(hold, clasp.x, 0.075 * mk), mul(clasp.y, 0.028 * mk));
  gPose.arms = {
    [near(fg)]: { kind: "hold", gesture: "rest", wrist: madd(gPalm, gHand.x, -0.05 * gk), hand: gHand, curl: [0.08, 0.1, 0.06], thumb: 0.35, spread: 0.02, pole: high ? [0, -1, 0.25] : [0, -0.7, 0.5] },
  };
  mPose.arms = {
    [near(fm)]: { kind: "hold", gesture: "cradle", wrist: madd(hold, clasp.x, -0.05 * mk), hand: { x: clasp.x, y: clasp.y }, curl: [0.05, 0.07, 0.04], thumb: 0.55, spread: 0.02, pole: high ? [0, -1, 0.25] : [0, -0.7, 0.5] },
  };

  const gFree = opts.herHand || rng.pick(["chest", "chest", "shoulder", "neck"]);
  const mFree = opts.hisHand || rng.pick(["waist", "waist", "hang", "cheek", "back"]);
  if (gFree === "chest") {
    const c = toWorld(mSk.F2, [0.128, -0.01, -0.07 * (near(fm) === "R" ? 1 : -1)]);
    const h = { x: norm([0, 1, -0.35]), y: fg };
    gPose.arms[far(fg)] = { kind: "on", gesture: "palm", wrist: madd(madd(c, fg, -0.02), h.x, -0.05 * 0.87 * gSk.s), hand: h, curl: [0.12, 0.18, 0.1], thumb: 0.1, spread: 0.1, pole: [0, -0.6, -1] };
  } else if (gFree === "shoulder") {
    const S = mSk.arms[far(fm)].S;
    const c = add(madd(S, fm, -0.02), [0, 0.055, 0.03]);
    const h = { x: norm(add(fm, [0, -0.35, 0])), y: [0, -1, 0] };
    gPose.arms[far(fg)] = { kind: "on", gesture: "grip", wrist: madd(c, h.x, -0.06 * 0.87 * gSk.s), hand: h, curl: [0.35, 0.45, 0.25], thumb: 0.3, pole: [0, -0.8, -0.5] };
  }
  if (gFree === "neck") {
    const c = add(madd(mSk.neckTop, fm, -0.05), [0, -0.01, -0.03]);
    const h = { x: norm([0, -0.3, 1]), y: fm };
    gPose.arms[far(fg)] = { kind: "on", gesture: "wrap", wrist: madd(c, h.x, -0.06 * 0.87 * gSk.s), hand: h, curl: [0.4, 0.5, 0.3], thumb: 0.3, pole: [0, -0.8, -1] };
  }
  if (mFree === "cheek") {
    const c = add(toWorld(gSk.head, [0.03 * gSk.hk, -0.06 * gSk.hk, 0]), [0, 0, -0.075 * gSk.hk]);
    const h = { x: norm(add([0, 1, 0], mul(fg, -0.35))), y: [0, 0, 1] };
    mPose.arms[far(fm)] = { kind: "on", gesture: "cup", wrist: madd(c, h.x, -0.065), hand: h, curl: [0.12, 0.18, 0.1], thumb: 0.2, spread: 0.08, pole: [0, -1, -0.6] };
  }
  if (mFree === "back") {
    const c = toWorld(gSk.F2, [-0.1 * gSk.s, 0.02 * gSk.s, -0.045 * gSk.s * (near(fg) === "R" ? 1 : -1)]);
    const h = { x: norm([0, 0.3, 1]), y: fg };
    mPose.arms[far(fm)] = { kind: "on", gesture: "waist", wrist: madd(madd(c, fg, -0.02), h.x, -0.06), hand: h, curl: [0.12, 0.16, 0.1], thumb: 0.2, pole: [0, -0.6, -1] };
  }
  if (mFree === "waist") {
    const c = toWorld(gSk.F1, [-0.078, 0.01, -0.035 * (near(fg) === "R" ? 1 : -1)]);
    const h = { x: norm([0, -0.25, 1]), y: fg };
    mPose.arms[far(fm)] = { kind: "on", gesture: "waist", wrist: madd(madd(c, fg, -0.02), h.x, -0.06), hand: h, curl: [0.15, 0.2, 0.12], thumb: 0.15, pole: [0, -0.7, -1] };
  }
  gSk = skeleton(girl, gPose);
  mSk = skeleton(man, mPose);

  const gOutfit = dress("f", cast);
  const mOutfit = dress("m", cast);
  const tuck = rng.chance(0.5) ? (near(fg) === "R" ? 1 : -1) : 0;

  const hairRng = random((seed ^ 0x5bd1e995) >>> 0);
  const nodes = [
    hmin([body(mSk, 1, mOutfit, cast, wind), hairdo(mSk, hairRng, wind, 16 + MAT.hairA)]),
    hmin([body(gSk, 2, gOutfit, cast, wind), hairdo(gSk, hairRng, wind, 32 + MAT.hairB, { tuck })]),
  ];
  mSk.outfit = mOutfit;
  gSk.outfit = gOutfit;
  const kiss = lerp(lips(gSk), lips(mSk), 0.5);
  return { nodes, people: [mSk, gSk], kiss, hold, wind, girlLeft, choices: { gFree, mFree, pop, tilt, high, outfits: [mOutfit.kind, gOutfit.kind], types: [him.type, her.type] } };
}
