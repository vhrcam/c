import { random } from "../random";
import { patternsOf } from "../plot/compose.js";
import { detailLines } from "../plot/details.js";
import { faceLines, figureLines, foldLines, toneField } from "../plot/figurelines.js";
import { hairLines } from "../plot/hairlines.js";
import { handLines } from "../plot/handlines.js";

const TAPER = new Set(["outline", "hair", "hatch", "face", "hands", "details", "folds"]);

// the plotter's figure line work for a staged scene, mapped into the artwork's coordinates
export function oldLines(fg, seed) {
  const { scene, cam, F, pens, figPal } = fg.st;
  const rng = random((seed ^ 0x9d2c5680) >>> 0);
  const out = [...figureLines(F, { pens, rng, tone: toneField(F, 0.9), patterns: patternsOf(scene) }), ...faceLines(scene, cam, F, pens), ...handLines(scene, cam, F, pens), ...detailLines(scene, cam, F, pens, seed), ...hairLines(scene, cam, F, pens, figPal, seed), ...foldLines(scene, cam, F, pens, rng)];
  return out.map((l) => ({ ...l, pts: fg.map(l.pts), width: (l.width || 1) * fg.k * (TAPER.has(l.layer) ? 1.3 : 1), taper: TAPER.has(l.layer), alpha: l.alpha ?? 0.9 }));
}

// the staged bodies' silhouettes, filled close to paper so they hide the world behind them the way the plotter's people did
function silhouette(fg) {
  const { F, pens } = fg.st;
  const cv = document.createElement("canvas");
  cv.width = F.W;
  cv.height = F.H;
  const g = cv.getContext("2d");
  const img = g.createImageData(F.W, F.H);
  const paper = [247, 242, 233];
  const memo = new Map();
  const colour = (code) => {
    if (!memo.has(code)) {
      const [lite] = pens.fill(code & 15, code >> 4) || ["#d8d0c4"];
      const c = [1, 3, 5].map((i) => parseInt(String(lite).slice(i, i + 2), 16) || 200);
      // skin is pale paper with a hint of its tone, like the plotter drew it, so hands and necks never read as dark holes;
      // clothes keep enough of their colour that trousers and shoes never look blank
      const wash = { 1: 0.66, 2: 0.6, 3: 0.6, 4: 0.72, 5: 0.5, 6: 0.68, 7: 0.35, 9: 0.62 }[code & 15] ?? 0.75;
      memo.set(code, c.map((v, i) => v + (paper[i] - v) * wash));
    }
    return memo.get(code);
  };
  for (let i = 0; i < F.code.length; i++) {
    const code = F.code[i];
    if (code < 16) continue;
    const c = colour(code);
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// the people layer: silhouettes, then every line of the plotter's figure work, then a dusk or night wash over both
export function oldLayer(fg, seed, scale, dim = 1) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(1500 * scale);
  cv.height = Math.round(1000 * scale);
  const ctx = cv.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const { F } = fg.st;
  const T = fg.st.T;
  ctx.drawImage(silhouette(fg), 0, 0, F.W, F.H, T.tx, T.ty, F.w * T.k, F.h * T.k);
  drawOld(ctx, fg, seed);
  if (dim < 1) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(18,22,44,${(1 - dim) * 0.9})`;
    ctx.fillRect(0, 0, 1500, 1000);
    ctx.globalCompositeOperation = "source-over";
  }
  return cv;
}

export function drawOld(ctx, fg, seed) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const l of oldLines(fg, seed)) {
    const p = l.pts;
    const n = p.length / 2;
    if (n < 2) continue;
    ctx.globalAlpha = l.alpha;
    if (l.taper && n > 2) {
      const cum = [0];
      for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]));
      const total = cum[n - 1] || 1;
      const left = [];
      const right = [];
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(n - 1, i + 1);
        const tx = p[b * 2] - p[a * 2];
        const ty = p[b * 2 + 1] - p[a * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        const hw = (l.width / 2) * (0.07 + 0.93 * Math.sin((Math.PI * cum[i]) / total) ** 0.4);
        left.push([p[i * 2] - (ty / tl) * hw, p[i * 2 + 1] + (tx / tl) * hw]);
        right.push([p[i * 2] + (ty / tl) * hw, p[i * 2 + 1] - (tx / tl) * hw]);
      }
      ctx.beginPath();
      [...left, ...right.reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = l.pen;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
      ctx.strokeStyle = l.pen;
      ctx.lineWidth = l.width;
      ctx.stroke();
    }
  }
  ctx.restore();
}
