import { random } from "../random";
import { couple } from "../plot/couple.js";
import { MAT, body, hmin, proportions, skeleton } from "../plot/figure.js";
import { genome } from "../plot/genome.js";
import { hairdo } from "../plot/hair.js";
import { handGenome } from "../plot/hand.js";
import { add, cross, lerp, madd, mul, norm, rotate, sub, toWorld } from "../plot/math.js";
import { dress } from "../plot/outfit.js";

export const POSES = ["embrace", "sit", "stand", "walk", "run", "alone"];

const UP = [0, 1, 0];
const head = (sk) => sk.head.o;

function cast(seed, sexes) {
  const rng = random((seed ^ 0x2c1b3c6d) >>> 0);
  const hands = random((seed ^ 0x51ed270b) >>> 0);
  const specs = sexes.map((sex) => {
    const g = genome(sex, rng);
    return { sex, height: g.height, genome: g, hand: handGenome(sex, hands) };
  });
  if (specs.length === 2 && specs[1].sex === "f") specs[1].height = Math.min(specs[0].height - 0.06, Math.max(specs[0].height - 0.22, specs[1].height));
  return { specs, rng };
}

function seated(spec, base, facing, extra = {}) {
  const B = proportions(spec);
  const s = spec.height / B.height;
  const pole = norm(add(UP, mul(facing, 0.6)));
  return {
    base,
    facing,
    drop: B.pelvis * s - 0.15,
    lean: 0.06,
    pitch: 0.08,
    legs: { L: { forward: 0.4 * s, lift: 0, wide: 0.13, pole }, R: { forward: 0.4 * s, lift: 0, wide: 0.13, pole } },
    ...extra,
  };
}

const rest = (sk, key, toward = [0, 0, 0]) => {
  const k = sk.legs[key].knee;
  const wrist = add(add(k, [0, 0.04, 0]), toward);
  return { kind: "on", gesture: "rest", wrist, hand: { x: norm(add(sub(wrist, sk.arms[key].S), [0, -0.3, 0])), y: [0, -1, 0] }, curl: [0.25, 0.35, 0.2], thumb: 0.3, pole: [0, -1, 0] };
};

function dressed(sk, person, outfit, rng, wind, hairRng, m, opts) {
  sk.outfit = outfit;
  return hmin([body(sk, person, outfit, rng, wind), hairdo(sk, hairRng, wind, person * 16 + m, opts)]);
}

function pair(seed, pose) {
  const r = random(seed);
  const { specs, rng } = cast(seed, ["m", "f"]);
  const [man, girl] = specs;
  const yaw = r.range(-0.45, 0.45);
  let facing = pose === "walk" ? rotate([r.chance(0.5) ? 1 : -1, 0, 0], UP, r.range(0.55, 1.05)) : rotate([0, 0, -1], UP, yaw);
  if (pose === "walk" && facing[2] < 0) facing = [facing[0], 0, -facing[2]];
  const right = norm(cross(facing, UP));
  const girlRight = r.chance(0.5);
  const toHer = girlRight ? 1 : -1;
  const sep = pose === "sit" ? 0.4 : r.range(0.42, 0.5);
  const mBase = mul(right, (-toHer * sep) / 2);
  const gBase = mul(right, (toHer * sep) / 2);
  const mNear = toHer > 0 ? "R" : "L";
  const mFar = mNear === "R" ? "L" : "R";
  const gNear = mFar;
  const gFar = mNear;
  const wind = mul(norm([r.range(-1, 1), r.range(-0.1, 0.15), r.range(-0.3, 1)]), r.range(0.2, 0.8));
  let mPose;
  let gPose;
  const lean = r.range(0.1, 0.22) * toHer;
  if (pose === "sit") {
    mPose = seated(man, mBase, facing);
    gPose = seated(girl, gBase, facing, { side: -lean * 0.6, roll: -toHer * r.range(0.3, 0.5), pitch: 0.12 });
  } else {
    const stride = pose === "walk" ? r.range(0.18, 0.26) : 0;
    const legs = (k) => ({ [k === 0 ? "L" : "R"]: { forward: stride, wide: 0.1 }, [k === 0 ? "R" : "L"]: { forward: -stride * 0.9, lift: stride ? 0.05 : 0, wide: 0.1 } });
    const phase = r.chance(0.5) ? 0 : 1;
    mPose = { base: mBase, facing, lean: stride ? 0.05 : 0, legs: legs(phase) };
    gPose = { base: gBase, facing, lean: stride ? 0.05 : 0, side: -lean * 0.3, roll: -toHer * r.range(0.12, 0.26), legs: legs(phase) };
  }
  let mSk = skeleton(man, mPose);
  let gSk = skeleton(girl, gPose);
  if (pose === "sit") {
    const S = lerp(gSk.arms[gNear].S, gSk.arms[gFar].S, 0.5);
    const wrist = add(madd(S, facing, -0.07), [0, -0.02, 0]);
    mPose.arms = {
      [mNear]: { kind: "on", gesture: "rest", wrist, hand: { x: norm(sub(wrist, mSk.arms[mNear].S)), y: [0, -1, 0] }, curl: [0.3, 0.4, 0.25], thumb: 0.4, pole: norm(add(mul(facing, -1), [0, -0.4, 0])) },
      [mFar]: rest(mSk, mFar),
    };
    gPose.arms = { [gNear]: rest(gSk, gNear, mul(right, -toHer * 0.05)), [gFar]: rest(gSk, gFar) };
  } else {
    const hip = (sk, key) => sk.legs[key].H;
    const hold = add(lerp(hip(mSk, mNear), hip(gSk, gNear), 0.5), add(mul(facing, 0.08), [0, -0.06, 0]));
    const grip = (sk, key, off) => {
      const wrist = madd(add(hold, mul(right, off)), UP, 0.04);
      return { kind: "on", gesture: "grip", wrist, hand: { x: norm(add(sub(hold, sk.arms[key].S), mul(UP, -0.2))), y: mul(right, -Math.sign(off)) }, curl: [0.4, 0.5, 0.3], thumb: 0.4, pole: [0, -0.6, -0.4] };
    };
    const swing = (sk, key, k) => {
      const S = sk.arms[key].S;
      const wrist = add(add(S, [0, -0.55 * sk.s, 0]), mul(facing, k * 0.18));
      return { kind: "on", gesture: "rest", wrist, hand: { x: norm(sub(wrist, S)), y: mul(right, key === "R" ? 1 : -1) }, curl: [0.3, 0.4, 0.25], thumb: 0.4 };
    };
    const k = pose === "walk" ? 1 : 0;
    mPose.arms = { [mNear]: grip(mSk, mNear, -toHer * 0.035), [mFar]: swing(mSk, mFar, k) };
    gPose.arms = { [gNear]: grip(gSk, gNear, toHer * 0.035), [gFar]: swing(gSk, gFar, -k) };
  }
  mSk = skeleton(man, mPose);
  gSk = skeleton(girl, gPose);
  const hairRng = random((seed ^ 0x5bd1e995) >>> 0);
  const mOut = dress("m", rng);
  const gOut = dress("f", rng);
  const nodes = [dressed(mSk, 1, mOut, rng, wind, hairRng, MAT.hairA), dressed(gSk, 2, gOut, rng, wind, hairRng, MAT.hairB, { tuck: 0 })];
  const kiss = lerp(head(mSk), head(gSk), 0.5);
  return { nodes, people: [mSk, gSk], kiss, wind, facing, choices: { outfits: [mOut.kind, gOut.kind] } };
}

