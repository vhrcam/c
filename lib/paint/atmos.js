import { mix, rgba } from "../color.js";
import { H, W, clamp, ease, lengths, mask, sprite, vector } from "./brush.js";
import { mist } from "./land.js";

const FULL = [-30, -30, W + 60, H + 60];

function glows(kit, id, list, color, blend = "source-over") {
  const paint = (ctx) => {
    for (const g of list) {
      const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.s * 4.5);
      halo.addColorStop(0, rgba(color, 0.55));
      halo.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(g.x - g.s * 4.5, g.y - g.s * 4.5, g.s * 9, g.s * 9);
      g.body?.(ctx, g);
    }
  };
  kit.add(id, "light", kit.deps("extras"), [sprite(FULL, paint, mask.dabs(list.map((g) => [g.x, g.y, g.s * 5, g.t]), 0.15), { blend, feather: 5 })], 0.7);
}

export function extras(kit) {
  const { L, pal, scene, style } = kit;
  const want = (x) => scene.extras.includes(x);

  if (want("birds")) {
    const r = kit.rng("birds");
    const fx = clamp(L.sun.x + (L.sun.x > W / 2 ? -1 : 1) * r.range(260, 420), 160, W - 160);
    const fy = r.range(140, L.horizon - 230);
    const color = mix(pal.shade, "#1e1a24", 0.4);
    const n = r.int(6, 11);
    const strokes = Array.from({ length: n }, (_, i) => {
      const x = fx + r.gauss() * 130;
      const y = fy + r.gauss() * 50;
      const s = r.range(7, 15);
      const flap = r.range(0.2, 0.7);
      const pts = [[x - s, y - s * flap], [x - s * 0.45, y - s * flap * 0.3], [x, y + s * 0.12], [x + s * 0.45, y - s * flap * 0.3], [x + s, y - s * flap]];
      const lens = lengths(pts);
      return vector((ctx, p) => style.line(ctx, pts, 1.9, color, p, lens), (i / n) * 0.6, 0.35);
    });
    kit.add("birds", "light", kit.deps("extras"), strokes, 0.5);
  }

  if (want("lanterns")) {
    const r = kit.rng("lanterns");
    const warm = pal.mono ? pal.accent : "#ffd27e";
    const edge = pal.mono ? pal.accent : "#e8743a";
    const list = Array.from({ length: r.int(12, 22) }, () => {
      const depth = r();
      return { x: r.range(80, W - 80), y: r.range(90, L.horizon - 70) * (0.55 + depth * 0.5), s: 4 + depth * 11, t: r() };
    });
    list.forEach((g) => {
      g.body = (ctx) => {
        const body = ctx.createLinearGradient(0, g.y - g.s * 0.7, 0, g.y + g.s * 0.7);
        body.addColorStop(0, rgba(warm, 0.95));
        body.addColorStop(1, rgba(edge, 0.95));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.roundRect(g.x - g.s * 0.45, g.y - g.s * 0.65, g.s * 0.9, g.s * 1.3, g.s * 0.25);
        ctx.fill();
      };
    });
    glows(kit, "lanterns", list, pal.mono ? pal.accent : "#ffb04a");
  }

  if (want("fireflies")) {
    const r = kit.rng("fireflies");
    const list = Array.from({ length: r.int(45, 75) }, () => {
      const x = r.range(30, W - 30);
      const top = L.groundAt(x) - 120;
      return { x, y: r.range(top, H - 40), s: r.range(1.4, 3.2), t: r() };
    });
    list.forEach((g) => {
      g.body = (ctx) => {
        ctx.fillStyle = "rgba(255,252,210,0.95)";
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      };
    });
    glows(kit, "fireflies", list, pal.mono ? "#f4f0e6" : "#e9f27a", pal.mono ? "source-over" : "screen");
  }

  if (want("shooting-star")) {
    const r = kit.rng("shooting");
    const right = r.chance(0.5);
    const x0 = right ? r.range(150, W * 0.5) : r.range(W * 0.5, W - 150);
    const y0 = r.range(60, 190);
    const len = r.range(280, 430);
    const a = r.range(0.22, 0.42);
    const dx = Math.cos(a) * (right ? 1 : -1);
    const dy = Math.sin(a);
    kit.add("shooting-star", "light", kit.deps("extras"), [
      vector((ctx, p) => {
        const e = ease(p);
        const hx = x0 + dx * len * e;
        const hy = y0 + dy * len * e;
        const tx = x0 + dx * len * Math.max(0, e - 0.55);
        const ty = y0 + dy * len * Math.max(0, e - 0.55);
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, "rgba(255,250,235,0)");
        g.addColorStop(1, "rgba(255,250,235,0.9)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,252,240,0.9)";
        ctx.beginPath();
        ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }, 0.2, 0.55),
    ], 0.4);
  }
}

