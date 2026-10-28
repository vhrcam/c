import { askJSON } from "@/lib/ai";
import { AGES, DIRECTIONS, EARS, FAMILIES, FEATURES, FOCUS, FRAMINGS, GENDERS, MOODS, MOTIONS, PLACES, ROLES, SHAPES, SPACES, SPATIAL, TAILS, TIMES, WEATHER, WHERE, normalizePlan, readWords } from "@/lib/art/plan";
import { POSES } from "@/lib/art/people";

const str = { type: "string" };
const enumOf = (values) => ({ type: "string", enum: values });

const num = { type: "number" };
const SHAPE = { type: "object", properties: { type: enumOf(SHAPES), x: num, y: num, w: num, h: num, r: num, points: { type: "array", items: { type: "array", items: num } }, color: str }, required: ["type", "color"] };
const BEING = {
  type: "object",
  properties: {
    label: str,
    family: enumOf(FAMILIES),
    kind: str,
    count: { type: "integer" },
    role: enumOf(ROLES),
    motion: enumOf(MOTIONS),
    size: num,
    colors: { type: "array", items: str },
    build: { type: "object", properties: { legs: num, body: num, neck: num, head: num, snout: num, ears: enumOf(EARS), tail: enumOf(TAILS) } },
  },
  required: ["label", "family", "kind", "count", "role", "motion", "size", "colors"],
};
const THING = { type: "object", properties: { label: str, kind: str, role: enumOf(ROLES), where: enumOf(WHERE), holds: { type: "boolean" }, size: { type: "object", properties: { w: num, h: num }, required: ["w", "h"] }, shapes: { type: "array", items: SHAPE } }, required: ["label", "kind", "role", "where", "size", "shapes"] };
const CONCEPT = { type: "object", properties: { idea: str, spatial: enumOf(SPATIAL), framing: enumOf(FRAMINGS), construction: enumOf(DIRECTIONS), abstraction: num }, required: ["idea", "spatial", "framing", "construction", "abstraction"] };

const SCHEMA = {
  type: "object",
  properties: {
    title: str,
    read: str,
    people: {
      type: "object",
      properties: {
        count: { type: "integer" },
        pose: enumOf(POSES),
        relation: str,
        subjects: {
          type: "array",
          items: { type: "object", properties: { label: str, gender: enumOf(GENDERS), age: enumOf(AGES), hair: str, clothing: str, appearance: str }, required: ["label", "gender", "age"] },
        },
      },
      required: ["count", "pose", "subjects"],
    },
    focus: enumOf(FOCUS),
    beings: { type: "array", items: BEING },
    things: { type: "array", items: THING },
    setting: {
      type: "object",
      properties: {
        place: enumOf(PLACES),
        features: { type: "array", items: enumOf(FEATURES) },
        time: enumOf(TIMES),
        weather: enumOf(WEATHER),
        space: enumOf(SPACES),
        interior: { type: "object", properties: { kind: str, wall: str, floor: str, window: { type: "boolean" }, light: enumOf(["lamp", "window", "dim", "bright"]) } },
      },
      required: ["place", "features", "time", "weather", "space"],
    },
    concepts: { type: "array", items: CONCEPT },
    mood: enumOf(MOODS),
    energy: { type: "number" },
    directions: { type: "array", items: enumOf(DIRECTIONS) },
  },
  required: ["title", "read", "people", "beings", "things", "focus", "setting", "mood", "energy", "directions", "concepts"],
};

const prompt = (text) => `You are the art director inside c. Someone describes a memory. You never draw. You decide what the artwork is about and how c's own procedural renderer should approach it; c's code draws every mark.

Decide:
- title: 1 to 4 lowercase words, plain and evocative.
- read: one sentence saying what a viewer should recognize first.
- people: who is in the memory (0, 1 or 2 people; c draws at most two). pose: embrace (kissing, hugging, slow dancing), sit (sitting together, watching something), stand (standing, looking out), walk, run (racing, running), alone (one person standing still). If the memory is about a place and nobody is doing anything, count can be 0.
  subjects: one entry per person, label in their own words ("me", "her", "my brother", "someone"). Record ONLY what the memory states or its words directly imply: gender is woman or man only when the text says so (her, she, wife, mom, brother, two women...), otherwise unspecified ("me", "two people", "my partner" are unspecified). age is child or elder only when stated (my son, my grandma), otherwise unspecified. hair, clothing and appearance stay empty unless the memory mentions them. Never invent identities, costumes or looks; c decides unspecified details itself.
- beings: every animal in the memory (a dog, ducks, a fox). family quadruped for four-legged animals, bird for birds. kind in plain words ("golden retriever", "mallard duck"). count, role (focal when it is what the memory is about), motion (stand, sit, lie, walk, run, swim, fly), size = body length in meters, colors = hex colors it really has (stated, or natural for that animal), build = 0 to 1 proportions (legs long, body heavy, neck long, head large, snout long) with ears and tail.
- things: objects, vehicles or furniture that matter to the memory (the car they drove home in, the seats on the train, the kitchen counter, the front door). where it sits, size in meters (w, h), holds = true when the people are inside it. shapes: draw it in side view as 3 to 14 flat shapes in a box where x and y run 0 to 1 from the top-left and y = 1 is the ground. rect uses x, y as its top-left corner with w, h; ellipse uses x, y as its center with w, h; circle and ring use x, y as center and w as diameter; tri uses x, y, w, h with the point at top center; poly and line use points. Give each shape a hex color. Keep silhouettes simple and recognizable.
- focus: people when the relationship is the heart of it, place when the place is ("the lake behind my grandparents' cabin"), moment when an action, animal, object or event is.
- setting.space: outdoor, interior (a kitchen, a bedroom, inside a train or a car), or abstract when the memory is mostly a feeling with little physical place ("the morning I found out I got in"). interior gives the room's kind, wall and floor hex colors, whether there is a window, and the light source.
- setting: the place it happened (pick the closest), features that were really there (sun for sunrise and sunset, moon, stars, trees, mountains, water, buildings, road, birds, dock, house, cabin), time of day and weather. Infer a natural setting when they don't say, but never invent a sunset unless they mention evening, sunset or golden light.
- mood and energy (0 calm to 1 intense).
- directions: rank all eight constructions by fit for this memory. expressive: painterly brush strokes. geometric: adaptive faceted planes. organic: textured masses, strata and branching light. lines: engraving where line width carries light. mosaic: Voronoi cells that shrink where the memory matters. contours: a topographic map of the scene's light. stipple: dots that gather in shadow and link into networks. grid: a quadtree of rectangles, finest where the memory is.

- concepts: exactly three ways to build this artwork that are structurally different from each other. spatial: scene (the subjects in their place), close (the subjects large and intimate against an atmospheric field), interior (inside the room), emblem (the subjects alone in an abstract field of color and structure). Each concept also picks a framing, one construction from the directions list and an abstraction level 0 to 1, and says its idea in one sentence. Make the three differ in spatial, framing and construction.

Memory: """${text}"""`;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 600);
  const seed = Math.floor(Math.random() * 2 ** 31);
  if (!text) return Response.json({ plan: readWords(""), source: "words" });
  if (!process.env.GEMINI_API_KEY) return Response.json({ plan: { ...readWords(text), seed }, source: "words" });
  try {
    const raw = await askJSON(prompt(text), SCHEMA, 32000);
    return Response.json({ plan: normalizePlan({ ...raw, text, seed }), source: "ai" });
  } catch {
    return Response.json({ plan: { ...readWords(text), seed }, source: "words" });
  }
}
