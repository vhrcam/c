import { random } from "../random";
import { couple } from "../plot/couple.js";
import { MAT, body, hmin, proportions, skeleton } from "../plot/figure.js";
import { genome } from "../plot/genome.js";
import { hairdo } from "../plot/hair.js";
import { handGenome } from "../plot/hand.js";
import { add, cross, lerp, madd, mul, norm, rotate, sub, toWorld } from "../plot/math.js";

export const POSES = ["embrace", "sit", "stand", "walk", "run", "alone"];

const has = (text, re) => re.test(String(text || "").toLowerCase());

export function sexOf(subject, r) {
  if (subject?.gender === "woman") return "f";
  if (subject?.gender === "man") return "m";
  return r.chance(0.5) ? "f" : "m";
}

export function hairFor(sex, subject, ctx, r) {
  const said = `${subject?.hair || ""} ${subject?.appearance || ""}`;
  if (has(said, /pigtail|twin ?tail/)) return ["twinTails"];
  if (has(said, /ponytail/)) return ["ponytail"];
  if (has(said, /\bbob\b/)) return ["bob"];
  if (has(said, /spiky|spikes/)) return ["spiky"];
  if (has(said, /long/)) return ["longStraight", "windBlown"];
  if (has(said, /short|buzz|crop/)) return ["sweptBack", "shaggy", "curtain"];
  if (ctx.pose === "run") return sex === "f" ? ["ponytail", "windBlown", "shaggy", "bob"] : ["shaggy", "sweptBack", "curtain"];
  return sex === "f" ? ["longStraight", "windBlown", "ponytail", "bob", "shaggy", "curtain"] : ["sweptBack", "shaggy", "curtain", "bob"];
}

export function outfitFor(sex, subject, ctx, r) {
  const said = String(subject?.clothing || "").toLowerCase();
  const slim = r.range(0.9, 1.04);
  const shirt = (sleeve) => ({ kind: "shirt", slim, sleeve, scarf: false });
  const sweater = () => ({ kind: "sweater", slim, sleeve: 0.97, neck: r.pick(["crew", "crew", "turtle"]), scarf: false });
  const jacket = () => ({ kind: "jacket", slim, sleeve: 1.02, scarf: ctx.cold && r.chance(0.5), length: r.range(0.08, 0.14), folds: 4, power: 1, sway: 0, gap: r.range(0.35, 0.55), open: r.range(0.02, 0.05), collar: "point" });
  const sundress = () => ({ kind: "sundress", length: r.range(0.44, 0.62), flare: r.range(0.22, 0.34), folds: r.int(8, 14), sharp: r.range(0.3, 1), power: r.range(0.75, 1.4), neck: r.range(0.02, 0.06), sway: r.range(0.15, 0.4) });
  let o;
  if (/dress|gown/.test(said)) o = sundress();
  else if (/kimono|yukata/.test(said)) o = { kind: "yukata", length: r.range(0.8, 0.86), flare: r.range(0.15, 0.19), folds: r.int(6, 9), sway: r.range(0.1, 0.25) };
  else if (/uniform|sailor/.test(said)) o = { kind: "sailor", length: r.range(0.36, 0.48), flare: r.range(0.2, 0.27), folds: r.int(18, 26), sway: r.range(0.15, 0.35) };
  else if (/jacket|coat|parka/.test(said)) o = jacket();
  else if (/sweater|hoodie|jumper|knit/.test(said)) o = sweater();
  else if (/shirt|tee|t-shirt|tank/.test(said)) o = shirt(r.range(0.42, 0.6));
  else if (ctx.pose === "run") o = shirt(r.range(0.42, 0.5));
  else if (ctx.cold || ctx.wet) o = r.chance(0.6) ? jacket() : sweater();
  else if (ctx.warm && sex === "f" && r.chance(0.3)) o = sundress();
  else o = r.chance(0.55) ? shirt(r.chance(0.5) ? r.range(0.42, 0.6) : 1.02) : r.chance(0.5) ? sweater() : jacket();
  return { ...o, extras: {}, pattern: {} };
}

function context(setting = {}, pose) {
  const { place, time, weather } = setting;
  return { pose, cold: weather === "snow" || place === "snow" || place === "mountains" || time === "night", wet: weather === "rain", warm: ["sea", "field", "garden", "desert"].includes(place) && time !== "night" };
}

const UP = [0, 1, 0];
const head = (sk) => sk.head.o;

