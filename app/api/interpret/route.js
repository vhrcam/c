import { askJSON } from "@/lib/ai";
import { BUILDINGS, DRIFTS, FORMS, KINDS, LIGHTS, LOOKS, MATERIALS, MOODS, MOTIONS, PARTICLES, RELS, SEASONS, SETTINGS, SHAPES, STYLES, TEMPS, TIMES, VEHICLE_TYPES, VIEWS, WEATHER, normalizePlan } from "@/lib/engine/plan";
import { PRESETS } from "@/lib/engine/presets";
import { findReference } from "@/lib/engine/reference";
import { readPlan } from "@/lib/engine/words";

const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

const str = { type: "string" };
const num = { type: "number" };
const hex = { type: "string", description: "hex color like #b5352d" };
const enumOf = (values) => ({ type: "string", enum: values });
const vec = { type: "array", items: num };
const unit = { type: "number", description: "0 to 1, 0.5 is typical" };

const PART = {
  type: "object",
  properties: {
    name: str,
    shape: enumOf(SHAPES),
    a: vec,
    b: vec,
    r: vec,
    rot: vec,
    path: { type: "array", items: vec },
    radii: vec,
    profile: { type: "array", items: vec },
    color: hex,
    blend: num,
    cut: { type: "boolean" },
  },
  required: ["name", "shape", "color"],
};

const SCHEMA = {
  type: "object",
  properties: {
    title: str,
    read: str,
    style: enumOf(STYLES),
    subjects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: str,
          label: str,
          kind: enumOf(KINDS),
          form: enumOf(FORMS),
          building: { type: "object", properties: { style: enumOf(BUILDINGS), floors: { type: "integer" }, width: num, roof: enumOf(["auto", "gable", "hip", "flat", "mansard", "dome", "spire", "gambrel"]), wings: { type: "integer" }, towers: { type: "integer" }, columns: { type: "boolean" } } },
          vehicle: { type: "object", properties: { type: enumOf(VEHICLE_TYPES) } },
          material: enumOf(MATERIALS),
          colors: { type: "array", items: hex },
          size: { type: "number", description: "largest dimension in meters" },
          count: { type: "integer" },
          motion: enumOf(MOTIONS),
          traits: { type: "object", properties: { ocean: unit, gas: unit, rings: unit } },
          wiki: { type: "string", description: "English Wikipedia article title for what this subject is" },
          parts: { type: "array", items: PART },
        },
        required: ["id", "label", "kind", "form", "material", "colors", "size"],
      },
    },
    relations: { type: "array", items: { type: "object", properties: { a: str, rel: enumOf(RELS), b: str }, required: ["a", "rel", "b"] } },
    view: { type: "object", properties: { kind: enumOf(VIEWS), from: str, at: str, look: enumOf(LOOKS) }, required: ["kind"] },
    world: {
      type: "object",
      properties: { setting: enumOf(SETTINGS), time: enumOf(TIMES), season: enumOf(SEASONS), weather: enumOf(WEATHER), temperature: enumOf(TEMPS), energy: num },
      required: ["setting", "time", "season", "weather", "temperature", "energy"],
    },
    lights: { type: "array", items: { type: "object", properties: { kind: enumOf(LIGHTS), at: str, color: hex }, required: ["kind", "color"] } },
    particles: { type: "array", items: { type: "object", properties: { kind: enumOf(PARTICLES), color: hex, amount: num, motion: enumOf(DRIFTS) }, required: ["kind", "color", "amount", "motion"] } },
    palette: { type: "object", properties: { background: hex, ink: hex, colors: { type: "array", items: hex }, accent: hex }, required: ["background", "ink", "colors", "accent"] },
    mood: enumOf(MOODS),
    systems: { type: "array", items: { type: "object", properties: { subject: str, why: str }, required: ["subject", "why"] } },
    search: { type: "string", description: "3 to 6 word image search for a real photo of the scene" },
    missing: { type: "array", items: str, description: "things they asked for that c cannot build" },
  },
  required: ["title", "read", "style", "subjects", "relations", "view", "world", "lights", "particles", "palette", "mood", "systems", "search"],
};

const example = (key) => {
  const { label, parts } = PRESETS[key];
  return `${label}: ${JSON.stringify(parts.map(({ name, shape, a, b, r, path, radii, profile, color, blend, cut }) => ({ name, shape, a, b, r, path, radii, profile, color, blend, cut })))}`;
};

