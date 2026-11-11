export const FORMATS = { wide: [150, 100], tall: [100, 150], square: [120, 120] };
export const TIMES = ["dawn", "day", "golden", "dusk", "night"];
export const WEATHER = ["clear", "cloud", "rain", "snow", "fog", "storm", "wind"];
export const BACKDROPS = ["sky", "room", "deep", "space", "void"];
export const ROLES = ["focus", "support", "setting"];
export const TYPES = ["band", "tube", "blob", "poly"];
export const PATTERNS = ["stripes", "spots", "checks"];
export const MATERIALS = [
  "skin",
  "hair",
  "fur",
  "feather",
  "scales",
  "cloth",
  "knit",
  "leather",
  "wood",
  "bark",
  "stone",
  "brick",
  "concrete",
  "metal",
  "glass",
  "plastic",
  "rubber",
  "paper",
  "ceramic",
  "food",
  "bone",
  "rope",
  "water",
  "ice",
  "snow",
  "sand",
  "soil",
  "grass",
  "foliage",
  "petals",
  "fire",
  "smoke",
  "cloud",
  "light",
];

const str = { type: "string" };
const num = { type: "number" };
const oneOf = (values) => ({ type: "string", enum: values });

const FORM = {
  type: "object",
  properties: {
    name: str,
    role: oneOf(ROLES),
    shapes: { type: "array", items: str },
    scatter: { type: "object", properties: { count: { type: "integer" }, x0: num, y0: num, x1: num, y1: num, far: num }, required: ["count", "x0", "y0", "x1", "y1", "far"] },
  },
  required: ["name", "role", "shapes"],
  propertyOrdering: ["name", "role", "shapes", "scatter"],
};

export const SCHEMA = {
  type: "object",
  properties: {
    title: str,
    reading: str,
    format: oneOf(Object.keys(FORMATS)),
    time: oneOf(TIMES),
    weather: oneOf(WEATHER),
    backdrop: oneOf(BACKDROPS),
    mood: str,
    energy: num,
    palette: { type: "array", items: str },
    light: { type: "object", properties: { x: num, y: num, color: str }, required: ["x", "y", "color"] },
    layout: str,
    forms: { type: "array", items: FORM },
  },
  required: ["title", "reading", "format", "time", "weather", "backdrop", "mood", "energy", "palette", "light", "layout", "forms"],
  propertyOrdering: ["title", "reading", "format", "time", "weather", "backdrop", "mood", "energy", "palette", "light", "layout", "forms"],
};

