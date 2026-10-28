export const KINDS = ["creature", "person", "object", "plant", "structure", "planet", "abstract"];
export const FORMS = ["building", "vehicle", "tree", "planet", "parts"];
export const SPECIES = ["dog", "wolf", "fox", "cat", "lion", "tiger", "horse", "deer", "bear", "cow", "rabbit", "other"];
export const MATERIALS = ["fur", "feathers", "skin", "fabric", "smooth", "stone", "metal", "glass", "wood", "foliage", "light"];
export const POSES = ["stand", "walk", "run", "sit", "lie", "embrace", "kiss", "hold"];
export const MOTIONS = ["still", "breathe", "sway", "run", "spin", "orbit", "flicker"];
export const SHAPES = ["ellipsoid", "capsule", "box", "cylinder", "cone", "torus", "sweep", "lathe"];
export const RELS = ["on", "under", "beside", "behind", "front", "inside", "around", "holding", "facing", "near", "far", "above", "with"];
export const VIEWS = ["outside", "first-person", "aerial", "close", "wide", "low"];
export const LOOKS = ["at", "down", "up", "ahead"];
export const SETTINGS = ["void", "ground", "meadow", "forest", "snowfield", "city", "ocean", "desert", "mountains", "space"];
export const TIMES = ["dawn", "day", "golden", "dusk", "night"];
export const SEASONS = ["none", "spring", "summer", "fall", "winter"];
export const WEATHER = ["clear", "wind", "rain", "snow", "storm", "fog"];
export const TEMPS = ["cold", "mild", "warm"];
export const LIGHTS = ["sun", "moon", "streetlight", "lamp", "fire", "beam", "glow", "window"];
export const PARTICLES = ["leaves", "snow", "rain", "petals", "dust", "sparks", "fireflies", "embers", "spray", "bubbles"];
export const DRIFTS = ["fall", "drift", "swirl", "rise"];
export const MOODS = ["calm", "tender", "nostalgic", "joyful", "melancholy", "tense", "epic", "mysterious", "serene", "playful"];
export const STYLES = ["auto", "pixel", "line", "cells"];
export const LANGUAGES = ["structure", "machine", "swarm", "filaments", "contours", "slices", "branches", "strata", "waves", "field"];
export const BUILDINGS = ["mansion", "house", "cottage", "cabin", "farmhouse", "modern", "castle", "church", "cathedral", "skyscraper", "tower", "lighthouse", "barn", "temple", "pagoda", "bridge", "windmill"];
export const VEHICLE_TYPES = ["sedan", "coupe", "sports", "hatchback", "suv", "jeep", "pickup", "van", "limousine", "vintage", "race", "bus", "truck", "train", "boat", "sailboat"];

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);
const hex = (value) => (HEX.test(value || "") ? value.toLowerCase() : "");
const num = (value, lo, hi, fallback) => (Number.isFinite(Number(value)) ? Math.min(hi, Math.max(lo, Number(value))) : fallback);
const text = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const vec = (value, fallback = [0, 0, 0], lo = -500, hi = 500) => [0, 1, 2].map((i) => num(value?.[i], lo, hi, fallback[i]));
const slug = (value) => text(value, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "thing";

function part(p = {}) {
  return {
    name: text(p.name, 30),
    shape: pick(p.shape, SHAPES, "ellipsoid"),
    a: vec(p.a),
    b: vec(p.b, [0.1, 0.1, 0.1]),
    r: [num(p.r?.[0], 0, 200, 0.05), num(p.r?.[1], 0, 200, num(p.r?.[0], 0, 200, 0.05))],
    rot: vec(p.rot, [0, 0, 0], -360, 360),
    path: (Array.isArray(p.path) ? p.path : []).slice(0, 10).map((q) => vec(q)),
    radii: (Array.isArray(p.radii) ? p.radii : []).slice(0, 10).map((r) => num(r, 0, 200, 0.05)),
    profile: (Array.isArray(p.profile) ? p.profile : []).slice(0, 16).map((q) => [num(q?.[0], 0, 200, 0.1), num(q?.[1], -500, 500, 0)]),
    color: hex(p.color),
    blend: num(p.blend, 0, 50, 0),
    cut: Boolean(p.cut),
  };
}

function subject(s = {}, index) {
  const form = pick(s.form, FORMS, "parts");
  const kind = pick(s.kind, KINDS, form === "building" ? "structure" : form === "tree" ? "plant" : form === "planet" ? "planet" : "object");
  const traits = {};
  for (const [key, value] of Object.entries(s.traits || {})) if (Number.isFinite(Number(value))) traits[slug(key)] = num(value, 0, 1, 0.5);
  return {
    id: slug(s.id || s.label || `${kind}-${index + 1}`),
    label: text(s.label || s.id || kind, 60),
    kind,
    form,
    species: pick(s.species, SPECIES, "other"),
    pose: pick(s.pose, POSES, "stand"),
    material: pick(s.material, MATERIALS, form === "building" ? "stone" : form === "vehicle" ? "metal" : form === "tree" ? "wood" : "smooth"),
    colors: (Array.isArray(s.colors) ? s.colors : []).map(hex).filter(Boolean).slice(0, 5),
    size: num(s.size, 0.02, 20000, form === "tree" ? 9 : 1),
    count: Math.round(num(s.count, 1, 12, 1)),
    motion: pick(s.motion, MOTIONS, "still"),
    traits,
    hair: { color: hex(s.hair?.color), length: pick(s.hair?.length, ["none", "short", "medium", "long", "bun"], "") },
    wiki: text(s.wiki, 80),
    building: form === "building" ? { style: pick(s.building?.style, BUILDINGS, ""), floors: Math.round(num(s.building?.floors, 0, 120, 0)), width: num(s.building?.width, 0, 400, 0), roof: pick(s.building?.roof, ["auto", "gable", "hip", "flat", "mansard", "dome", "spire", "gambrel"], "auto"), wings: Math.round(num(s.building?.wings, 0, 2, 2)), towers: Math.round(num(s.building?.towers, 0, 4, 0)), columns: s.building?.columns !== false, rails: Boolean(s.building?.rails), note: text(s.building?.note, 60) } : null,
    vehicle: form === "vehicle" ? { type: pick(s.vehicle?.type, VEHICLE_TYPES, "") } : null,
    parts: form === "parts" ? (Array.isArray(s.parts) ? s.parts : []).slice(0, 40).map(part) : [],
  };
}

function unique(subjects) {
  const seen = new Map();
  return subjects.map((s) => {
    const n = seen.get(s.id) || 0;
    seen.set(s.id, n + 1);
    return n ? { ...s, id: `${s.id}-${n + 1}` } : s;
  });
}

export function languageFor(s) {
  if (s.form === "building") return "structure";
  if (s.form === "vehicle") return "machine";
  if (s.form === "planet") return "strata";
  if (s.form === "tree") return "branches";
  if (s.material === "fur" || s.material === "feathers") return "filaments";
  if (s.form === "human") return "swarm";
  if (s.material === "stone" || s.material === "wood" || s.material === "metal" || s.kind === "structure") return "slices";
  return "contours";
}

const WHY = {
  structure: (s) => `${s.label}: its lines draw themselves, then it fills in from the ground up`,
  machine: (s) => `${s.label}: the body is drawn in profile lines, then filled with a grain of particles`,
  filaments: (s) => `${s.label}: fur becomes thousands of filaments that follow the body's flow`,
  swarm: (s) => `${s.label}: a swarm of particles settles into the form`,
  contours: (s) => `${s.label}: the surface is traced in contour rings`,
  slices: (s) => `${s.label}: the structure rises section by section`,
  branches: (s) => `${s.label}: branches grow and split recursively`,
  strata: (s) => `${s.label}: layered shells of crust, ocean, cloud and air`,
  waves: () => "water: wave lines interfere and propagate",
  field: () => "air: particles ride a vector field",
};

function reference(r) {
  if (!r || typeof r.src !== "string" || !r.src.startsWith("/api/image?u=")) return null;
  return {
    src: r.src.slice(0, 600),
    width: num(r.width, 1, 20000, 1024),
    height: num(r.height, 1, 20000, 768),
    via: text(r.via, 20),
    credit: { title: text(r.credit?.title, 120), author: text(r.credit?.author, 120), license: text(r.credit?.license, 60), url: /^https:\/\/([a-z]+\.)?(wikipedia|wikimedia)\.org\//.test(String(r.credit?.url || "")) ? String(r.credit.url).slice(0, 400) : "" },
  };
}

export function normalizePlan(input = {}) {
  const style = pick(input.style, STYLES, "auto");
  const subjects = unique((Array.isArray(input.subjects) ? input.subjects : []).slice(0, 6).map(subject));
  const ids = new Set(subjects.map((s) => s.id));
  const ref = (id) => (ids.has(slug(id)) ? slug(id) : "");
  const relations = (Array.isArray(input.relations) ? input.relations : [])
    .map((r) => ({ a: ref(r?.a), rel: pick(r?.rel, RELS, "near"), b: ref(r?.b) }))
    .filter((r) => r.a && r.b && r.a !== r.b)
    .slice(0, 12);
  const given = new Map((Array.isArray(input.systems) ? input.systems : []).map((x) => [ref(x?.subject) || slug(x?.subject), x]));
  const systems = subjects.map((s) => {
    const language = languageFor(s);
    const why = text(given.get(s.id)?.why, 140);
    return { subject: s.id, language, why: why || WHY[language](s) };
  });
  const world = input.world || {};
  const setting = pick(world.setting, SETTINGS, "void");
  if (setting === "ocean") systems.push({ subject: "world", language: "waves", why: text(given.get("world")?.why, 140) || WHY.waves() });
  const palette = input.palette || {};
  const view = input.view || {};
  return {
    v: 1,
    seed: Number.isInteger(input.seed) ? input.seed >>> 0 : Math.floor(Math.random() * 2 ** 31),
    mode: input.mode === "2d" ? "2d" : "3d",
    text: text(input.text, 600),
    title: text(input.title, 60) || subjects[0]?.label || "untitled",
    read: text(input.read, 160),
    style,
    subjects,
    relations,
    view: { kind: pick(view.kind, VIEWS, "outside"), from: ref(view.from), at: ref(view.at), look: pick(view.look, LOOKS, "at") },
    world: {
      setting,
      time: pick(world.time, TIMES, "night"),
      season: pick(world.season, SEASONS, "none"),
      weather: pick(world.weather, WEATHER, "clear"),
      temperature: pick(world.temperature, TEMPS, "mild"),
      energy: num(world.energy, 0, 1, 0.35),
    },
    lights: (Array.isArray(input.lights) ? input.lights : []).slice(0, 4).map((l) => ({ kind: pick(l?.kind, LIGHTS, "glow"), at: ref(l?.at), color: hex(l?.color) })),
    particles: (Array.isArray(input.particles) ? input.particles : [])
      .slice(0, 3)
      .map((p) => ({ kind: pick(p?.kind, PARTICLES, "dust"), color: hex(p?.color), amount: num(p?.amount, 0, 1, 0.5), motion: pick(p?.motion, DRIFTS, "fall") })),
    palette: {
      background: hex(palette.background),
      ink: hex(palette.ink),
      colors: (Array.isArray(palette.colors) ? palette.colors : []).map(hex).filter(Boolean).slice(0, 6),
      accent: hex(palette.accent),
    },
    mood: pick(input.mood, MOODS, "calm"),
    systems,
    search: text(input.search, 120),
    reference: reference(input.reference),
  };
}