function prompt(text, mode) {
  return `You are the interpreter inside c, a generative art engine. Someone describes an idea in plain words. You never draw pictures. You turn the idea into a construction plan that c's algorithms (particle swarms, fur filaments, distance-field sculpture, contour slices, branching growth, wave fields) build into an animated ${mode === "2d" ? "2D" : "3D"} artwork.

Principles:
- The person's idea is the foundation. Interpret and elevate it, never replace it. "A banana in 8-bit style" stays a banana.
- Recognizable first: correct subjects, proportions, poses, colors and spatial relationships. The computational construction comes second.
- Understand relationships, not keywords: what is on, under, beside, holding or facing what.
- Understand point of view. "I'm standing on top of a lighthouse looking down at the ocean" means the camera starts at the top of the lighthouse looking down (view first-person, from the lighthouse, look down), and the speaker is the viewer, not a subject. When the speaker is part of the moment (a memory of two people kissing), they are a subject.
- Memories become the rules of the system: falling leaves become particles, a streetlight becomes a light, darkness becomes negative space, cold becomes slow drifting air.
- Use the colors they mention on the things they belong to. Otherwise choose a natural, harmonious palette for the subject and mood. Never neon or cyberpunk unless asked.

Fields:
- title: 1 to 4 lowercase words, plain and evocative ("first kiss, october").
- read: one sentence saying what a viewer recognizes first.
- style: pixel only for pixel art, 8-bit, 16-bit or retro game looks; line for line art, sketches or drawings; cells for mosaic or stained glass; otherwise auto.
- subjects: the 1 to 4 main things (people, animals, objects, structures, plants, a planet). Not the setting, weather or sky. id is a short unique slug. label uses the person's own words for it ("girlfriend", "me", "my dog", "the lighthouse").
  - c only builds what it has real recipes for. Buildings (${BUILDINGS.join(", ")}), vehicles (${VEHICLE_TYPES.join(", ")}), trees, planets, and these objects: ${Object.keys(PRESETS).join(", ")}. Map their words onto the closest real recipe (a semi or a big rig is truck, a pickup truck is pickup, a pirate ship is galleon, a cottage by the sea is cottage). Anything else they ask for (people, animals, other objects) goes in missing, by name, and is left out of subjects. Never substitute a different thing.
  - form: building for any building or structure (house, mansion, castle, church, skyscraper, tower, lighthouse, barn, temple, pagoda, bridge, windmill, cabin) with building.style, floors, roof, wings (0 to 2 side wings), towers and columns (a portico); vehicle for cars, trucks, buses, trains and boats with vehicle.type; tree for a single tree; planet for a planet (size 1, traits ocean/gas/rings); parts for any other object.
  - size: largest dimension in meters (a banana 0.2, a car 4.7, a house 12, a lighthouse 30).
  - colors: hex, main color first. For a building: walls, roof, trim. For a vehicle: paint, then trim. count for identical copies.
  - parts (form parts only): 3 to 24 primitives in meters. y is up, the ground is y=0, the object's front faces +x, centered on x=0 and z=0.
      ellipsoid: a=center, b=radii [rx,ry,rz], rot=[degX,degY,degZ]
      box: a=center, b=full size [sx,sy,sz], r=[corner rounding], rot
      capsule: a=start, b=end, r=[radius at a, radius at b] (limbs, handles, tapered rods)
      cylinder: a=bottom center, b=top center, r=[radius]
      cone: a=base center, b=top center, r=[base radius, top radius]
      torus: a=center, b=axis direction, r=[ring radius, tube radius]
      sweep: path=3 to 8 points of a curved tube, radii=radius at each point (bananas, tails, horns, pipes, stems, necks)
      lathe: a=base center, b=axis direction (usually [0,1,0]), profile=[[radius, height], ...] bottom to top (vases, towers, bottles, domes, round fruit)
    Each part has a name, a hex color, blend (meters of smooth blending into the parts before it, 0 for a crisp join) and cut=true to carve it away (hollows, doors, windows).
    Accurate proportions and a readable silhouette matter most. Use enough parts for the object's identity.
    Examples:
    ${example("banana")}
    ${example("lighthouse")}
    ${example("streetlight")}
- relations: a (subject id) rel b (subject id).
- view: the starting camera. outside is a 3/4 view. first-person puts the camera on the "from" subject looking "look" toward "at". aerial, close, wide, low.
- world: setting is void when they name just one thing and no place or surroundings ("a skyscraper", "a red sports car at night"): c then builds only that thing. Any place, surroundings or second thing ("in a crowded city", "on a country road", "with a few buildings around") means a real setting, and c fills in the rest of the scene. Also time, season (none if unknown), weather, temperature, energy (0 calm to 1 violent).
- lights: sources that matter (sun, moon, streetlight, lamp, fire, beam for a lighthouse, glow, window); at = the subject id it belongs to.
- particles: up to 3 systems (leaves, snow, rain, petals, dust, sparks, fireflies, embers, spray, bubbles) with color, amount 0 to 1 and motion.
- palette: background (when setting is void, always #11100e, c's own dark; otherwise dark for night, space or moody scenes and light for bright daytime scenes), ink (a neutral line color that reads on the background), colors (3 to 6), accent.
- search: 3 to 6 plain words to find a real photograph that shows the scene exactly as described, main subject and action first ("wolf running in snow", "couple kissing under streetlight", "banana on white"). No style words.
- subjects[].wiki: the English Wikipedia article title for what the subject is ("Golden Retriever", "Red fox", "Banana", "Lighthouse"). Empty for people.
- systems: one per subject, plus "world" when there is water: subject id and why, one sentence on how its computational system follows from the subject's properties ("fur becomes thousands of filaments that follow the body's flow").

Description: """${text}"""`;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 600);
  const mode = body.mode === "2d" ? "2d" : "3d";
  const seed = Math.floor(Math.random() * 2 ** 31);
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const withReference = async (plan) => {
    const hero = plan.subjects[0];
    const reference = await Promise.race([findReference(plan, { search: plan.search, wiki: hero?.wiki }), new Promise((r) => setTimeout(() => r(null), 9000))]).catch(() => null);
    return normalizePlan({ ...plan, reference });
  };
  const fallback = async () => Response.json({ plan: await withReference(readPlan(text, mode, seed)), source: "words" });
  if (!text || !process.env.GEMINI_API_KEY || (process.env.NODE_ENV === "production" && limited(ip))) return fallback();
  let plan;
  try {
    plan = normalizePlan({ ...(await askJSON(prompt(text, mode), SCHEMA, 28000)), text, mode, seed });
  } catch {
    return fallback();
  }
  return Response.json({ plan: await withReference(plan), source: "ai" });
}
