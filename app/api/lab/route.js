import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const file = path.join(process.cwd(), "lab/plans.json");

export async function POST(request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const { text, plan, verdict, note } = await request.json().catch(() => ({}));
  if (!text) return new Response(null, { status: 400 });
  const all = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
  const entry = { ...all[text] };
  if (plan) Object.assign(entry, { plan, verdict: "", at: Date.now() });
  if (verdict !== undefined) entry.verdict = verdict;
  if (note !== undefined) entry.note = String(note).slice(0, 300);
  all[text] = entry;
  await writeFile(file, JSON.stringify(all, null, 1) + "\n");
  return Response.json(entry);
}
