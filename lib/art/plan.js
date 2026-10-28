import { random } from "../random";
import { POSES } from "./people";
import { H, W } from "./world";

export const PLACES = ["sea", "lake", "river", "field", "mountains", "forest", "city", "desert", "snow", "road", "garden", "home"];
export const FEATURES = ["sun", "sunset", "moon", "stars", "trees", "mountains", "water", "buildings", "road", "birds", "dock", "pier", "house", "cabin"];
export const TIMES = ["dawn", "day", "golden", "dusk", "night"];
export const WEATHER = ["clear", "cloud", "rain", "snow", "fog"];
export const MOODS = ["tender", "joyful", "nostalgic", "melancholy", "serene", "lonely", "electric", "epic"];
export const DIRECTIONS = ["expressive", "geometric", "organic", "lines"];
export const FOCUS = ["people", "place", "moment"];

const BY_MOOD = {
  tender: ["expressive", "organic", "lines", "geometric"],
  joyful: ["geometric", "expressive", "lines", "organic"],
  nostalgic: ["lines", "expressive", "organic", "geometric"],
  melancholy: ["organic", "lines", "expressive", "geometric"],
  serene: ["lines", "geometric", "expressive", "organic"],
  lonely: ["organic", "lines", "geometric", "expressive"],
  electric: ["geometric", "organic", "expressive", "lines"],
  epic: ["expressive", "geometric", "organic", "lines"],
};

const pick = (v, list, d) => (list.includes(v) ? v : d);

export function normalizePlan(p = {}) {
  const s = p.setting || {};
  const people = p.people || {};
  const count = Math.max(0, Math.min(2, Math.round(Number(people.count) || 0)));
  const mood = pick(p.mood, MOODS, "tender");
  const dirs = (Array.isArray(p.directions) ? p.directions : []).filter((d) => DIRECTIONS.includes(d));
  const labels = (Array.isArray(people.labels) ? people.labels : []).map((l) => String(l).slice(0, 24)).filter(Boolean);
  return {
    art: 1,
    mode: "2d",
    seed: Number.isInteger(p.seed) ? p.seed >>> 0 : Math.floor(Math.random() * 2 ** 31),
    avoid: (Array.isArray(p.avoid) ? p.avoid : []).filter((d) => DIRECTIONS.includes(d)).slice(0, 3),
    text: String(p.text || "").slice(0, 600),
    title: String(p.title || "").slice(0, 60),
    read: String(p.read || "").slice(0, 160),
    people: { count, pose: count ? pick(people.pose, POSES, "stand") : "none", relation: String(people.relation || "").slice(0, 30), labels: labels.length ? labels.slice(0, count) : count === 2 ? ["me", "them"] : count ? ["me"] : [] },
    focus: count ? pick(p.focus, FOCUS, "people") : "place",
    setting: {
      place: pick(s.place, PLACES, "field"),
      features: (Array.isArray(s.features) ? s.features : []).filter((f) => FEATURES.includes(f)),
      time: pick(s.time, TIMES, "golden"),
      weather: pick(s.weather, WEATHER, "clear"),
    },
    mood,
    energy: Math.min(1, Math.max(0, Number(p.energy) || 0.4)),
    directions: [...new Set([...dirs, ...BY_MOOD[mood]])],
  };
}

const has = (t, re) => re.test(t);

