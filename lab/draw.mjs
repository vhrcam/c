// The line engine's bench: ask the director for a score, look at its raw blocking, render it without a browser.
//   node --env-file=.env.local lab/draw.mjs ask "memory text" slug     → lab/scores/slug.json
//   node lab/draw.mjs flat slug [slug...]                              → lab/runs/draw/flat-slug.png
//   node lab/draw.mjs render slug,slug [seed,seed] [scale]             → lab/runs/draw/slug-seed.png and sheet.png
// STYLE='{"cut":"plumb","sway":"grain"}' forces parts of a piece's temper; COLS and TH shape the sheet.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { compose } from "../lib/draw/compose.js";
import { FORMATS, SCHEMA, brief, parseShape } from "../lib/draw/director.js";
import { cleanScore } from "../lib/draw/stage.js";
import { toSVG } from "../lib/draw/svg.js";

const here = import.meta.dirname;
const out = path.join(here, "runs", "draw");
const scoreOf = async (slug) => JSON.parse(await readFile(path.join(here, "scores", `${slug}.json`), "utf8"));
const [task, ...rest] = process.argv.slice(2);
await mkdir(out, { recursive: true });

async function sheet(files, name, height, cols) {
  if (files.length < 2) return;
  const tiles = await Promise.all(files.map((f) => sharp(f).resize({ height }).toBuffer({ resolveWithObject: true })));
  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));
  const width = Math.max(...rows.map((r) => r.reduce((a, b) => a + b.info.width + 8, 0)));
  const parts = [];
  rows.forEach((r, j) => {
    let x = 0;
    for (const b of r) {
      parts.push({ input: b.data, left: x, top: j * (height + 8) });
      x += b.info.width + 8;
    }
  });
  await sharp({ create: { width, height: rows.length * (height + 8), channels: 3, background: "#000000" } }).composite(parts).png().toFile(path.join(out, name));
  console.log(`sheet → lab/runs/draw/${name}`);
}

if (task === "ask") {
  const { GoogleGenAI } = await import("@google/genai");
  const [text, slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)] = rest;
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 } } });
  for (const model of (process.env.MODEL || "gemini-3.5-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-3.5-flash-lite").split(",")) {
    const t = Date.now();
    try {
      const res = await client.models.generateContent({ model, contents: brief(text), config: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, abortSignal: AbortSignal.timeout(120000) } });
      const score = JSON.parse(res.text);
      await mkdir(path.join(here, "scores"), { recursive: true });
      await writeFile(path.join(here, "scores", `${slug}.json`), JSON.stringify({ text, ...score }, null, 1));
      const all = score.forms.flatMap((f) => f.shapes);
      const bad = all.filter((s) => !parseShape(s));
      console.log(`${model} ${Date.now() - t}ms | ${score.title} | ${score.format} ${score.time} ${score.weather} ${score.backdrop} | ${score.forms.length} forms, ${all.length} shapes, ${bad.length} unread`);
      console.log(score.reading);
      console.log(score.forms.map((f) => `  ${f.role} ${f.name} (${f.shapes.length})${f.scatter ? ` x${f.scatter.count}` : ""}`).join("\n"));
      if (bad.length) console.log(`unread:\n  ${bad.join("\n  ")}`);
      break;
    } catch (e) {
      console.log("failed", model, Date.now() - t, "ms", String(e.message || e).slice(0, 160));
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
} else if (task === "flat") {
  const files = [];
  for (const slug of rest) {
    const score = await scoreOf(slug);
    const [W, H] = FORMATS[score.format] || FORMATS.wide;
    const marks = [];
    for (const form of score.forms)
      for (const s of form.shapes.map(parseShape).filter(Boolean)) {
        if (s.type === "band") marks.push(`<polygon points="${[[0, s.pts[0][1]], ...s.pts, [W, s.pts.at(-1)[1]], [W, H], [0, H]].map((q) => q.join(",")).join(" ")}" fill="${s.color}"/>`);
        else if (s.type === "tube") marks.push(`<polyline points="${s.pts.map((q) => `${q[0]},${q[1]}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="${2 * Math.max(...s.pts.map((q) => q[2]))}" stroke-linecap="round" stroke-linejoin="round"/>`);
        else if (s.type === "blob") marks.push(`<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" transform="rotate(${s.tilt} ${s.x} ${s.y})" fill="${s.color}"/>`);
        else marks.push(`<polygon points="${s.pts.map((q) => q.join(",")).join(" ")}" fill="${s.color}"/>`);
      }
    const file = path.join(out, `flat-${slug}.png`);
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * 6}" height="${H * 6}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#e9e4d8"/>${marks.join("")}</svg>`)).png().toFile(file);
    files.push(file);
    console.log(`${slug} → lab/runs/draw/flat-${slug}.png`);
  }
  await sheet(files, "flat-sheet.png", 480, 6);
} else if (task === "render") {
  const seeds = (rest[1] || "7").split(",").map(Number);
  const scale = Number(rest[2] || 8);
  const style = process.env.STYLE ? { style: JSON.parse(process.env.STYLE) } : {};
  const files = [];
  for (const slug of rest[0].split(",")) {
    const raw = await scoreOf(slug);
    for (const seed of seeds) {
      const t = performance.now();
      const art = compose(cleanScore(raw, raw.text, seed), seed, style);
      const ms = Math.round(performance.now() - t);
      const file = path.join(out, `${slug}-${seed}.png`);
      await sharp(Buffer.from(toSVG(art, { scale, margin: 6 })), { limitInputPixels: false, unlimited: true }).png().toFile(file);
      const m = art.meta;
      console.log(`${slug} ${seed}: ${ms}ms, ${art.strokes.length} strokes, ${m.paper} ${m.cut} ${m.sky} ${m.pen} ${m.press} ${m.frame} ${m.event} ${m.sway}`);
      files.push(file);
    }
  }
  await sheet(files, "sheet.png", Number(process.env.TH || 520), Number(process.env.COLS || 3));
} else console.log("usage: lab/draw.mjs ask|flat|render (see the top of the file)");
