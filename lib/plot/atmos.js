import { hidden, pickBand } from "./world.js";

function windDir(ctx) {
  const { cam, wind } = ctx;
  const sx = wind[0] * cam.right[0] + wind[2] * cam.right[2];
  const sy = -(wind[1] * cam.up[1] + 0.12);
  const l = Math.hypot(sx, sy) || 1;
  return [sx / l, sy / l, Math.min(1, Math.hypot(wind[0], wind[2]) / 0.8)];
}

function free(ctx, x, y) {
  const { w, h, blocked, F } = ctx;
  return x > 2 && y > 2 && x < w - 2 && y < h - 2 && !blocked(x, y) && F.codeAt(x, y) < 16 && !hidden(ctx, x, y);
}

function petal(x, y, s, a) {
  const pts = [];
  for (let k = 0; k <= 8; k++) {
    const t = (k / 8) * Math.PI * 2;
    const r = s * (0.55 + 0.45 * Math.cos(t));
    const px = Math.cos(t) * r;
    const py = Math.sin(t) * r * 0.45;
    pts.push(x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a));
  }
  return pts;
}

function seedHead(x, y, s, a, pen, width, order) {
  const out = [];
  out.push({ pts: [x, y, x - Math.cos(a) * s * 1.6, y - Math.sin(a) * s * 1.6], pen, width, layer: "drift", order });
  for (let k = 0; k < 6; k++) {
    const b = a + (k / 5 - 0.5) * 2.2;
    out.push({ pts: [x, y, x + Math.cos(b) * s, y + Math.sin(b) * s], pen, width: width * 0.8, layer: "drift", order: order + k * 1e-4 });
  }
  return out;
}

export function atmosLines(ctx, setting) {
  const { w, h, horizon, rng, pal, sun } = ctx;
  const [dx, dy, gust] = windDir(ctx);
  const lines = [];
  const night = pal.time === "night";
  const kind = setting === "shore" ? "spray" : rng.pick(["petals", "seeds", "leaves"]);
  const count = Math.round(rng.range(35, 80) * (0.6 + gust));
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0.15, setting === "shore" ? 0.85 : 0.95) * h;
    if (!free(ctx, x, y)) continue;
    const near = Math.min(1, Math.max(0.2, (y - horizon * 0.6) / (h - horizon * 0.6)));
    const s = (3.5 + near * 7) * rng.range(0.7, 1.3);
    const a = Math.atan2(dy, dx) + rng.range(-0.9, 0.9);
    const order = x / w;
    if (kind === "petals") lines.push({ pts: petal(x, y, s, a), pen: rng.chance(0.75) ? pal.accent : pal.sun[1], width: 0.9, layer: "drift", order });
    else if (kind === "leaves") {
      lines.push({ pts: petal(x, y, s * 1.2, a), pen: pickBand(pal.ground, 0.6, rng, 0.6), width: 0.9, layer: "drift", order });
      lines.push({ pts: [x - Math.cos(a) * s * 0.9, y - Math.sin(a) * s * 0.9, x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9], pen: pickBand(pal.ground, 0.4, rng, 0.4), width: 0.7, layer: "drift", order: order + 1e-4 });
    } else if (kind === "seeds") lines.push(...seedHead(x, y, s * 0.9, a, night ? pal.sun[1] : pal.ink, 0.6, order));
    else if (y > horizon) {
      const n = rng.int(2, 4);
      for (let k = 0; k < n; k++) {
        const ox = x + rng.range(-s, s) * 2;
        const oy = y + rng.range(-s, s);
        if (free(ctx, ox, oy)) lines.push({ pts: [ox, oy, ox + dx * s * 0.5, oy + dy * s * 0.5], pen: pal.paper === pal.ink ? pal.ink : pickBand(pal.sky, 0.2, rng, 0.3), width: 0.9, layer: "drift", order: order + k * 1e-4 });
      }
    }
  }

  const streaks = Math.round(rng.range(2, 6) * gust);
  for (let i = 0; i < streaks; i++) {
    let x = rng.range(-0.1, 0.9) * w;
    let y = rng.range(0.12, 0.7) * horizon;
    const len = rng.range(220, 520);
    const amp = rng.range(4, 12);
    const ph = rng.range(0, 6.28);
    const pts = [];
    let run = [];
    const pen = pickBand(pal.sky, 0.55, rng, 0.3);
    for (let t = 0; t <= len; t += 4) {
      const px = x + dx * t - dy * Math.sin(ph + t * 0.018) * amp;
      const py = y + dy * t + dx * Math.sin(ph + t * 0.018) * amp;
      if (free(ctx, px, py) && ctx.isSky(px, py)) run.push(px, py);
      else if (run.length) {
        if (run.length >= 6) pts.push(run);
        run = [];
      }
    }
    if (run.length >= 6) pts.push(run);
    for (const p of pts) lines.push({ pts: p, pen, width: 1.15, layer: "drift", order: 0.5 + i * 0.01 });
    if (rng.chance(0.6) && pts.length) {
      const last = pts[pts.length - 1];
      const ex = last[last.length - 2];
      const ey = last[last.length - 1];
      const curl = [];
      for (let k = 0; k <= 12; k++) {
        const t = (k / 12) * Math.PI * 1.6;
        curl.push(ex + (dx * Math.sin(t) - dy * (1 - Math.cos(t))) * amp * 1.6, ey + (dy * Math.sin(t) + dx * (1 - Math.cos(t))) * amp * 1.6);
      }
      if (curl.every((v, k) => (k % 2 ? true : free(ctx, v, curl[k + 1])))) lines.push({ pts: curl, pen, width: 1.15, layer: "drift", order: 0.5 + i * 0.01 + 0.001 });
    }
  }

  if (sun && !night) {
    const [sx, sy, R] = sun;
    for (let i = rng.int(10, 26); i > 0; i--) {
      const a = rng.range(0, Math.PI * 2);
      const r = R * rng.range(1.3, 2.6);
      const x = sx + Math.cos(a) * r;
      const y = sy + Math.sin(a) * r;
      if (!free(ctx, x, y)) continue;
      const s = rng.range(1, 2.4);
      const pen = rng.chance(0.6) ? pal.sun[1] : pal.sun[0];
      lines.push({ pts: [x - s, y, x + s, y], pen, width: 0.9, layer: "drift", order: 0.9 });
      lines.push({ pts: [x, y - s, x, y + s], pen, width: 0.9, layer: "drift", order: 0.9001 });
    }
  }
  return lines;
}
