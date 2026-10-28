import { normalizePlan } from "./plan";
import { PRESETS } from "./presets";

const ANIMALS = {
  wolf: ["wolf", "wolves", "husky"],
  dog: ["dog", "dogs", "puppy", "pup", "doggo", "hound", "retriever", "labrador", "corgi", "shepherd"],
  fox: ["fox", "foxes"],
  cat: ["cat", "cats", "kitten", "kitty"],
  lion: ["lion", "lioness"],
  tiger: ["tiger"],
  horse: ["horse", "pony", "stallion", "mare", "foal"],
  deer: ["deer", "stag", "fawn", "elk", "reindeer", "moose"],
  bear: ["bear", "grizzly"],
  cow: ["cow", "cattle", "bull"],
  rabbit: ["rabbit", "bunny", "hare"],
};
const OBJECTS = { banana: ["banana"], apple: ["apple"], lighthouse: ["lighthouse"], streetlight: ["streetlight", "street light", "lamp post", "lamppost", "streetlamp", "street lamp"], mug: ["mug", "cup of coffee", "coffee cup", "teacup"] };
const PEOPLE = ["girlfriend", "boyfriend", "wife", "husband", "mom", "mother", "dad", "father", "friend", "sister", "brother", "girl", "boy", "man", "woman", "person", "kid", "child", "son", "daughter", "grandma", "grandpa", "partner", "lover"];
const COLORS = {
  red: "#b5352d", crimson: "#9e1f2b", pink: "#e290ab", orange: "#df7a3a", amber: "#e09a2e", yellow: "#e6c34a", gold: "#c8a13f", green: "#4d8748",
  "dark green": "#2f4a33", olive: "#6b6b34", teal: "#2e8584", blue: "#4170ad", "deep blue": "#1f3a78", "electric blue": "#2f6df6", navy: "#25375c",
  violet: "#6f4ea8", purple: "#6c4b98", lavender: "#a99bd6", brown: "#6e4a2f", black: "#1c1b1a", white: "#f1eee6", silver: "#c4c6c9", gray: "#8a8780", grey: "#8a8780", cream: "#e8dbbd",
};
const GARMENTS = ["jacket", "hoodie", "coat", "dress", "shirt", "sweater", "scarf", "hat", "skirt", "suit"];