export function brief(text, earlier = []) {
  const again = earlier.length
    ? `\n\nThis is take ${earlier.length + 1} of the same words. Earlier takes were staged like this:\n${earlier.map((l, i) => `${i + 1}. ${l}`).join("\n")}\nStage this one differently: another viewpoint, distance, format or moment, while staying faithful to the words.`
    : "";
  return `You are the director inside c, a generative art system. Someone describes a memory, or anything else they can picture. c holds no stored drawings: its code builds every picture from nothing out of thousands of lines. You never draw the artwork. You block it out the way a director blocks a scene: what is in the frame, where it sits, how large it is, what it is made of and what color it is, using a few plain shapes. c grows its line systems over your blocking, so clear silhouettes, true proportions, believable poses and a strong composition matter. Fine detail does not.

READ
- Stay faithful to the words. Everything they name must be in the picture, doing what they said, where they said.
- Where the words are silent, fill in what would naturally be there: a ground to stand on, the place around it, the time of day it implies. Do not invent drama they did not mention.
- If it is a feeling or an idea with no physical scene, stage a simple scene or arrangement of forms that carries it.

CANVAS
Choose format: "wide" is 150 x 100, "tall" is 100 x 150, "square" is 120 x 120. x runs left to right from 0. y runs top to bottom from 0. Every number you give is in these units.

COMPOSE
- Decide what must be recognized first. That is the focus. Make it large: a focus that is one person or one animal spans 55 to 85 percent of the canvas height; a group, or a scene where the place matters too, 40 to 65 percent. Never leave the focus small in an empty frame.
- Choose the viewpoint the memory implies: from behind when they are watching something, from the side for walking, running or riding, close when it is about a face, a touch or an embrace, from above when they look down on something.
- Anything that stands, sits or lies on something must touch it. Keep sizes true to life relative to each other.
- Give every person and animal clear space. Two bodies overlap only where they really touch, so each silhouette still reads on its own.
- Everything the words name must be seen. Pick the viewpoint where no named person, animal or thing hides behind another and where what they are doing shows.
- Put the focus off-center when something else shares the frame.
- In layout, work out where each form goes in canvas units before you place any shape.

SHAPES
Everything in the picture is a form built from shapes. List forms from farthest to nearest. Inside a form list shapes from back to front; later shapes cover earlier ones.
Write each shape as one line of text, fields separated by " | ":
type | material | color | part | numbers | extras
- band: land, sea, floor, a wall, a far treeline, a mountain range, anything that crosses the whole canvas. numbers are x,y points along its top edge from the left side (x = 0) to the right side; it fills everything below that edge. c roughens the edge to suit the material.
- tube: a round limb through 2 to 6 points, each x,y,r where r is its radius there. Arms, legs, torsos, necks, tails, trunks, branches, posts. Thin things too, with a small r: rods, strings, wires, rails, spokes, whiskers, stems.
- blob: an ellipse, one point x,y,rx,ry,tilt (center, the two radii, tilt in degrees). Heads, round bodies, wheels, fruit, the sun, the moon.
- poly: a closed outline through x,y points. Clothing, hair masses, wings, ears, roofs, walls, furniture, leaves, anything else.
- color is hex, the color that part really is in this light.
- part says which part of the form it is.
- extras is optional: "round" gives a poly soft corners; "stripes #hex", "spots #hex" or "checks #hex" only when the thing truly has that pattern.
Syntax examples (the syntax only, never copy their content):
tube | bark | #5a4632 | trunk | 80,95,4 79,70,3.2 81,52,2.4
blob | ceramic | #d9d2c4 | bowl | 60,70,12,6,0
poly | cloth | #7a2e2e | curtain | 10,10 30,10 32,60 9,62 | round
band | sand | #d8c29a | shore | 0,70 60,68 150,72
Use 8 to 26 shapes for a form that matters, enough that its silhouette alone says what it is. Setting forms can be 1 to 8. Every shape must have its numbers.
Break a big soft mass into a few overlapping shapes of different sizes rather than one ball: a tree's crown is several clumps over a trunk that forks into boughs, a cloud is several puffs, a range has more than one ridge.

MATERIAL is what the shape is physically made of. c chooses its line system from it: ${MATERIALS.join(", ")}.

BODIES
Build people and animals as anatomy in the pose the memory needs, never as symbols or stick figures:
- torso as one tube through four points, hips, waist, chest and shoulders, each with its own radius so the body has a real shape (the waist narrower than the chest and hips; a child or a bundled-up body is straighter), a neck tube, a head blob, each arm one tube through shoulder, elbow and wrist with a small hand blob, each leg one tube through hip, knee and ankle with a foot. Draw both arms and both legs as separate tubes unless one is fully hidden.
- An adult stands about 7.5 heads tall with shoulders two heads wide; a child 5 to 6 heads with a larger head. Limbs taper toward the wrist and ankle. Bend elbows, knees and spine the way the action bends them.
- List a body from its far side to its near side: the arm and leg on the far side first, then the torso, neck and head, then the arm and leg nearest the viewer. A limb listed after the torso is drawn on top of it, so do that only for the near side or for a limb that really crosses in front.
- Clothed parts take the clothing's material and color (a sleeved arm is a cloth tube, a bare forearm continues as a skin tube). Loose garments (skirt, dress, coat, hood, hat, scarf) are poly shapes. Hair is a poly or tubes of material hair, shaped the way it falls or blows. When the face shows, list the hair that hangs behind the head before the head, and add a fringe only as its own small poly after the head, above the eyes.
- A head that faces the viewer or is in profile gets a face sized to it: two small dark blobs for eyes, a short tube for the nose, a tube for the mouth, and brows when the head's radius is 6 or more. Shape the mouth and brows to the feeling: a smile is a mouth whose ends rise. A head seen from behind has no face.
- Animals get the true proportions of their species: body, neck, head, muzzle, ears, tail and every leg with its joints.

MANY
When there are many of one thing (trees in a forest, birds in a flock, people in a crowd, flowers in a field), draw one and give scatter: c places count more copies with their base inside the box x0, y0 to x1, y1. far is the scale of copies at y0 relative to the one you drew (0.15 to 1); copies at y1 are full size.

LIGHT
light is where the main light comes from, in canvas units (it may lie outside the canvas), and its color. If the source is in the picture, also add it as a shape with material light or fire. Material light is only for the source itself: the disc of the sun or moon, a lamp's bulb or shade, a lit window pane, a screen, a firework burst.

LEAVE TO c
Do not draw shadows, reflections, glows, beams or pools of light, rain, falling snow, stars, fog or mist: c makes all of those from time, weather and light. Do not draw the sky itself; add a cloud only when one particular cloud matters.

ALSO GIVE
title: 1 to 4 lowercase words. reading: one sentence saying what a viewer should recognize first. time, weather. backdrop: what lies behind every form (sky; room for interiors; deep for underwater; space; void for plain nothing). palette: 3 to 5 hex colors that hold this memory's feeling. mood: 2 to 4 words. energy: 0 calm to 1 intense.${again}

Words: """${text}"""`;
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})(?:[0-9a-f]{2})?$/i;