function cast(seed, sexes, subjects = []) {
  const rng = random((seed ^ 0x2c1b3c6d) >>> 0);
  const hands = random((seed ^ 0x51ed270b) >>> 0);
  const specs = sexes.map((sex, i) => {
    const g = genome(sex, rng);
    const age = subjects[i]?.age;
    if (age === "child") {
      g.head *= 1.2;
      g.leg = g.leg.map((v, k) => v * (k ? 1 : 0.9));
      g.shoulder *= 0.9;
      return { sex, height: rng.range(1.15, 1.35), genome: g, hand: handGenome(sex, hands) };
    }
    return { sex, height: g.height * (age === "elder" ? 0.97 : 1), genome: g, hand: handGenome(sex, hands) };
  });
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

function dressed(sk, person, outfit, rng, wind, hairRng, m, styles) {
  sk.outfit = outfit;
  return hmin([body(sk, person, outfit, rng, wind), hairdo(sk, hairRng, wind, person * 16 + m, { styles })]);
}

function pair(seed, pose, subjects, ctx) {
  const r = random(seed);
  const sexes = [0, 1].map((i) => sexOf(subjects[i], random((seed ^ (0x9e37 + i * 977)) >>> 0)));
  const { specs, rng } = cast(seed, sexes, subjects);
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
  const mOut = outfitFor(man.sex, subjects[0], ctx, rng);
  const gOut = outfitFor(girl.sex, subjects[1], ctx, rng);
  const nodes = [dressed(mSk, 1, mOut, rng, wind, hairRng, MAT.hairA, hairFor(man.sex, subjects[0], ctx, rng)), dressed(gSk, 2, gOut, rng, wind, hairRng, MAT.hairB, hairFor(girl.sex, subjects[1], ctx, rng))];
  const kiss = lerp(head(mSk), head(gSk), 0.5);
  return { nodes, people: [mSk, gSk], kiss, wind, facing, choices: { outfits: [mOut.kind, gOut.kind] } };
}

function solo(seed, pose, subjects, ctx, at = {}) {
  const r = random(seed);
  const base = at.base || [0, 0, 0];
  const person = at.person || 1;
  const { specs, rng } = cast(seed, [sexOf(subjects[0], random((seed ^ 0x9e37) >>> 0))], subjects);
  const [spec] = specs;
  const run = pose === "run";
  const facing = at.facing || (run ? rotate([r.chance(0.5) ? 1 : -1, 0, 0], UP, r.range(-0.6, 0.6)) : rotate([0, 0, -1], UP, r.range(-0.6, 0.6)));
  const wind = run ? mul(facing, -0.9) : mul(norm([r.range(-1, 1), 0, r.range(-0.3, 1)]), r.range(0.2, 0.7));
  let p;
  if (pose === "sit") p = seated(spec, base, facing, { pitch: r.range(-0.1, 0.2) });
  else if (run) {
    const lead = r.chance(0.5) ? "L" : "R";
    const back = lead === "L" ? "R" : "L";
    p = { base, facing, lean: 0.3, tiptoe: 0.02, pitch: -0.1, legs: { [lead]: { forward: 0.3, lift: 0.04, wide: 0.08 }, [back]: { forward: -0.42, lift: 0.4, wide: 0.08 } } };
  } else p = { base, facing, legs: { L: { forward: 0.03, wide: 0.11 }, R: { forward: -0.03, wide: 0.11 } }, pitch: r.range(-0.25, 0.05) };
  let sk = skeleton(spec, p);
  if (pose === "sit") p.arms = { L: rest(sk, "L"), R: rest(sk, "R") };
  if (run) {
    const lead = p.legs.L.lift === 0.04 ? "L" : "R";
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
  const out = outfitFor(spec.sex, subjects[0], ctx, rng);
  const node = dressed(sk, person, out, rng, wind, random((seed ^ 0x5bd1e995) >>> 0), person === 1 ? MAT.hairA : MAT.hairB, hairFor(spec.sex, subjects[0], ctx, rng));
  return { nodes: [node], people: [sk], kiss: head(sk), wind, facing, choices: { outfits: [out.kind] } };
}

export function people(seed, pose, count = 2, subjects = [], setting = {}) {
  const ctx = context(setting, pose);
  if (pose === "embrace" && count === 2) {
    const sexes = [0, 1].map((i) => sexOf(subjects[i], random((seed ^ (0x9e37 + i * 977)) >>> 0)));
    const r = random((seed ^ 0x7a11) >>> 0);
    return couple(seed, { sexes, outfit: (sex, i) => outfitFor(sex, subjects[i], ctx, r), hair: sexes.map((sex, i) => hairFor(sex, subjects[i], ctx, r)) });
  }
  if (count === 1 || pose === "alone") return solo(seed, pose === "alone" || pose === "embrace" ? "stand" : pose, subjects, ctx);
  if (pose === "run") {
    const r = random(seed);
    const facing = rotate([r.chance(0.5) ? 1 : -1, 0, 0], UP, r.range(-0.7, 0.7));
    const side = norm(cross(facing, UP));
    const a = solo(seed, "run", [subjects[0]], ctx, { facing, person: 1 });
    const b = solo((seed ^ 0x2545f491) >>> 0, "run", [subjects[1]], ctx, { facing, person: 2, base: add(mul(facing, -r.range(0.4, 1.1)), mul(side, r.range(0.55, 0.8) * (r.chance(0.5) ? 1 : -1))) });
    return { nodes: [...a.nodes, ...b.nodes], people: [...a.people, ...b.people], kiss: lerp(a.kiss, b.kiss, 0.5), wind: a.wind, facing, choices: {} };
  }
  return pair(seed, pose, subjects, ctx);
}

export const focusOf = (scene) => scene.kiss;
export { toWorld };