const has = (text, words) => words.some((w) => new RegExp(`\\b${w}\\b`).test(text));
const first = (text, words) => words.map((w) => ({ w, i: text.search(new RegExp(`\\b${w}\\b`)) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0];

function colorsIn(text) {
  const found = [];
  for (const [name, hex] of Object.entries(COLORS).sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`\\b${name}\\b`, "g");
    let m;
    while ((m = re.exec(text))) if (!found.some((f) => f.at === m.index || (m.index > f.at && m.index < f.at + f.name.length))) found.push({ name, hex, at: m.index });
  }
  return found.sort((a, b) => a.at - b.at);
}

export function readPlan(raw, mode = "3d", seed) {
  const text = ` ${String(raw || "").toLowerCase().replace(/[’']/g, "'")} `;
  const subjects = [];
  const colors = colorsIn(text);
  const near = (at) => colors.filter((c) => Math.abs(c.at - at) < 28).map((c) => c.hex);

  for (const [species, words] of Object.entries(ANIMALS)) {
    const hit = first(text, words);
    if (!hit) continue;
    const pose = /\b(run|running|ran|sprint|chasing|gallop)/.test(text) ? "run" : /\b(sit|sitting|sat)\b/.test(text) ? "sit" : /\b(lying|lie|sleeping|asleep|curled)\b/.test(text) ? "lie" : /\b(walk|walking)\b/.test(text) ? "walk" : "stand";
    subjects.push({ id: species, label: hit.w, form: "quadruped", species, kind: "creature", pose, material: "fur", colors: near(hit.i) });
  }
  for (const [key, words] of Object.entries(OBJECTS)) {
    const hit = first(text, words);
    if (!hit) continue;
    const preset = PRESETS[key];
    const tint = near(hit.i);
    subjects.push({ ...preset, id: key, colors: tint.length ? tint : preset.colors, parts: preset.parts.map((p, i) => (i === 0 && tint[0] ? { ...p, color: tint[0] } : p)) });
  }
  const others = PEOPLE.filter((w) => has(text, [w]));
  const speaker = /\b(i|me|my|we|us|our)\b/.test(text);
  const couple = /\b(kiss|kissed|kissing|couple|hug|hugged|embrace|together|date)\b/.test(text);
  const viewpointOnly = /\b(top of|looking down|look down|view from|standing on)\b/.test(text);
  let people = Math.min(4, others.length + (speaker && (others.length || couple) ? 1 : 0));
  if (couple) people = Math.max(people, 2);
  if (!people && others.length) people = 1;
  if (viewpointOnly && !couple && !others.length) people = 0;
  const garments = GARMENTS.map((g) => ({ g, i: text.search(new RegExp(`\\b${g}\\b`)) })).filter((x) => x.i >= 0);
  for (let k = 0; k < people; k++) {
    const g = garments[k];
    const tint = g ? colorsIn(text.slice(Math.max(0, g.i - 24), g.i)).map((c) => c.hex) : [];
    subjects.push({ id: `person-${k + 1}`, label: k === 0 && speaker ? "me" : others[k - (speaker ? 1 : 0)] || "person", form: "human", kind: "person", pose: couple ? (/\bkiss/.test(text) ? "kiss" : "embrace") : "stand", material: "fabric", colors: tint, size: 1.72 - k * 0.08 });
  }
  if (has(text, ["tree", "oak", "maple", "willow", "cherry blossom", "sakura"]) && !has(text, ["forest", "woods"])) subjects.push({ id: "tree", label: "tree", form: "tree", kind: "plant", material: "wood", size: 9 });
  if (has(text, ["earth", "planet", "mars", "jupiter", "saturn", "world from space"])) {
    const type = has(text, ["mars"]) ? "mars" : has(text, ["jupiter", "saturn"]) ? "gas" : "earth";
    subjects.unshift({ id: "planet", label: type === "earth" ? "earth" : type, form: "planet", kind: "planet", material: "stone", size: 1, traits: { gas: type === "gas" ? 1 : 0, ocean: type === "earth" ? 0.7 : 0 }, colors: colors.map((c) => c.hex) });
  }

  const setting = subjects.some((s) => s.form === "planet")
    ? "space"
    : has(text, ["ocean", "sea", "waves", "beach", "coast", "shore"]) || subjects.some((s) => s.id === "lighthouse")
      ? "ocean"
      : has(text, ["forest", "woods", "trees"])
        ? "forest"
        : has(text, ["snow", "snowy", "snowfield", "tundra"])
          ? "snowfield"
          : has(text, ["city", "street", "downtown", "rooftop", "alley", "sidewalk"]) || subjects.some((s) => s.id === "streetlight")
            ? "city"
            : has(text, ["desert", "dunes"])
              ? "desert"
              : has(text, ["mountain", "mountains", "peak", "cliff"])
                ? "mountains"
                : has(text, ["meadow", "field", "park", "garden", "grass"])
                  ? "meadow"
                  : subjects.length === 1 && subjects[0].form === "parts"
                    ? "void"
                    : "ground";
  const hour = text.match(/\b(\d{1,2})\s*(pm|am)\b/);
  const pm = hour && hour[2] === "pm" ? Number(hour[1]) : null;
  const time = has(text, ["night", "midnight", "stars", "moon", "moonlight", "dark"]) || (pm && pm >= 8 && pm !== 12)
    ? "night"
    : has(text, ["sunset", "dusk", "twilight", "evening"]) || (pm && pm >= 6)
      ? "dusk"
      : has(text, ["sunrise", "dawn", "morning"])
        ? "dawn"
        : has(text, ["golden hour", "golden"])
          ? "golden"
          : setting === "space" || setting === "void"
            ? "night"
            : "day";
  const season = has(text, ["fall", "autumn"]) ? "fall" : has(text, ["winter"]) || setting === "snowfield" ? "winter" : has(text, ["spring", "blossom"]) ? "spring" : has(text, ["summer"]) ? "summer" : "none";
  const weather = has(text, ["storm", "stormy", "thunder", "lightning", "hurricane"]) ? "storm" : has(text, ["rain", "raining", "rainy"]) ? "rain" : has(text, ["snowing", "snowfall", "snowflakes", "snowy", "snow"]) ? "snow" : has(text, ["fog", "foggy", "mist", "misty"]) ? "fog" : has(text, ["wind", "windy", "breeze"]) ? "wind" : "clear";
  const particles = [];
  if (season === "fall" || has(text, ["leaves"])) particles.push({ kind: "leaves", color: colors.find((c) => ["orange", "red", "amber", "gold", "yellow"].includes(c.name))?.hex || "#d4692c", amount: 0.6, motion: "fall" });
  if (weather === "snow" || setting === "snowfield") particles.push({ kind: "snow", color: "#f1f0ec", amount: 0.6, motion: "fall" });
  if (weather === "rain" || weather === "storm") particles.push({ kind: "rain", color: "#b9c4cf", amount: weather === "storm" ? 0.9 : 0.5, motion: "fall" });
  if (has(text, ["fireflies", "firefly"])) particles.push({ kind: "fireflies", color: "#f4d27a", amount: 0.5, motion: "drift" });
  if (has(text, ["petals", "cherry blossom", "sakura"])) particles.push({ kind: "petals", color: "#efb7c6", amount: 0.5, motion: "drift" });

  const lights = [];
  if (subjects.some((s) => s.id === "streetlight")) lights.push({ kind: "streetlight", at: "streetlight", color: "#f2c879" });
  if (subjects.some((s) => s.id === "lighthouse") && time !== "day") lights.push({ kind: "beam", at: "lighthouse", color: "#f6e7b5" });
  if (time === "night" && setting !== "space") lights.push({ kind: "moon", color: "#c9d3e6" });

  let view = { kind: "outside" };
  const top = text.match(/\b(?:top of|on top of|from the top of|standing on)\s+(?:a |an |the |my )?([a-z]+)/);
  if (top) {
    const from = subjects.find((s) => s.id.startsWith(top[1]) || s.label === top[1]);
    if (from) view = { kind: "first-person", from: from.id, look: /looking down|look down|below/.test(text) ? "down" : "ahead" };
  } else if (/\b(aerial|bird's eye|from above|overhead)\b/.test(text)) view = { kind: "aerial" };
  else if (/\b(close up|closeup|close-up|macro)\b/.test(text)) view = { kind: "close" };

  const relations = [];
  const ids = subjects.map((s) => s.id);
  if (/\b(under|underneath|beneath|below)\b/.test(text)) {
    const lamp = ids.find((id) => ["streetlight", "tree", "lighthouse"].includes(id));
    for (const id of ids) if (id !== lamp && lamp && id.startsWith("person")) relations.push({ a: id, rel: "under", b: lamp });
  }
  if (ids.filter((id) => id.startsWith("person")).length >= 2) relations.push({ a: "person-1", rel: couple ? "facing" : "beside", b: "person-2" });

  const style = /\b(8-bit|8 bit|16-bit|16 bit|pixel|pixels|pixel art|retro game)\b/.test(text) ? "pixel" : /\b(line art|sketch|drawing|pen)\b/.test(text) ? "line" : /\b(mosaic|stained glass|voronoi)\b/.test(text) ? "cells" : "auto";
  const mood = couple ? "tender" : weather === "storm" ? "epic" : time === "night" ? "mysterious" : season === "fall" ? "nostalgic" : "calm";
  const cold = /\b(cold|freezing|chilly|winter|snow|icy)\b/.test(text);
  const label = subjects[0]?.label || (setting !== "void" ? setting : "idea");
  const verbs = (text.match(/\b(kissing|kiss|hugging|hug|running|sitting|sleeping|walking|flying|swimming|jumping|dancing|standing)\b/g) || []).slice(0, 2);
  const nouns = subjects.filter((s) => s.form !== "human").map((s) => s.label);
  const who = subjects.filter((s) => s.form === "human").length >= 2 ? ["couple"] : subjects.some((s) => s.form === "human") ? ["person"] : [];
  const search = [...who, ...nouns.slice(0, 2), ...verbs, setting !== "void" && setting !== "ground" ? setting : "", weather !== "clear" ? weather : "", time === "night" ? "night" : ""].filter(Boolean).join(" ");
  return normalizePlan({
    seed,
    mode,
    text: raw,
    title: subjects.length ? subjects.slice(0, 2).map((s) => s.label).join(" and ") : label,
    read: subjects.length ? `${subjects.map((s) => (s.count > 1 ? `${s.count} ${s.label}s` : `a ${s.label}`)).join(", ")}${setting !== "void" && setting !== "ground" ? ` in a ${setting}` : ""}` : `a ${setting}`,
    style,
    subjects,
    relations,
    view,
    world: { setting, time, season, weather, temperature: cold ? "cold" : "mild", energy: weather === "storm" ? 0.9 : weather === "wind" ? 0.6 : 0.3 },
    lights,
    particles,
    palette: { colors: colors.map((c) => c.hex) },
    mood,
    search,
  });
}
