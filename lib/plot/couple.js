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
  for (const drop of [0, 0.02, 0.04]) {
    for (let lean = 0.0; lean <= 0.24; lean += 0.02) {
      for (let pitch = -0.8; pitch <= 0.0; pitch += 0.03) {
        const sk = skeleton(man, { ...pose, lean, pitch, drop, hipShift: -lean * 0.12 });
        const l = lips(sk);
        const err = Math.abs(l[1] - target[1]) * 10 + Math.abs(lean - 0.08) * 0.5 + Math.abs(pitch + 0.4) * 0.2 + drop * 3;
        if (!best || err < best.err) best = { err, lean, pitch, drop, l };
      }
    }
  }
  const miss = sub(target, best.l);
  const side = sub(miss, mul(facing, dot(miss, facing)));
  const along = dot(miss, facing) + gap;
  return { lean: best.lean, pitch: best.pitch, drop: best.drop, shift: add(mul(facing, along), [side[0], 0, side[2]]) };
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
  const [sa, sb] = opts.sexes || ["m", "f"];
  const him = genome(sa, cast);
  const her = genome(sb, cast);
  const man = { sex: sa, height: him.height, genome: him, hand: handGenome(sa, handRng) };
  const girl = { sex: sb, height: Math.min(him.height - 0.04, Math.max(him.height - 0.2, her.height)), genome: her, hand: handGenome(sb, handRng) };
  const tilt = rng.chance(0.5) ? 1 : -1;
  const pop = rng.chance(0.5);
  const sep = rng.range(0.27, 0.34);

  const turnBody = rng.range(-0.35, 0.35);
  const gPose = {
    base: mul(fg, -sep / 2),
    facing: rotate(fg, [0, 1, 0], turnBody),
    tiptoe: pop ? rng.range(0.015, 0.03) : rng.range(0.03, 0.06),
    lean: rng.range(0.03, 0.1),
    pitch: rng.range(0.34, 0.52),
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
  mPose.drop = solved.drop;
  mPose.hipShift = -solved.lean * 0.12;
  mPose.base = add(mPose.base, solved.shift);
  let mSk = skeleton(man, mPose);

  const high = rng.chance(0.3);
  let hold = high
    ? [lerp(gSk.P2, mSk.P2, rng.range(0.38, 0.6))[0], lerp(gSk.P2, mSk.P2, 0.5)[1] - rng.range(0.1, 0.2), rng.range(0.19, 0.27)]
    : [lerp(gSk.P0, mSk.P0, rng.range(0.35, 0.62))[0], rng.range(0.84, 1.0), rng.range(0.17, 0.28)];
  const mk = mSk.s * mSk.B.hand;
  const gk = gSk.s * gSk.B.hand;
  const turnIn = rng.range(0.1, 0.45);
  const droop = rng.range(-0.05, 0.18);
  const roll = rng.range(-0.55, 0.55);
  const loose = rng.range(0.2, 0.95);
  const mShoulder = mSk.arms[near(fm)].S;
  const gShoulder = gSk.arms[near(fg)].S;
  const mReach = (mSk.B.upper + mSk.B.fore) * mSk.s;
  const gReach = (gSk.B.upper + gSk.B.fore) * gSk.s;
  const elbowGuess = add(madd(mShoulder, fm, 0.05), [0, -mSk.B.upper * mSk.s * 0.85, 0]);
  const claspAt = (o) => {
    const fore = norm(sub(o, elbowGuess));
    const x = norm(add(add(mul(fore, 1 - turnIn), mul(fm, turnIn)), [0, -droop, 0]));
    const up = norm(sub([0, 1, 0], mul(x, x[1])));
    return frame(o, x, rotate(up, x, roll));
  };
  let clasp = claspAt(hold);
  const palmGap = 0.028 * (1 + loose * 0.25);
  const mWrist = () => madd(hold, clasp.x, -0.05 * mk);
  const gPalm = () => add(madd(hold, clasp.x, 0.075 * mk), mul(clasp.y, palmGap * mk));
  const gWrist = () => madd(gPalm(), mul(clasp.x, -1), -0.05 * gk);
  const fit = (shoulder, wrist, reach) => {
    const d = sub(wrist, shoulder);
    const l = Math.hypot(...d);
    const want = Math.min(0.88 * reach, Math.max(0.5 * reach, l));
    return mul(norm(d), want - l);
  };
  for (let i = 0; i < 8; i++) {
    hold = add(hold, fit(mShoulder, mWrist(), mReach));
    hold = add(hold, fit(gShoulder, gWrist(), gReach));
    clasp = claspAt(hold);
  }
  const gHand = { x: mul(clasp.x, -1), y: mul(clasp.y, -1) };
  gPose.arms = {
    [near(fg)]: { kind: "hold", gesture: "rest", loose, wrist: gWrist(), hand: gHand, curl: [0.08, 0.1, 0.06], thumb: 0.35, spread: 0.02, pole: high ? [0, -1, 0.25] : [0, -0.7, 0.5] },
  };
  mPose.arms = {
    [near(fm)]: { kind: "hold", gesture: "cradle", loose, wrist: mWrist(), hand: { x: clasp.x, y: clasp.y }, curl: [0.05, 0.07, 0.04], thumb: 0.55, spread: 0.02, pole: high ? [0, -1, 0.25] : [0, -0.7, 0.5] },
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

  const gOutfit = opts.outfit ? opts.outfit(sb, 1) : dress("f", cast);
  const mOutfit = opts.outfit ? opts.outfit(sa, 0) : dress("m", cast);
  const tuck = rng.chance(0.5) ? (near(fg) === "R" ? 1 : -1) : 0;

  const hairRng = random((seed ^ 0x5bd1e995) >>> 0);
  const nodes = [
    hmin([body(mSk, 1, mOutfit, cast, wind), hairdo(mSk, hairRng, wind, 16 + MAT.hairA, { styles: opts.hair?.[0] })]),
    hmin([body(gSk, 2, gOutfit, cast, wind), hairdo(gSk, hairRng, wind, 32 + MAT.hairB, { tuck, styles: opts.hair?.[1] })]),
  ];
  mSk.outfit = mOutfit;
  gSk.outfit = gOutfit;
  const kiss = lerp(lips(gSk), lips(mSk), 0.5);
  return { nodes, people: [mSk, gSk], kiss, hold, wind, girlLeft, choices: { gFree, mFree, pop, tilt, high, outfits: [mOutfit.kind, gOutfit.kind], types: [him.type, her.type] } };
}
