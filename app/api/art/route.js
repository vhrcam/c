import { askJSON } from "@/lib/ai";
import { SCHEMA, brief } from "@/lib/draw/director";
import { cleanScore } from "@/lib/draw/stage";
import { wordsScore } from "@/lib/draw/words";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 600);
  const earlier = (Array.isArray(body.earlier) ? body.earlier : []).slice(-3).map((l) => String(l).slice(0, 500)).filter(Boolean);
  const seed = Math.floor(Math.random() * 2 ** 31);
  if (!text) return Response.json({ plan: wordsScore("", seed), source: "words" });
  if (!process.env.GEMINI_API_KEY) return Response.json({ plan: wordsScore(text, seed), source: "words" });
  try {
    const plan = cleanScore(await askJSON(brief(text, earlier), SCHEMA, 48000), text, seed);
    if (!plan.forms.length) throw new Error("empty score");
    return Response.json({ plan, source: "ai" });
  } catch {
    return Response.json({ plan: wordsScore(text, seed), source: "words" });
  }
}
