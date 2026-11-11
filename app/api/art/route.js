import { askJSON, askLive } from "@/lib/ai";
import { SCHEMA, brief } from "@/lib/draw/director";
import { cleanScore } from "@/lib/draw/stage";
import { wordsScore } from "@/lib/draw/words";

// Streams one JSON object per line: notes while the director reads and blocks the scene, then the score itself.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 600);
  const earlier = (Array.isArray(body.earlier) ? body.earlier : []).slice(-3).map((l) => String(l).slice(0, 500)).filter(Boolean);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      const offline = () => send({ plan: wordsScore(text, seed), source: "words" });
      if (!text || !process.env.GEMINI_API_KEY) {
        offline();
        return controller.close();
      }
      // source says who blocked the scene: "ai" one of the stronger models, "light" the quick one, "words" nobody
      const score = (raw, source = "ai") => {
        const plan = cleanScore(raw, text, seed);
        if (!plan.forms.length) throw new Error("empty score");
        send({ plan, source });
      };
      const prompt = brief(text, earlier);
      const began = Date.now();
      try {
        const told = await askLive(prompt, SCHEMA, (note) => send({ note }));
        score(told.score, told.light ? "light" : "ai");
      } catch {
        try {
          if (Date.now() - began > 70000) throw new Error("out of time");
          score(await askJSON(prompt, SCHEMA, 30000));
        } catch {
          offline();
        }
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