export function weather(kit) {
  const { pal, scene, L } = kit;
  if (scene.weather === "rain") {
    const r = kit.rng("rain");
    const color = mix(pal.light, "#d7dde6", 0.6);
    const strokes = Array.from({ length: 300 }, () => {
      const x = r.range(-60, W + 20);
      const y = r.range(-40, H);
      const len = r.range(22, 48);
      return vector((ctx, p) => {
        ctx.strokeStyle = rgba(color, 0.36);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len * 0.22 * p, y + len * p);
        ctx.stroke();
      }, r() * 0.9, 0.1);
    }).sort((a, b) => a.a - b.a);
    kit.add("rain", "light", kit.deps(), strokes, 0.9);
  }
  if (scene.weather === "snow") {
    const r = kit.rng("snowfall");
    const flakes = Array.from({ length: 240 }, () => ({ x: r.range(0, W), y: r.range(0, H), s: r.range(1.4, 4.6), t: r() }));
    const paint = (ctx) => {
      for (const f of flakes) {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.s);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.s, f.y - f.s, f.s * 2, f.s * 2);
      }
    };
    kit.add("snowfall", "light", kit.deps(), [sprite(FULL, paint, mask.dabs(flakes.map((f) => [f.x, f.y, f.s * 3, f.t]), 0.08), { feather: 4 })], 0.9);
  }
  if (scene.weather === "fog") mist(kit, "ground-fog", L.near + 10, 120, 0.7, "light");
}

export function light(kit) {
  const { L, pal, scene } = kit;
  const { x, y } = L.sun;
  const r = kit.rng("light");
  const dim = scene.weather === "rain" ? 0.4 : scene.weather === "clouds" ? 0.7 : 1;

  if (L.shore && scene.weather !== "rain") {
    const strokes = Array.from({ length: 95 }, () => {
      const t = r() ** 0.9;
      const yy = L.horizon + 4 + (L.shore - 16 - L.horizon) * t;
      const xx = x + r.gauss() * (10 + t * 110);
      const len = 5 + t * 34;
      const color = pal.night ? mix(pal.sun, "#ffffff", 0.3) : mix(pal.light, "#ffffff", 0.5);
      return vector((ctx, p) => {
        ctx.globalCompositeOperation = pal.mono ? "source-over" : "screen";
        ctx.strokeStyle = rgba(color, 0.75 - t * 0.35);
        ctx.lineWidth = 1 + t * 2.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(xx - (len / 2) * p, yy);
        ctx.lineTo(xx + (len / 2) * p, yy);
        ctx.stroke();
      }, r() * 0.7, 0.2);
    }).sort((a, b) => a.a - b.a);
    kit.add("glitter", "light", kit.deps(), strokes, 0.6);
  }

  const rays = !pal.night && scene.weather !== "rain" && (scene.place === "forest" || scene.weather === "fog" || (["golden", "sunrise"].includes(scene.time) && r.chance(0.45)));
  if (rays && !pal.mono) {
    const beams = Array.from({ length: 7 }, (_, i) => ({ a: Math.PI / 2 + (i - 3) * 0.13 + r.range(-0.04, 0.04) + (x > W / 2 ? 0.25 : -0.25), w: r.range(0.02, 0.05) }));
    const paint = (ctx) => {
      for (const b of beams) {
        const g = ctx.createLinearGradient(x, y, x + Math.cos(b.a) * 1300, y + Math.sin(b.a) * 1300);
        g.addColorStop(0, rgba(pal.light, 0.2));
        g.addColorStop(1, rgba(pal.light, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(b.a - b.w) * 1500, y + Math.sin(b.a - b.w) * 1500);
        ctx.lineTo(x + Math.cos(b.a + b.w) * 1500, y + Math.sin(b.a + b.w) * 1500);
        ctx.fill();
      }
    };
    kit.add("rays", "light", kit.deps(), [sprite(FULL, paint, mask.sweep("down", 100, kit.seed("rays")), { blend: "screen", feather: 14 })], 0.7);
  }

  if (!pal.mono) {
    const strength = { sunrise: 0.5, sunset: 0.55, golden: 0.46, day: 0.2, night: 0.26 }[scene.time] * dim;
    const bloom = (ctx) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 900);
      g.addColorStop(0, rgba(pal.glow, strength));
      g.addColorStop(0.25, rgba(pal.glow, strength * 0.42));
      g.addColorStop(1, rgba(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(...FULL);
    };
    kit.add("bloom", "light", kit.deps(), [sprite(FULL, bloom, mask.radial(x, y, 1900, kit.seed("bloom")), { blend: "screen", feather: 16 })], 1);
    const wash = (ctx) => {
      const g = ctx.createLinearGradient(x, y, W - x, H);
      g.addColorStop(0, rgba(pal.light, 0.5 * dim));
      g.addColorStop(1, rgba(pal.shade, 0.35));
      ctx.fillStyle = g;
      ctx.fillRect(...FULL);
    };
    kit.add("warmth", "light", kit.deps(), [sprite(FULL, wash, mask.sweep(x < W / 2 ? "right" : "left", 140, kit.seed("warmth")), { blend: "soft-light", feather: 16 })], 0.8);
  }

  const vignette = (ctx) => {
    const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.38, W / 2, H * 0.5, W * 0.78);
    g.addColorStop(0, rgba(pal.shade, 0));
    g.addColorStop(1, rgba(pal.shade, pal.mono ? 0.12 : 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(...FULL);
  };
  kit.add("vignette", "light", kit.deps(), [sprite(FULL, vignette, mask.fade(), { blend: "multiply", feather: 20 })], 0.5);
}
