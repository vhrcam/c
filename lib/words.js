import { COLORS, LABELS, normalize } from "./scene.js";

const FIND = {
  place: [
    ["beach", /\b(beach|ocean|sea|seaside|shore|coast|sand|waves?|surf)\b/],
    ["lake", /\b(lake|pond|river|lakeside|dock|pier|canoe)\b/],
    ["mountains", /\b(mountains?|peaks?|alps|cliffs?|summit|canyon|valley)\b/],
    ["forest", /\b(forest|woods|woodland|jungle|pines)\b/],
    ["city", /\b(city|rooftop|roof|street|downtown|skyline|town|bridge|cafe|balcony|new york|paris|tokyo)\b/],
    ["snow", /\b(snowy|winter|ski|skiing|snowman|frozen|snow)\b/],
    ["meadow", /\b(meadow|fields?|grass|grassland|prairie|hills?|farm|park|countryside|garden|backyard)\b/],
  ],
  time: [
    ["golden", /\b(golden hour|golden light|late afternoon)\b/],
    ["sunrise", /\b(sunrise|dawn|morning|daybreak)\b/],
    ["sunset", /\b(sunset|dusk|evening|twilight)\b/],
    ["night", /\b(night|midnight|stars|starry|moon|moonlight|nighttime|fireworks)\b/],
    ["day", /\b(noon|midday|afternoon|daytime|sunny|blue sky)\b/],
  ],
  weather: [
    ["rain", /\b(rain|raining|rainy|storm|stormy|drizzle|umbrella)\b/],
    ["snow", /\b(snowing|snowfall|snowflakes|snow falling|falling snow)\b/],
    ["fog", /\b(fog|foggy|mist|misty|haze|hazy)\b/],
    ["clouds", /\b(cloudy|clouds|overcast|gr[ae]y sky)\b/],
  ],
  extras: [
    ["flowers", /\b(flowers?|wildflowers|roses?|tulips|daisies|sunflowers|bouquet|blossoms?)\b/],
    ["stars", /\b(stars|starry|starlight)\b/],
    ["fireflies", /\b(fireflies|firefly|lightning bugs)\b/],
    ["birds", /\b(birds?|seagulls?|gulls|geese|doves?)\b/],
    ["trees", /\b(trees?|oak|willow|cherry)\b/],
    ["lanterns", /\b(lanterns?|fairy lights|string lights)\b/],
    ["aurora", /\b(northern lights|aurora)\b/],
    ["shooting-star", /\b(shooting star|meteor|make a wish)\b/],
  ],
  mood: [
    ["moody", /\b(sad|lonely|melancholy|miss(ed)?|goodbye|moody|bittersweet)\b/],
    ["dreamy", /\b(dreamy|dream|magical|fairytale|surreal|soft)\b/],
    ["calm", /\b(peaceful|quiet|calm|serene|still)\b/],
    ["bright", /\b(happy|joy|joyful|bright|cheerful|fun|laughing)\b/],
    ["warm", /\b(romantic|love|warm|cozy)\b/],
  ],
  style: [
    ["oil", /\b(oils?|oil paint\w*|impasto|van gogh)\b/],
    ["storybook", /\b(storybook|story book|picture book|children'?s book|cartoon|ghibli|illustrat\w*)\b/],
    ["ink", /\b(ink|sumi|sumi-e|black and white)\b/],
    ["pixel", /\b(pixels?|pixel art|8-bit|8 bit|16-bit|retro game)\b/],
    ["watercolor", /\b(watercolou?rs?)\b/],
  ],
  pose: [
    ["kiss", /\b(kiss|kissing|kissed)\b/],
    ["hug", /\b(hug|hugging|hugged|embrace|embracing|cuddl\w*|danc\w*|propos\w*)\b/],
    ["hold", /\b(holding hands|hand in hand|held hands|holding my hand)\b/],
    ["sit", /\b(sit|sitting|sat|picnic|bench|lying|laying)\b/],
    ["walk", /\b(walk|walking|walked|stroll\w*|hik\w*|running|ran)\b/],
    ["stand", /\b(standing|stood|watching|looking at)\b/],
  ],
};

const COLOR_WORDS = { ...COLORS, grey: COLORS.gray, golden: COLORS.gold, blonde: "#c9a464", blond: "#c9a464", ginger: "#a24f26", auburn: "#7a3a22", silver: "#b9b9bd", maroon: "#6d1f26", beige: "#d8c4a0", lavender: "#b6a3d6", mint: "#9fd3b6", burgundy: "#6d1f2e", olive: "#6b7340", tan: "#c9a77c" };
const COLOR = Object.keys(COLOR_WORDS).join("|");
const CLOTHES = /(dress|gown|skirt|shirt|t-shirt|tee|top|blouse|sweater|hoodie|jacket|coat|suit|tux|tuxedo|jeans|pants|trousers|shorts)/;
const OUTFIT = new RegExp(`\\b(${COLOR})\\s+(?:\\w+\\s+)?${CLOTHES.source}\\b`, "g");
const OUTFIT_AFTER = new RegExp(`\\b${CLOTHES.source}\\s+(?:is|was|should be|to|in|now)\\s+(${COLOR})\\b`, "g");
const outfits = (text) =>
  [...[...text.matchAll(OUTFIT)].map((m) => ({ at: m.index, color: m[1], item: m[2] })), ...[...text.matchAll(OUTFIT_AFTER)].map((m) => ({ at: m.index, color: m[2], item: m[1] }))].sort((a, b) => a.at - b.at);
const HAIR = new RegExp(`\\b(?:(long|short)\\s+)?(?:(${COLOR})\\s+)?(?:(long|short)\\s+)?hair\\b`, "g");

const first = (text, list) => list.find(([, re]) => re.test(text))?.[0];
const all = (text, list) => list.filter(([, re]) => re.test(text)).map(([key]) => key);

function count(text) {
  const n = { two: 2, three: 3, four: 4, five: 5 };
  const of = text.match(/\b(two|three|four|five) of us\b/);
  if (of) return n[of[1]];
  if (/\b(family|kids|children)\b/.test(text)) return 4;
  if (/\bfriends\b/.test(text)) return 3;
  if (/\b(we|us|our|couple|together|kiss\w*|hug\w*|holding hands|date|proposal|propos\w*|wedding|honeymoon|my (girlfriend|boyfriend|wife|husband|partner|fianc\w*|crush|love|mom|dad|mother|father|grandma|grandpa|sister|brother|friend|best friend|son|daughter))\b/.test(text)) return 2;
  if (/\b(me|i|myself|alone|by myself)\b/.test(text)) return 1;
  return 0;
}

function people(text, n) {
  const figs = Array.from({ length: n }, (_, i) => ({ height: n > 2 && i > 1 ? 0.62 + i * 0.04 : 1 }));
  if (n === 2 && /\b(son|daughter|kid|child)\b/.test(text)) figs[1].height = 0.66;
  let slot = 0;
  for (const m of outfits(text)) {
    const f = figs[Math.min(slot, n - 1)];
    if (!f) break;
    const color = COLOR_WORDS[m.color];
    if (/dress|gown|skirt/.test(m.item)) Object.assign(f, { dress: true, top: color });
    else if (/suit|tux/.test(m.item)) Object.assign(f, { top: color, bottom: color });
    else if (/jeans|pants|trousers|shorts/.test(m.item)) f.bottom = color;
    else f.top = color;
    slot++;
  }
  if (/\bjeans\b/.test(text) && figs[0] && !figs[0].bottom) figs[0].bottom = "#3b5a85";
  let hairSlot = Math.max(0, figs.findIndex((f) => f.dress));
  for (const m of text.matchAll(HAIR)) {
    const f = figs[Math.min(hairSlot, n - 1)];
    if (!f) break;
    const length = m[1] || m[3];
    if (length) f.hairLength = length;
    if (m[2]) f.hair = COLOR_WORDS[m[2]];
    hairSlot++;
  }
  if (/\bbun\b/.test(text) && figs[0]) figs[0].hairLength = "bun";
  return figs;
}

export function caption(scene) {
  const place = { meadow: "a meadow", beach: "the beach", mountains: "the mountains", forest: "the forest", lake: "the lake", city: "the city", snow: "the snowy hills" }[scene.place];
  return `${place} at ${LABELS.time[scene.time]}`;
}

export function read(text, picks = {}, style = "", seed = 1) {
  const t = text.toLowerCase();
  const n = count(t);
  const extras = [...new Set([...(picks.extras || []), ...all(t, FIND.extras)])];
  let time = picks.time || first(t, FIND.time);
  if (!time && (extras.includes("stars") || extras.includes("aurora") || extras.includes("fireflies"))) time = "night";
  const scene = normalize({
    seed,
    style: style || first(t, FIND.style) || "watercolor",
    place: picks.place || first(t, FIND.place) || (extras.includes("trees") ? "meadow" : undefined),
    time: time || "golden",
    weather: picks.weather || first(t, FIND.weather) || "clear",
    extras,
    mood: first(t, FIND.mood) || "warm",
    pose: first(t, FIND.pose),
    people: people(t, n),
    caption: text,
  });
  if (!text) scene.caption = caption(scene);
  return scene;
}

const TINTS = { pink: "#ff8fb4", pinker: "#ff8fb4", purple: "#a77be0", purpler: "#a77be0", orange: "#ff9a4d", blue: "#6fa4ff", bluer: "#6fa4ff", gold: "#ffc95c", golden: "#ffc95c", red: "#ff6a5a", redder: "#ff6a5a" };

export function edit(text, scene) {
  const t = text.toLowerCase();
  const next = structuredClone(scene);
  let changed = false;
  const set = (key, value) => {
    if (value && next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  };
  set("place", first(t, FIND.place));
  set("time", first(t, FIND.time));
  set("weather", first(t, FIND.weather));
  set("mood", first(t, FIND.mood) || (/\b(darker|moodier)\b/.test(t) && "moody") || (/\bbrighter\b/.test(t) && "bright") || (/\bwarmer\b/.test(t) && "warm") || (/\bdreamier\b/.test(t) && "dreamy"));
  set("pose", first(t, FIND.pose));
  set("style", first(t, FIND.style));
  const removing = /\b(remove|no|without|get rid of|take away|delete)\b/.test(t);
  for (const x of all(t, FIND.extras)) {
    const has = next.extras.includes(x);
    if (removing && has) next.extras = next.extras.filter((e) => e !== x);
    if (!removing && !has) next.extras.push(x);
    if (removing === has) changed = true;
  }
  if (removing && /\b(clouds|rain|fog|snow)\b/.test(t)) set("weather", "clear");
  if (/\b(clear|no clouds)\b/.test(t)) set("weather", "clear");
  const tint = t.match(/\b(pink|pinker|purple|purpler|orange|blue|bluer|gold|golden|red|redder)\b(?=.*\bsky\b)|\bsky\b.*\b(pink|pinker|purple|purpler|orange|blue|bluer|gold|golden|red|redder)\b|\bmore (pink|purple|orange|blue|gold|red)\b|\b(pinker|purpler|bluer|redder)\b/);
  if (tint) set("skyTint", TINTS[tint.slice(1).find(Boolean)]);
  if (/\b(just me|only me|by myself|alone)\b/.test(t)) {
    next.people = next.people.slice(0, 1);
    if (!next.people.length) next.people = [{}];
    changed = true;
  }
  if (outfits(t).length && next.people.length) {
    const figs = people(t, next.people.length);
    next.people = next.people.map((f, i) => ({ ...f, ...Object.fromEntries(Object.entries(figs[i]).filter(([k, v]) => v && k !== "height")) }));
    changed = true;
  }
  return { scene: normalize(next), changed };
}