function solo(seed, pose) {
  const r = random(seed);
  const { specs, rng } = cast(seed, [r.chance(0.5) ? "f" : "m"]);
  const [spec] = specs;
  const run = pose === "run";
  const facing = run ? rotate([r.chance(0.5) ? 1 : -1, 0, 0], UP, r.range(-0.6, 0.6)) : rotate([0, 0, -1], UP, r.range(-0.6, 0.6));
  const wind = run ? mul(facing, -0.9) : mul(norm([r.range(-1, 1), 0, r.range(-0.3, 1)]), r.range(0.2, 0.7));
  let p;
  if (pose === "sit") p = seated(spec, [0, 0, 0], facing, { pitch: r.range(-0.1, 0.2) });
  else if (run) {
    const lead = r.chance(0.5) ? "L" : "R";
    const back = lead === "L" ? "R" : "L";
    p = { base: [0, 0, 0], facing, lean: 0.32, tiptoe: 0.07, pitch: -0.1, legs: { [lead]: { forward: 0.34, lift: 0.3, wide: 0.08 }, [back]: { forward: -0.4, lift: 0.36, wide: 0.08 } } };
  } else p = { base: [0, 0, 0], facing, legs: { L: { forward: 0.03, wide: 0.11 }, R: { forward: -0.03, wide: 0.11 } }, pitch: r.range(-0.25, 0.05) };
  let sk = skeleton(spec, p);
  if (pose === "sit") p.arms = { L: rest(sk, "L"), R: rest(sk, "R") };
  if (run) {
    const lead = p.legs.L.lift === 0.3 ? "L" : "R";
    const other = lead === "L" ? "R" : "L";
    const S = (k) => sk.arms[k].S;
    const front = add(add(S(other), mul(facing, 0.17)), [0, -0.16, 0]);
    const rear = add(add(S(lead), mul(facing, -0.2)), [0, -0.36, 0]);
    p.arms = {
      [other]: { kind: "on", gesture: "rest", wrist: front, hand: { x: norm(add(facing, [0, 0.4, 0])), y: [0, -1, 0] }, curl: [0.6, 0.7, 0.5], thumb: 0.6, pole: norm(add(mul(facing, -1), [0, -1, 0])) },
      [lead]: { kind: "on", gesture: "rest", wrist: rear, hand: { x: norm(add(mul(facing, -1), [0, -0.3, 0])), y: [0, -1, 0] }, curl: [0.6, 0.7, 0.5], thumb: 0.6, pole: norm(add(mul(facing, -1), [0, 0.5, 0])) },
    };
  }
  sk = skeleton(spec, p);
  const out = dress(spec.sex, rng);
  const node = dressed(sk, 1, out, rng, wind, random((seed ^ 0x5bd1e995) >>> 0), spec.sex === "f" ? MAT.hairB : MAT.hairA, {});
  return { nodes: [node], people: [sk], kiss: head(sk), wind, facing, choices: { outfits: [out.kind] } };
}

export function people(seed, pose, count = 2) {
  if (pose === "embrace") return couple(seed);
  if (count === 1 || pose === "run" || pose === "alone") return solo(seed, pose === "alone" ? "stand" : pose);
  return pair(seed, pose);
}

export const focusOf = (scene) => scene.kiss;
export { toWorld };
