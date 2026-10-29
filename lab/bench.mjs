import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const run = args.run || new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const sets = (args.set || "tuning,heldout").split(",");
const n = Number(args.n || 3);
const base = args.url || "http://localhost:3000";
const root = path.resolve("lab/runs", run);
const bench = JSON.parse(await readFile("lab/bench.json", "utf8"));
const memories = sets.flatMap((s) => bench[s].map((text) => ({ set: s, text }))).filter((m) => !args.only || args.only.split("|").some((o) => m.text.startsWith(o)));
await mkdir(root, { recursive: true });

const plans = args.plans ? JSON.parse(await readFile(args.plans, "utf8")) : {};
for (const m of memories) {
  if (plans[m.text]) continue;
  const res = await fetch(`${base}/api/art`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: m.text }) });
  const json = await res.json();
  plans[m.text] = { ...json.plan, source: json.source };
}
await writeFile(path.join(root, "plans.json"), JSON.stringify(plans, null, 1));

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const corr = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message));
await page.goto(`${base}/lab/render`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.cLab, { timeout: 120000 });
const rows = [];
for (const m of memories) {
  const slug = m.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
  let out = [];
  try {
    out = await page.evaluate((plan, count, force) => window.cLab.series(plan, count, 1009, force), plans[m.text], n, args.force ? args.force.split(",") : []);
  } catch (e) {
    console.log("FAIL", m.text, e.message.slice(0, 200));
  }
  const cands = [];
  for (const [k, c] of out.entries()) {
    const file = `${slug}-${k}.png`;
    await writeFile(path.join(root, file), Buffer.from(c.png.split(",")[1], "base64"));
    cands.push({ file, meta: c.meta, empty: c.empty, ms: c.ms, thumb: c.thumb });
  }
  const div = [];
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) div.push(1 - corr(cands[i].thumb, cands[j].thumb));
  rows.push({ ...m, diversity: mean(div), empty: mean(cands.map((c) => c.empty)), plan: plans[m.text], cands: cands.map(({ thumb, ...c }) => c) });
}
await writeFile(path.join(root, "report.json"), JSON.stringify(rows, null, 1));

const label = (meta = {}) => Object.entries(meta).filter(([k, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => `${k} ${v}`).join(" · ");
const html = `<!doctype html><meta charset="utf-8"><title>bench ${run}</title><style>body{background:#11100e;color:#ece7dd;font:12px ui-monospace,monospace;margin:24px}h2{font-size:12px;font-weight:400;color:#ece7ddaa;margin:28px 0 8px}.row{display:grid;grid-template-columns:repeat(${n},1fr);gap:10px}img{width:100%;display:block;border-radius:3px}p{margin:4px 0 0;color:#ece7dd66;font-size:10px;line-height:1.4}</style><h1 style="font-size:13px">bench ${run}</h1>${rows.map((r) => `<h2>[${r.set}] “${r.text}” · diversity ${r.diversity.toFixed(2)} · empty ${(r.empty * 100).toFixed(0)}%</h2><div class="row">${r.cands.map((c) => `<div><img src="${c.file}"><p>${label(c.meta)} · ${c.ms}ms · empty ${(c.empty * 100).toFixed(0)}%</p></div>`).join("")}</div>`).join("")}`;
await writeFile(path.join(root, "index.html"), html);
const sheet = await browser.newPage();
await sheet.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
await sheet.goto(`file://${path.join(root, "index.html")}`, { waitUntil: "load" });
await sheet.screenshot({ path: path.join(root, "sheet.png"), fullPage: true });
await browser.close();

for (const r of rows) console.log(`${r.set.padEnd(8)} div ${r.diversity.toFixed(2)} empty ${(r.empty * 100).toFixed(0).padStart(3)}%  ${r.text.slice(0, 60)}  ${r.cands.map((c) => c.meta?.direction || "?").join(",")}`);
console.log(`saved ${root}`);
