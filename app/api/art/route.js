import { askJSON } from "@/lib/ai";
import { AGES, DIRECTIONS, FEATURES, FOCUS, GENDERS, MOODS, PLACES, TIMES, WEATHER, normalizePlan, readWords } from "@/lib/art/plan";
import { POSES } from "@/lib/art/people";

const str = { type: "string" };
const enumOf = (values) => ({ type: "string", enum: values });

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
    setting: { type: "object", properties: { place: enumOf(PLACES), features: { type: "array", items: enumOf(FEATURES) }, time: enumOf(TIMES), weather: enumOf(WEATHER) }, required: ["place", "features", "time", "weather"] },
    mood: enumOf(MOODS),
    energy: { type: "number" },
    directions: { type: "array", items: enumOf(DIRECTIONS) },
  },
  required: ["title", "read", "people", "focus", "setting", "mood", "energy", "directions"],
};

const prompt = (text) => `You are the art director inside c. Someone describes a memory. You never draw. You decide what the artwork is about and how c's own procedural renderer should approach it; c's code draws every mark.

Decide:
- title: 1 to 4 lowercase words, plain and evocative.
- read: one sentence saying what a viewer should recognize first.
- people: who is in the memory (0, 1 or 2 people; c draws at most two). pose: embrace (kissing, hugging, slow dancing), sit (sitting together, watching something), stand (standing, looking out), walk, run (racing, running), alone (one person standing still). If the memory is about a place and nobody is doing anything, count can be 0.
  subjects: one entry per person, label in their own words ("me", "her", "my brother", "someone"). Record ONLY what the memory states or its words directly imply: gender is woman or man only when the text says so (her, she, wife, mom, brother, two women...), otherwise unspecified ("me", "two people", "my partner" are unspecified). age is child or elder only when stated (my son, my grandma), otherwise unspecified. hair, clothing and appearance stay empty unless the memory mentions them. Never invent identities, costumes or looks; c decides unspecified details itself.
- focus: people when the relationship is the heart of it, place when the place is ("the lake behind my grandparents' cabin"), moment when an action or event is.
- setting: the place it happened (pick the closest), features that were really there (sun for sunrise and sunset, moon, stars, trees, mountains, water, buildings, road, birds, dock, house, cabin), time of day and weather. Infer a natural setting when they don't say, but never invent a sunset unless they mention evening, sunset or golden light.
- mood and energy (0 calm to 1 intense).
- directions: rank all eight constructions by fit for this memory. expressive: painterly brush strokes. geometric: adaptive faceted planes. organic: textured masses, strata and branching light. lines: engraving where line width carries light. mosaic: Voronoi cells that shrink where the memory matters. contours: a topographic map of the scene's light. stipple: dots that gather in shadow and link into networks. grid: a quadtree of rectangles, finest where the memory is.

Memory: """${text}"""`;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 600);
  const seed = Math.floor(Math.random() * 2 ** 31);
  if (!text) return Response.json({ plan: readWords(""), source: "words" });
  if (!process.env.GEMINI_API_KEY) return Response.json({ plan: { ...readWords(text), seed }, source: "words" });
  try {
    const raw = await askJSON(prompt(text), SCHEMA, 20000);
    return Response.json({ plan: normalizePlan({ ...raw, text, seed }), source: "ai" });
  } catch {
    return Response.json({ plan: { ...readWords(text), seed }, source: "words" });
  }
}
