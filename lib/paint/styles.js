import { adjust, rgba } from "../color.js";
import { blob, bounds, curve, deform, fillStyle, resample, ribbon, sample, trace } from "./brush.js";

function granulate(ctx, poly, fill, r, amount) {
  const [x0, y0, x1, y1] = bounds(poly);
  const count = Math.min(3200, ((x1 - x0) * (y1 - y0)) / 280) * amount;
  ctx.save();
  trace(ctx, poly);
  ctx.clip();
  for (let i = 0; i < count; i++) {
    const x = r.range(x0, x1);
    const y = r.range(y0, y1);
    const s = r.range(0.6, 1.9);
    ctx.fillStyle = rgba(adjust(sample(fill, x, y), { l: -0.12 }), r.range(0.05, 0.18));
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function bristle(ctx, x, y, angle, len, size, color, r) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const bend = r.range(-0.12, 0.12) * len;
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    const o = (k - 1) * size * 0.33;
    const ox = -s * o;
    const oy = c * o;
    ctx.strokeStyle = rgba(k === 0 ? adjust(color, { l: 0.06 }) : k === 2 ? adjust(color, { l: -0.04 }) : color, 0.6 + r() * 0.35);
    ctx.lineWidth = size * 0.45;
    ctx.beginPath();
    ctx.moveTo(x - (c * len) / 2 + ox, y - (s * len) / 2 + oy);
    ctx.quadraticCurveTo(x + ox - s * bend, y + oy + c * bend, x + (c * len) / 2 + ox, y + (s * len) / 2 + oy);
    ctx.stroke();
  }
}

const watercolor = {
  soft: true,
  sketch: true,
  area(ctx, poly, fill, r, o = {}) {
    const spread = o.spread ?? 12;
    const alpha = o.alpha ?? 0.11;
    const base = deform(resample(poly, 36), 2, spread, r);
    for (let i = 0; i < (o.layers ?? 15); i++) {
      ctx.fillStyle = fillStyle(ctx, fill, alpha);
      trace(ctx, deform(base, 1, spread * 0.6, r));
      ctx.fill();
    }
    ctx.strokeStyle = fillStyle(ctx, fill, 0.16);
    ctx.lineWidth = 1.3;
    trace(ctx, base);
    ctx.stroke();
    if (o.grain !== 0) granulate(ctx, base, fill, r, o.grain ?? 1);
  },
  line(ctx, pts, width, color, p, lens) {
    ctx.fillStyle = rgba(color, 0.2);
    ribbon(ctx, pts, width * 1.8, p, undefined, lens);
    ctx.fillStyle = rgba(color, 0.82);
    ribbon(ctx, pts, width, p, undefined, lens);
  },
  dab(ctx, x, y, rad, color, r, a = 1) {
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rgba(color, 0.32 * a);
      trace(ctx, blob(x, y, rad, rad * 0.92, r, 0.3, 10));
      ctx.fill();
    }
  },
};

const oil = {
  soft: false,
  sketch: true,
  area(ctx, poly, fill, r, o = {}) {
    if (o.opacity) return watercolor.area(ctx, poly, fill, r, o);
    ctx.fillStyle = fillStyle(ctx, fill, 1);
    trace(ctx, deform(resample(poly, 30), 1, 3, r));
    ctx.fill();
    ctx.save();
    trace(ctx, poly);
    ctx.clip();
    const [x0, y0, x1, y1] = bounds(poly);
    const size = o.size ?? 10;
    const len = o.length ?? 30;
    const count = Math.min(o.max ?? 2400, ((x1 - x0) * (y1 - y0)) / (size * len * 0.55));
    for (let i = 0; i < count; i++) {
      const x = r.range(x0, x1);
      const y = r.range(y0, y1);
      const c = adjust(sample(fill, x, y), { l: r.range(-0.045, 0.05), s: r.range(-0.05, 0.06), h: r.range(-5, 5) });
      bristle(ctx, x, y, (o.flow ?? 0) + r.gauss() * (o.spin ?? 0.12), len * r.range(0.6, 1.25), size * r.range(0.7, 1.2), c, r);
    }
    ctx.restore();
  },
  line(ctx, pts, width, color, p, lens) {
    ctx.fillStyle = rgba(color, 0.95);
    ribbon(ctx, pts, width * 1.1, p, [0.08, 0.22], lens);
    ctx.fillStyle = rgba(adjust(color, { l: 0.09 }), 0.5);
    ribbon(ctx, pts.map(([x, y]) => [x - width * 0.18, y - width * 0.18]), width * 0.4, p, [0.1, 0.3], lens);
  },
  dab(ctx, x, y, rad, color, r, a = 1) {
    ctx.globalAlpha = a;
    bristle(ctx, x, y, r.range(-0.6, 0.6), rad * 2.2, rad * 1.4, color, r);
    ctx.globalAlpha = 1;
  },
};

const storybook = {
  soft: false,
  sketch: true,
  rounded: true,
  area(ctx, poly, fill, r, o = {}) {
    const shape = resample(poly, 26);
    ctx.fillStyle = fillStyle(ctx, fill, o.opacity ?? 1);
    curve(ctx, shape);
    ctx.fill();
    if (o.shade === false) return;
    const [x0, y0, x1, y1] = bounds(poly);
    ctx.save();
    curve(ctx, shape);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(255,250,240,0.12)");
    g.addColorStop(0.45, "rgba(255,250,240,0)");
    g.addColorStop(1, "rgba(25,18,35,0.13)");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  },
  line(ctx, pts, width, color, p, lens) {
    ctx.fillStyle = color;
    ribbon(ctx, pts, width, p, undefined, lens);
  },
  dab(ctx, x, y, rad, color, r, a = 1) {
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  },
};

const ink = {
  soft: true,
  sketch: true,
  area(ctx, poly, fill, r, o = {}) {
    watercolor.area(ctx, poly, fill, r, { layers: 8, spread: (o.spread ?? 12) * 1.25, alpha: 0.17, grain: 1.5 });
  },
  line(ctx, pts, width, color, p, lens) {
    ctx.fillStyle = rgba(color, 0.9);
    ribbon(ctx, pts, width, p, [0.05, 0.5], lens);
  },
  dab: watercolor.dab,
};

const pixel = {
  soft: false,
  sketch: false,
  pixel: 5,
  area(ctx, poly, fill, r, o = {}) {
    storybook.area(ctx, poly, fill, r, { ...o, shade: false });
  },
  line: storybook.line,
  dab: storybook.dab,
};

export const STYLE = { watercolor, oil, storybook, ink, pixel };
