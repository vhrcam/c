import { askJSON } from "@/lib/ai";
import { EXTRAS, MOODS, PLACES, POSES, STYLES, TIMES, WEATHER, normalize } from "@/lib/scene";
import { edit, read } from "@/lib/words";

const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 40;
}

const hex = { type: "string", description: "A hex color like #b5352d, or an empty string if it isn't mentioned" };

const SCHEMA = {
  type: "object",
  properties: {
    place: { type: "string", enum: PLACES },
    time: { type: "string", enum: TIMES },
    weather: { type: "string", enum: WEATHER },
    extras: { type: "array", items: { type: "string", enum: EXTRAS } },
    mood: { type: "string", enum: MOODS },
    pose: { type: "string", enum: POSES },
    style: { type: "string", enum: STYLES },
    people: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hair: hex,
          hairLength: { type: "string", enum: ["short", "long", "bun", "unknown"] },
          skin: hex,
          top: hex,
          bottom: hex,
          dress: { type: "boolean" },
          height: { type: "number" },
        },
        required: ["hair", "hairLength", "skin", "top", "bottom", "dress", "height"],
      },
    },
    skyTint: hex,
    question: {
      type: "object",
      properties: { ask: { type: "boolean" }, text: { type: "string" }, field: { type: "string", enum: ["place", "time"] } },
      required: ["ask", "text", "field"],
    },
  },
  required: ["place", "time", "weather", "extras", "mood", "pose", "people", "skyTint", "question"],
};

const RULES = `Rules:
- place: the closest of meadow, beach, mountains, forest, lake, city or snow (snowy hills). Open fields, parks, farms and gardens are meadow. Rooftops and streets are city.
- time: sunrise, day, golden (golden hour), sunset or night. If they don't say, pick what suits the memory (golden or sunset flatter romantic moments).
- weather: clear unless they mention clouds, rain, falling snow or fog.
- extras: only things they mention or clearly imply: flowers, stars, fireflies, birds, trees, lanterns, aurora (northern lights), shooting-star.
- mood: warm, dreamy, calm, moody or bright.
- people: one entry per person in the moment, at most 5. The person telling the memory counts when they were there ("I", "me", "we", "us", "our"), so "walking with my girlfriend" is two people and "my family" is usually four. Use no people only for pure scenery. Adults have height 1, children 0.6 to 0.75. Put clothing colors on the right person as hex colors. Set dress true for a dress, gown or skirt, and use top for its color. Hair color as hex and hairLength short, long or bun when mentioned, otherwise "unknown". Skin as hex only if they describe it. Leave anything not mentioned as "".
- pose: kiss, hug, hold (holding hands), sit, walk or stand. Two people with no clear pose: hold.
- style: watercolor unless they ask for oil, storybook, ink or pixel.
- skyTint: "" unless they want the sky to be a certain color.`;

function newPrompt(text, picks) {
  return `You turn someone's description of a memory into a scene for c, an app that paints the moment in code. Fill in the JSON.

${RULES}
- question: set ask to true only when the description gives no setting at all (no place, no time of day, nothing visual). Then text is one short, warm question about where or when it happened, and field is place or time. Otherwise ask is false and text is "".

Tags they already picked, which you must keep exactly: ${JSON.stringify(picks || {})}
Description: """${text}"""`;
}

function editPrompt(text, scene) {
  const { seed, caption, ...current } = scene;
  return `You are changing an existing scene for c, an app that paints a memory in code. Apply the change and return the whole scene as JSON, keeping everything else exactly as it is.

${RULES}
- skyTint: when they want the sky more of a color, set a hex for it (for example a pinker sky is #ff8fb4). Otherwise keep the current value.
- question: ask is false and text is "".

Current scene: ${JSON.stringify(current)}
Change: """${text}"""`;
}

function withPicks(scene, picks = {}) {
  return normalize({
    ...scene,
    place: picks.place || scene.place,
    time: picks.time || scene.time,
    weather: picks.weather || scene.weather,
    extras: [...new Set([...(picks.extras || []), ...scene.extras])],
  });
}

const clean = (out) => ({ ...out, people: (out.people || []).map((f) => ({ ...f, hairLength: f.hairLength === "unknown" ? "" : f.hairLength })) });

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").slice(0, 600);
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const current = body.mode === "edit" && body.scene ? normalize(body.scene) : null;
  const fallback = () => {
    if (current) return { ...edit(text, current), source: "words" };
    return { scene: read(text, body.picks, body.style), source: "words" };
  };

  if (!text || !process.env.GEMINI_API_KEY || limited(ip)) return Response.json(fallback());

  try {
    const out = clean(await askJSON(current ? editPrompt(text, current) : newPrompt(text, body.picks), SCHEMA));
    if (current) return Response.json({ scene: normalize({ ...current, ...out }), changed: true, source: "ai" });
    const scene = withPicks(normalize({ ...out, style: body.style || out.style }), body.picks);
    const question = out.question?.ask && out.question.text ? { text: out.question.text, field: out.question.field } : null;
    return Response.json({ scene, question, source: "ai" });
  } catch {
    return Response.json(fallback());
  }
}
