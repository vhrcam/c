import { GoogleGenAI } from "@google/genai";

const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview"];
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