export function readWords(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const two = has(t, /\b(we|us|our|together|me and|and i|with (her|him|my)|girlfriend|boyfriend|wife|husband|partner|friend|brother|sister|mom|dad|grandma|grandpa)\b/);
  const one = has(t, /\b(i|me|my|myself)\b/) && !has(t, /\b(grandparents'|cabin|lake|house|home)\b.*\b(summer|every|always)\b/);
  const pose = has(t, /\b(run|ran|running|race|racing|sprint|chas)/) ? "run" : has(t, /\b(walk|walking|stroll)/) ? "walk" : has(t, /\b(kiss|hug|embrace|dance|danc|slow dance)/) ? "embrace" : has(t, /\b(sit|sat|sitting|watch|watching|looking)/) ? "sit" : "stand";
  const count = pose === "run" && !two ? 1 : two ? 2 : one && !has(t, /\b(place|lake|cabin|mountain|house)\b/) ? 1 : 0;
  const place = has(t, /\b(sea|ocean|beach|shore|coast)/) ? "sea" : has(t, /\blake\b/) ? "lake" : has(t, /\briver\b/) ? "river" : has(t, /\b(mountain|peak|alps|valley)/) ? "mountains" : has(t, /\b(forest|woods|trees)/) ? "forest" : has(t, /\b(city|street|downtown|rooftop|subway|skyline)/) ? "city" : has(t, /\bdesert\b/) ? "desert" : has(t, /\b(snow|winter)/) ? "snow" : has(t, /\b(road|drive|highway|trip)/) ? "road" : has(t, /\bgarden\b/) ? "garden" : has(t, /\b(home|house|backyard|porch)/) ? "home" : "field";
  const time = has(t, /\b(sunset|golden hour|evening sun)/) ? "golden" : has(t, /\b(dusk|twilight)/) ? "dusk" : has(t, /\b(sunrise|dawn|morning)/) ? "dawn" : has(t, /\b(night|stars|moon|midnight|late)/) ? "night" : "day";
  const weather = has(t, /\brain/) ? "rain" : has(t, /\bsnow/) ? "snow" : has(t, /\b(fog|mist)/) ? "fog" : "clear";
  const features = FEATURES.filter((f) => has(t, new RegExp(`\\b${f}`)));
  if (time === "golden" || time === "dawn") features.push("sun");
  if (has(t, /\bcabin\b/)) features.push("cabin", "trees");
  const mood = pose === "run" ? "joyful" : has(t, /\b(alone|lonely|last|goodbye|miss)/) ? "melancholy" : has(t, /\b(childhood|grandparents|summers|every summer|used to|grew up)/) ? "nostalgic" : two ? "tender" : "serene";
  const placeFirst = /^\s*(the|our|my)\s+(old\s+)?(lake|beach|cabin|house|home|mountain|field|garden|street|city|road|river|forest|backyard|porch)/.test(String(text).toLowerCase());
  const focus = count === 0 || placeFirst ? "place" : pose === "run" || pose === "walk" ? "moment" : "people";
  return normalizePlan({ text, people: { count: placeFirst ? Math.min(count, 2) : count, pose: placeFirst ? "stand" : pose }, focus, setting: { place, features, time, weather }, mood, energy: pose === "run" ? 0.85 : 0.35 });
}

const weighted = (rand, list, weights) => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
  return list[list.length - 1];
};

export function composition(plan, seed) {
  const rand = random((Math.imul(seed, 2246822519) ^ 0x7f4a7c15) >>> 0);
  const open = plan.directions.filter((d) => !plan.avoid?.includes(d));
  const direction = weighted(rand, open.length ? open : plan.directions, [0.36, 0.28, 0.2, 0.16]);
  const framing = plan.people.count === 0 ? "none" : plan.focus === "people" ? weighted(rand, ["close", "medium", "wide", "vast"], plan.people.pose === "sit" || plan.people.pose === "stand" ? [0, 0.4, 0.45, 0.15] : [0.3, 0.33, 0.27, 0.1]) : plan.focus === "moment" ? weighted(rand, ["medium", "wide"], [0.4, 0.6]) : weighted(rand, ["vast", "none"], [0.55, 0.45]);
  const bigSky = rand.chance(0.5);
  const horizon = H * (framing === "close" ? rand.range(0.5, 0.72) : framing === "medium" ? rand.range(0.42, 0.66) : framing === "none" || framing === "vast" ? (bigSky ? rand.range(0.64, 0.8) : rand.range(0.3, 0.44)) : rand.range(0.4, 0.68));
  const center = rand.chance(framing === "close" ? 0.35 : 0.15);
  const focusX = W * (center ? rand.range(0.45, 0.55) : rand.pick([0.3, 0.36, 0.64, 0.7]) + rand.range(-0.04, 0.04));
  const body = H * { close: rand.range(2.1, 2.7), medium: rand.range(1.35, 1.7), wide: rand.range(0.55, 0.8), vast: rand.range(0.1, 0.2), none: 0 }[framing];
  const level = { close: rand.range(0.84, 0.92), medium: rand.range(0.72, 0.86), wide: rand.range(0.55, 0.85), vast: rand.range(0.5, 0.9), none: 0 }[framing];
  const feet = framing === "none" ? null : horizon + level * body;
  const behind = plan.focus === "people" && (framing === "wide" || framing === "vast") && rand.chance(0.6);
  const lightX = behind ? focusX + (rand.chance(0.5) ? 1 : -1) * (body * 0.32 + H * 0.12) : W * (focusX < W / 2 ? rand.range(0.66, 0.85) : rand.range(0.15, 0.34));
  return {
    seed,
    direction,
    framing,
    horizon,
    focusX,
    body,
    feet,
    lightX: Math.min(W * 0.88, Math.max(W * 0.12, lightX)),
    shore: rand.range(0.18, 0.55),
    vanish: focusX + W * rand.range(-0.15, 0.15),
    roadSpread: rand.range(0.9, 1.8),
    density: rand.range(0.7, 1.15),
  };
}

const BUILDS = {
  expressive: ["thousands of brush strokes, each laid along the way light and fabric fall", "the sky is built from layered washes, the ground from strokes that follow its grain"],
  geometric: ["the figures are triangulated into flat planes lit by their own shading", "the world is cut into faceted terrain, banded light and solid blocks"],
  organic: ["the figures become textured silhouettes with light growing through them", "the land is built from mottled strata and contour lines, the trees from recursive branching"],
  lines: ["every value is an engraved line whose width carries the light", "the figures are drawn stroke by stroke from their 3D form"],
};

export function withView(plan, direction) {
  const ids = plan.people.labels.map((l, i) => `${l.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "p"}-${i}`);
  const subjects = plan.people.labels.map((label, i) => ({ id: ids[i], label }));
  const { place, time, weather, features } = plan.setting;
  const builds = BUILDS[direction] || BUILDS.lines;
  return {
    ...plan,
    title: plan.title || plan.text.split(/\s+/).slice(0, 4).join(" ").toLowerCase(),
    read: plan.read || `${subjects.length ? subjects.map((s) => s.label).join(" and ") + ", " : ""}${place}, ${time}`,
    subjects,
    relations: ids.length > 1 ? [{ a: ids[0], rel: plan.people.pose === "sit" || plan.people.pose === "stand" ? "beside" : "with", b: ids[1] }] : [],
    world: { setting: place, time, season: "none", weather, energy: plan.energy },
    lights: features.includes("moon") || time === "night" ? [{ kind: "moon" }] : features.includes("sun") ? [{ kind: "sun" }] : [],
    particles: weather === "rain" || weather === "snow" ? [{ kind: weather, motion: "fall" }] : [],
    systems: [...subjects.slice(0, 1).map((s) => ({ subject: s.id, why: builds[0] })), { subject: "world", why: builds[1] }],
    missing: [],
  };
}