export function hex(value, fallback = "#777777") {
  const m = HEX.exec(String(value || "").trim());
  if (!m) return fallback;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

const NEED = { band: 2, tube: 3, blob: 3, poly: 2 };

// substances the director sometimes names that are not on the list, and the listed one each behaves like
const KIN = {
  concrete: ["plaster", "wall", "drywall", "stucco", "cement", "asphalt", "pavement", "tarmac", "road", "tile"],
  cloth: ["fabric", "cotton", "denim", "silk", "linen", "canvas", "felt", "velvet", "nylon"],
  knit: ["wool", "yarn"],
  metal: ["steel", "iron", "gold", "silver", "chrome", "aluminum", "aluminium", "copper", "brass", "bronze", "tin"],
  stone: ["rock", "marble", "granite", "slate", "gravel", "pebble"],
  soil: ["dirt", "mud", "earth", "clay"],
  foliage: ["leaves", "leaf", "bush", "moss", "plant", "vine", "hedge"],
  petals: ["flower", "blossom"],
  skin: ["flesh"],
  ceramic: ["porcelain", "china", "enamel"],
  paper: ["cardboard", "card"],
  plastic: ["vinyl", "wax", "acrylic"],
  fire: ["flame", "ember", "lava"],
  smoke: ["steam", "mist", "fog", "dust"],
  water: ["liquid", "sea", "ocean", "river"],
  fur: ["wool coat", "mane"],
  bark: ["trunk"],
  rope: ["string", "cord", "wire"],
  hair: ["beard", "whiskers"],
  light: ["glow", "neon", "screen", "lamp"],
};
const substance = (word) => {
  const w = String(word || "").toLowerCase().trim();
  if (MATERIALS.includes(w)) return w;
  for (const [material, kin] of Object.entries(KIN)) if (kin.includes(w)) return material;
  return null;
};

// one "type | material | color | part | numbers | extras" line into a shape, or null when it has no usable geometry
export function parseShape(line) {
  const f = String(line || "").split("|").map((s) => s.trim());
  if (f.length < 5) return null;
  const type = TYPES.includes(f[0].toLowerCase()) ? f[0].toLowerCase() : f[0].toLowerCase() === "line" ? "tube" : null;
  if (!type) return null;
  // the substance belongs in the second field, but it is still understood when it lands in the part's place
  const material = substance(f[1]) || substance(f[3]) || "cloth";
  // numbers arrive in loose shapes: spaces after commas, brackets, a tube's radius given once at the end or not at all
  const groups = f[4]
    .replace(/[()[\]]/g, " ")
    .replace(/\s*,\s*/g, ",")
    .split(/[\s;]+/)
    .map((p) => p.split(",").filter((v) => v !== "").map(Number))
    .filter((p) => p.length && p.every(Number.isFinite));
  const pts = groups.filter((p) => p.length >= 2);
  const extras = f.slice(5).join(" ").toLowerCase();
  const pattern = PATTERNS.find((p) => extras.includes(p)) || null;
  const shape = { type, material, color: hex(f[2]), part: f[3].slice(0, 40), round: /\bround\b/.test(extras), pattern, color2: pattern ? hex(/#[0-9a-f]{3,8}/.exec(extras)?.[0], null) : null };
  if (type === "blob") {
    const [x, y, rx, ry = rx, tilt = 0] = groups.flat();
    if (!Number.isFinite(y) || !(rx > 0) || !(ry > 0)) return null;
    return { ...shape, x, y, rx, ry, tilt };
  }
  if (type === "tube") {
    const alone = groups.filter((p) => p.length === 1).map((p) => Math.abs(p[0]))[0];
    let r = alone ?? pts.find((p) => p.length > 2)?.[2] ?? 0.4;
    const chain = pts.map((p) => {
      if (p.length > 2) r = p[2];
      return [p[0], p[1], Math.max(0.12, Math.abs(p.length > 2 ? p[2] : (alone ?? r)))];
    });
    if (!chain.length) return null;
    return { ...shape, pts: chain.length === 1 ? [chain[0], [chain[0][0] + 0.01, chain[0][1], chain[0][2]]] : chain.slice(0, 12) };
  }
  if (type === "poly" && pts.length < 3) return null;
  if (type === "band" && pts.length < 1) return null;
  return { ...shape, pts: pts.map(([x, y]) => [x, y]).slice(0, 64) };
}
