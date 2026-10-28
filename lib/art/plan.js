import { random } from "../random";
import { POSES } from "./people";
import { H, W } from "./world";

export const PLACES = ["sea", "lake", "river", "field", "mountains", "forest", "city", "desert", "snow", "road", "garden", "home"];
export const FEATURES = ["sun", "sunset", "moon", "stars", "trees", "mountains", "water", "buildings", "road", "birds", "dock", "pier", "house", "cabin", "flowers", "fireworks", "lamps", "waves", "footprints"];
export const TIMES = ["dawn", "day", "golden", "dusk", "night"];
export const WEATHER = ["clear", "cloud", "rain", "snow", "fog"];
export const MOODS = ["tender", "joyful", "nostalgic", "melancholy", "serene", "lonely", "electric", "epic"];
export const DIRECTIONS = ["expressive", "geometric", "organic", "lines"];
export const FOCUS = ["people", "place", "moment"];
export const GENDERS = ["unspecified", "woman", "man"];
export const AGES = ["unspecified", "child", "adult", "elder"];

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

const COLORS = { red: "#a8402c", auburn: "#8a3b22", ginger: "#c0612c", orange: "#de7a2e", yellow: "#e6b72f", gold: "#d9a73a", blonde: "#e2c27c", green: "#3f7a4a", teal: "#2f7f7d", blue: "#3b5ba5", navy: "#26346b", purple: "#7a4f9a", pink: "#e58fa8", white: "#efebe4", silver: "#c2c5cc", gray: "#86888d", grey: "#86888d", black: "#1f1d22", brown: "#6b4a2f", tan: "#b8935e", denim: "#4a6a95" };

export function colorIn(text) {
  const m = String(text || "").toLowerCase().match(new RegExp(`\\b(${Object.keys(COLORS).join("|")})\\b`));
  return m ? COLORS[m[1]] : "";
}

const GENDERED = /\b(her|she|hers|him|he|his|girlfriend|boyfriend|wife|husband|mom|mother|dad|father|sister|brother|grandma|grandmother|grandpa|grandfather|daughter|son|aunt|uncle|woman|women|man|men|girl|girls|boy|boys|lady|guy)\b/;

