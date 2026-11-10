import { GoogleGenAI } from "@google/genai";

const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite"];
let client;

export async function askJSON(prompt, schema, timeout = 12000) {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 } } });
  let lastError;
  const deadline = Date.now() + timeout * 1.6;
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    try {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: schema, abortSignal: AbortSignal.timeout(Math.min(timeout, left)) },
      });
      return JSON.parse(res.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const quoted = (key) => new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g");
const unquote = (s) => {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
};

// The same request, streamed: onNote hears what the model is thinking about and each named thing as it is written.
// The two stronger models block a scene far better than the light one, and they are often only busy for a moment,
// so each gets a second try before the light one is asked.
export async function askLive(prompt, schema, onNote, budget = 105000) {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 } } });
  let lastError;
  const deadline = Date.now() + budget;
  const order = [models[0], models[1], models[0], models[1], models[2]];
  for (const [turn, model] of order.entries()) {
    if (turn === 2 || turn === 3) await new Promise((r) => setTimeout(r, 2500));
    const left = deadline - Date.now();
    if (left < 12000) break;
    try {
      const stream = await client.models.generateContentStream({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: schema, thinkingConfig: { includeThoughts: true }, abortSignal: AbortSignal.timeout(left) },
      });
      let text = "";
      let said = "";
      let forms = 0;
      const told = new Set();
      for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts || []) {
          if (!part.text) continue;
          if (part.thought) {
            const head = [...part.text.matchAll(/\*\*(.+?)\*\*/g)].pop()?.[1];
            if (head && head !== said) onNote({ think: (said = head) });
            continue;
          }
          text += part.text;
          for (const key of ["title", "reading"]) {
            if (told.has(key)) continue;
            const m = quoted(key).exec(text);
            if (!m) continue;
            told.add(key);
            onNote({ [key]: unquote(m[1]) });
          }
          const names = [...text.matchAll(quoted("name"))];
          while (forms < names.length) onNote({ form: unquote(names[forms++][1]) });
        }
      }
      return JSON.parse(text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
    } catch (e) {
      lastError = e;
      onNote({ reset: true });
    }
  }
  throw lastError;
}