function honor(plan) {
  const t = ` ${plan.text.toLowerCase()} `;
  if (!t.trim()) return plan;
  const people = { ...plan.people, subjects: plan.people.subjects.map((x) => ({ ...x })) };
  const setting = { ...plan.setting, features: [...plan.setting.features] };
  const verb = /\b(rac(e|ed|ing)|run(ning)?|ran|sprint\w*|chas\w+)\b/.test(t) ? "run" : /\b(kiss\w*|hug\w*|embrac\w*|slow danc\w*)\b/.test(t) ? "embrace" : /\b(sit|sat|sitting)\b/.test(t) ? "sit" : /\b(walk\w*|stroll\w*)\b/.test(t) ? "walk" : "";
  const many = /\b(two|both|couple|we|us|together|me and|and i)\b/.test(t);
  if (verb && people.pose !== verb) {
    people.pose = verb;
    if (!people.count) people.count = verb === "embrace" ? 2 : 1;
    if (verb === "embrace") people.count = 2;
  }
  if (verb && plan.focus === "place") plan = { ...plan, focus: verb === "embrace" ? "people" : "moment" };
  if (many && people.count === 1 && verb !== "run") people.count = 2;
  while (people.subjects.length < people.count) people.subjects.push({ label: "someone", gender: "unspecified", age: "unspecified", hair: "", clothing: "", appearance: "" });
  people.subjects = people.subjects.slice(0, people.count);
  if (!GENDERED.test(t)) people.subjects.forEach((x) => (x.gender = "unspecified"));
  if (/\btwo (women|girls|ladies)\b/.test(t)) people.subjects.forEach((x) => (x.gender = "woman"));
  if (/\btwo (men|boys|guys)\b/.test(t)) people.subjects.forEach((x) => (x.gender = "man"));
  people.subjects.forEach((x) => {
    x.hairColor = colorIn(x.hair) || (/hair/.test(x.appearance) ? colorIn(x.appearance.split("hair")[0].split(/[,;]/).pop()) : "");
    x.clothColor = colorIn(x.clothing);
  });
  if (people.subjects.length && !people.subjects.some((x) => x.hair || x.clothing)) {
    const hair = t.match(/(\w+ )?(\w+) hair\b/);
    const wear = t.match(/\b(\w+ )?(\w+ )?(raincoat|coat|jacket|dress|sweater|hoodie|shirt|scarf|suit)\b/);
    const at = people.subjects.length > 1 && /\bone (with|in|wearing)\b/.test(t) ? people.subjects.length - 1 : 0;
    if (hair) Object.assign(people.subjects[at], { hair: hair[0], hairColor: colorIn(hair[0]) });
    if (wear) Object.assign(people.subjects[at], { clothing: wear[0], clothColor: colorIn(wear[0]) });
  }
  const tm = /\b(sunset|golden hour)\b/.test(t) ? "golden" : /\b(sunrise|dawn)\b/.test(t) ? "dawn" : /\b(night|midnight|new year'?s eve|fireworks|stars|starry)\b/.test(t) ? "night" : /\b(dusk|twilight)\b/.test(t) ? "dusk" : "";
  if (tm) setting.time = tm;
  const wx = /\brain(y|ing)?\b/.test(t) ? "rain" : /\bsnow(y|ing)?\b/.test(t) ? "snow" : /\b(fog|foggy|mist)\b/.test(t) ? "fog" : "";
  if (wx) setting.weather = wx;
  const add = (f, re) => re.test(t) && !setting.features.includes(f) && setting.features.push(f);
  add("fireworks", /\bfireworks?\b/);
  add("flowers", /\b(flowers?|bloom\w*|garden|roses|tulips)\b/);
  add("cabin", /\bcabin\b/);
  add("dock", /\b(dock|pier|jetty)\b/);
  add("sun", /\b(sunset|sunrise)\b/);
  add("moon", /\bmoon\w*\b/);
  add("stars", /\bstar(s|ry)\b/);
  if (/\b(beach|shore|coast|ocean|sea)\b/.test(t) && !["sea"].includes(setting.place)) setting.place = "sea";
  if (/\bgarden\b/.test(t)) setting.place = "garden";
  return { ...plan, people, setting };
}

export function normalizePlan(p = {}) {
  return honor(baseline(p));
}

function baseline(p = {}) {
  const s = p.setting || {};
  const people = p.people || {};
  const count = Math.max(0, Math.min(2, Math.round(Number(people.count) || 0)));
  const mood = pick(p.mood, MOODS, "tender");
  const dirs = (Array.isArray(p.directions) ? p.directions : []).filter((d) => DIRECTIONS.includes(d));
  const labels = (Array.isArray(people.labels) ? people.labels : []).map((l) => String(l).slice(0, 24)).filter(Boolean);
  const subjects = (Array.isArray(people.subjects) ? people.subjects : []).slice(0, 2).map((x = {}) => ({
    label: String(x.label || "").slice(0, 24),
    gender: pick(x.gender, GENDERS, "unspecified"),
    age: pick(x.age, AGES, "unspecified"),
    hair: String(x.hair || "").slice(0, 40),
    clothing: String(x.clothing || "").slice(0, 60),
    appearance: String(x.appearance || "").slice(0, 80),
    hairColor: /^#[0-9a-f]{6}$/i.test(x.hairColor || "") ? x.hairColor : "",
    clothColor: /^#[0-9a-f]{6}$/i.test(x.clothColor || "") ? x.clothColor : "",
  }));
  return {
    art: 1,
    mode: "2d",
    seed: Number.isInteger(p.seed) ? p.seed >>> 0 : Math.floor(Math.random() * 2 ** 31),
    avoid: (Array.isArray(p.avoid) ? p.avoid : []).filter((d) => DIRECTIONS.includes(d)).slice(0, 3),
    text: String(p.text || "").slice(0, 600),
    title: String(p.title || "").slice(0, 60),
    read: String(p.read || "").slice(0, 160),
    people: { count, pose: count ? pick(people.pose, POSES, "stand") : "none", relation: String(people.relation || "").slice(0, 30), labels: subjects.length ? subjects.map((x, i) => x.label || labels[i] || "someone").slice(0, count) : labels.length ? labels.slice(0, count) : Array.from({ length: count }, () => "someone"), subjects },
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

const WOMAN = /\b(her|she|girlfriend|wife|mom|mother|sister|grandma|grandmother|daughter|aunt|woman|girl)\b/;
const MAN = /\b(him|he|boyfriend|husband|dad|father|brother|grandpa|grandfather|son|uncle|man|boy)\b/;
const CHILD = /\b(son|daughter|kid|child|little (brother|sister)|baby)\b/;

function subjectsOf(t, count) {
  if (!count) return [];
  const both = /\btwo (women|girls)\b/.test(t) ? "woman" : /\btwo (men|boys)\b/.test(t) ? "man" : "";
  const other = both || (WOMAN.test(t) ? "woman" : MAN.test(t) ? "man" : "unspecified");
  const label = (t.match(/\b(my \w+|her|him)\b/) || [])[0] || "someone";
  if (count === 1) return [{ label: /\b(i|me|my)\b/.test(t) ? "me" : "someone", gender: both || "unspecified", age: "unspecified" }];
  const me = /\b(i|me|we|us)\b/.test(t);
  return [
    { label: me ? "me" : "someone", gender: both || "unspecified", age: "unspecified" },
    { label: both ? "someone" : label, gender: other, age: CHILD.test(t) ? "child" : "unspecified" },
  ];
}

export function readWords(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const two = has(t, /\b(we|us|our|together|two|couple|me and|and i|with (her|him|my)|girlfriend|boyfriend|wife|husband|partner|friend|brother|sister|mom|dad|grandma|grandpa)\b/);
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
  const n = placeFirst ? Math.min(count, 2) : count;
  return normalizePlan({ text, people: { count: n, pose: placeFirst ? "stand" : pose, subjects: subjectsOf(t, n) }, focus, setting: { place, features, time, weather }, mood, energy: pose === "run" ? 0.85 : 0.35 });
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
  const pose = plan.people.pose;
  const { place, features } = plan.setting;
  const skyward = features.some((f) => ["fireworks", "stars", "moon", "sunset", "sun"].includes(f));
  const grounded = ["garden", "field", "sea", "lake", "river", "snow", "desert", "road"].includes(place);
  const placeLayouts = place === "garden" ? [["high", 0.6], ["landscape", 0.4]] : place === "city" ? [["landscape", 0.55], ["low", 0.45]] : skyward && !grounded ? [["low", 0.45], ["landscape", 0.4], ["high", 0.15]] : grounded ? [["high", 0.45], ["landscape", 0.4], ["low", 0.15]] : [["landscape", 0.5], ["low", 0.35], ["high", 0.15]];
  const layouts = plan.focus === "place" ? placeLayouts : pose === "embrace" ? [["intimate", 0.35], ["landscape", 0.25], ["low", 0.2], ["edge", 0.2]] : plan.focus === "moment" ? [["low", 0.3], ["high", 0.25], ["landscape", 0.3], ["edge", 0.15]] : [["landscape", 0.35], ["low", 0.25], ["high", 0.15], ["edge", 0.25]];
  let layout = framing === "close" ? (rand.chance(0.6) ? "intimate" : "edge") : weighted(rand, layouts.map((l) => l[0]), layouts.map((l) => l[1]));
  if (layout === "high" && place === "city") layout = "landscape";
  const bigSky = rand.chance(0.5);
  const base = framing === "close" ? rand.range(0.5, 0.72) : framing === "medium" ? rand.range(0.42, 0.66) : framing === "none" || framing === "vast" ? (bigSky ? rand.range(0.64, 0.8) : rand.range(0.3, 0.44)) : rand.range(0.4, 0.68);
  const horizon = H * (layout === "intimate" ? 1.12 : layout === "low" ? rand.range(0.78, 0.88) : layout === "high" ? rand.range(0.14, 0.3) : base);
  const center = layout !== "edge" && rand.chance(framing === "close" ? 0.35 : 0.15);
  const focusX = W * (layout === "edge" ? rand.pick([0.17, 0.83]) : center ? rand.range(0.45, 0.55) : rand.pick([0.3, 0.36, 0.64, 0.7]) + rand.range(-0.04, 0.04));
  const fit = layout === "intimate" && (framing === "wide" || framing === "vast") ? "medium" : framing;
  let body = H * { close: rand.range(2.1, 2.7), medium: rand.range(1.35, 1.7), wide: rand.range(0.55, 0.8), vast: rand.range(0.1, 0.2), none: 0 }[fit];
  let feet = null;
  if (fit === "close" || fit === "medium") feet = H * (fit === "close" ? rand.range(0.03, 0.14) : rand.range(0.06, 0.22)) + body;
  else if (fit === "wide") {
    feet = H * rand.range(0.74, 0.96);
    if (layout !== "intimate") feet = Math.max(feet, horizon + H * 0.04);
    body = Math.min(body, feet - H * 0.05);
  } else if (fit === "vast") feet = horizon + rand.range(0.5, 0.9) * body;
  const behind = plan.focus === "people" && (fit === "wide" || fit === "vast") && rand.chance(0.6);
  const lightX = behind ? focusX + (rand.chance(0.5) ? 1 : -1) * (body * 0.32 + H * 0.12) : W * (focusX < W / 2 ? rand.range(0.66, 0.85) : rand.range(0.15, 0.34));
  return {
    seed,
    direction,
    framing: fit,
    layout,
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
