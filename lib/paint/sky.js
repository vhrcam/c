import { lerpStops, mix, rgba } from "../color.js";
import { W, blob, clamp, mask, sprite } from "./brush.js";

export function skyWash(kit) {
  const { L, pal, scene, style } = kit;
  const bottom = L.horizon + 70;
  const poly = [[-60, -60], [W + 60, -60], [W + 60, bottom], [-60, bottom]];
  const fill = { y0: -20, y1: L.horizon, stops: pal.sky };
  const glow = { sunrise: 0.5, sunset: 0.6, golden: 0.45, day: 0.2, night: 0.22 }[scene.time];
  const paint = (ctx) => {
    style.area(ctx, poly, fill, kit.rng("sky"), { layers: 14, alpha: pal.mono ? 0.05 : 0.12, spread: 18, grain: 0.5 });
    const g = ctx.createRadialGradient(L.sun.x, L.sun.y, 0, L.sun.x, L.sun.y, 720);
    g.addColorStop(0, rgba(pal.glow, glow));
    g.addColorStop(0.35, rgba(pal.glow, glow * 0.4));
    g.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, bottom + 30);
  };
  kit.add("sky", "wash", kit.deps("skyTint"), [sprite([-30, -30, W + 60, bottom + 30], paint, mask.bands(7, 0.02, kit.seed("sky")), { feather: 18, res: 0.6 })], 1.6);
}

function stars(kit) {
  const { L, pal, scene } = kit;
  if (!pal.night && !scene.extras.includes("stars")) return;
  const r = kit.rng("stars");
  const top = pal.night ? L.horizon - 60 : L.horizon * 0.42;
  const list = Array.from({ length: pal.night ? 210 : 70 }, () => {
    const y = top * r() ** 1.3;
    return { x: r.range(0, W), y, s: r() ** 3 * 2.2 + 0.5, a: r.range(0.35, 1) * (pal.night ? 1 : 1 - y / top), t: r() };
  });
  const color = pal.mono ? "#f4f0e6" : "#fff8e6";
  const paint = (ctx) => {
    for (const s of list) {
      ctx.fillStyle = rgba(color, s.a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
      if (s.s > 1.9) {
        ctx.strokeStyle = rgba(color, s.a * 0.45);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(s.x - s.s * 4, s.y);
        ctx.lineTo(s.x + s.s * 4, s.y);
        ctx.moveTo(s.x, s.y - s.s * 4);
        ctx.lineTo(s.x, s.y + s.s * 4);
        ctx.stroke();
      }
    }
  };
  kit.add("stars", "shapes", kit.deps("extras"), [sprite([0, 0, W, L.horizon], paint, mask.dabs(list.map((s) => [s.x, s.y, s.s * 6, s.t]), 0.05), { feather: 3 })], 0.7);
}

function aurora(kit) {
  const { pal, scene } = kit;
  if (!scene.extras.includes("aurora")) return;
  const r = kit.rng("aurora");
  const n = kit.noise("aurora");
  const curtains = Array.from({ length: 280 }, (_, i) => {
    const x = (i / 280) * (W + 200) - 100;
    return { x, y: 230 + (n(x * 0.0011, 3) - 0.5) * 260, len: 90 + n(x * 0.004 + 9, 2) * 240 * r.range(0.7, 1.1), a: 0.5 + n(x * 0.01 + 3) * 0.5 };
  });
  const green = pal.finish("#62e0a2");
  const violet = pal.finish("#8f6ad8");
  const paint = (ctx) => {
    for (const c of curtains) {
      const g = ctx.createLinearGradient(0, c.y, 0, c.y - c.len);
      g.addColorStop(0, rgba(green, 0));
      g.addColorStop(0.12, rgba(green, 0.24 * c.a));
      g.addColorStop(0.55, rgba(mix(green, violet, 0.5), 0.12 * c.a));
      g.addColorStop(1, rgba(violet, 0));
      ctx.fillStyle = g;
      ctx.fillRect(c.x, c.y - c.len, (W + 200) / 280 + 1.6, c.len);
    }
  };
  kit.add("aurora", "shapes", kit.deps("extras"), [sprite([-100, -60, W + 200, 620], paint, mask.sweep("right", 80, kit.seed("aurora")), { blend: pal.mono ? "source-over" : "screen", feather: 12, res: 0.6 })], 0.9);
}

function sun(kit) {
  const { L, pal, style } = kit;
  const { x, y, r: rad } = L.sun;
  if (kit.scene.weather === "rain") return;
  const core = pal.night ? pal.sun : mix(pal.sun, "#ffffff", pal.mono ? 0 : 0.45);
  const paint = (ctx) => {
    const halo = ctx.createRadialGradient(x, y, rad * 0.8, x, y, rad * 3.2);
    halo.addColorStop(0, rgba(pal.glow, pal.night ? 0.32 : 0.5));
    halo.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - rad * 3.3, y - rad * 3.3, rad * 6.6, rad * 6.6);
    style.area(ctx, blob(x, y, rad, rad, kit.rng("sun"), 0.02, 40), { x, y, r: rad, stops: [core, pal.sun] }, kit.rng("disc"), { layers: 8, spread: 1.6, alpha: 0.3, grain: 0 });
    if (pal.night) {
      const rr = kit.rng("craters");
      for (let i = 0; i < 6; i++) style.area(ctx, blob(x + rr.range(-0.5, 0.5) * rad, y + rr.range(-0.5, 0.5) * rad, rad * rr.range(0.1, 0.22), rad * rr.range(0.08, 0.18), rr, 0.2, 10), mix(pal.sun, "#9aa0b8", 0.5), rr, { layers: 3, spread: 1, alpha: 0.12, grain: 0 });
    }
  };
  kit.sketch.push(Array.from({ length: 25 }, (_, i) => [x + Math.cos((i / 24) * Math.PI * 2) * rad, y + Math.sin((i / 24) * Math.PI * 2) * rad]));
  kit.add("sun", "shapes", kit.deps(), [sprite([x - rad * 3.4, y - rad * 3.4, rad * 6.8, rad * 6.8], paint, mask.radial(x, y, rad * 3.6, kit.seed("sun")), { feather: 5 })], 0.6);
}

function clouds(kit) {
  const { L, pal, scene, style } = kit;
  const r = kit.rng("clouds");
  const wispy = scene.weather === "clear" && (pal.low || scene.time === "golden");
  const heavy = scene.weather === "rain";
  const count = { clear: pal.night ? 2 : 4, clouds: 9, rain: 13, snow: 9, fog: 3 }[scene.weather] + (wispy ? 1 : 0);
  const ceiling = Math.min(L.horizon - 150, L.stand.y - L.stand.h - 90);
  const groups = Array.from({ length: count }, () => {
    const y = heavy ? r.range(-40, L.horizon * 0.55) : r.range(70, Math.max(120, pal.night ? ceiling - 120 : ceiling));
    const x = r.range(-150, W + 150);
    const w = (wispy ? r.range(280, 540) : r.range(180, 420)) * (heavy ? 1.6 : 1);
    const h = wispy ? r.range(14, 30) : r.range(40, 90) * (heavy ? 1.4 : 1);
    const k = wispy ? 6 : 8;
    const blobs = Array.from({ length: k }, (_, i) => {
      const t = i / (k - 1);
      const cx = x + (t - 0.5) * w * r.range(0.8, 1.1);
      const cy = y - Math.sin(t * Math.PI) * h * (wispy ? 0.3 : 0.8) * r.range(0.6, 1.2);
      return { cx, cy, rx: wispy ? w * r.range(0.14, 0.24) : h * r.range(0.8, 1.5), ry: wispy ? h * r.range(0.5, 0.9) : h * r.range(0.5, 0.95) };
    });
    return { y, blobs };
  });
  const tone = (y) => lerpStops(pal.sky, clamp(y / L.horizon));
  const paint = (ctx) => {
    const rr = kit.rng("cloud-paint");
    for (const g of groups) {
      const sky = tone(g.y);
      const body = heavy ? mix(sky, "#5f6674", 0.45) : pal.night ? mix(sky, pal.shade, 0.35) : wispy ? mix(sky, pal.shade, 0.22) : mix(sky, "#ffffff", 0.55);
      const lit = pal.night ? mix(pal.light, sky, 0.55) : wispy ? mix(pal.glow, "#ffffff", 0.25) : mix("#ffffff", pal.light, 0.3);
      const soft = wispy ? { layers: 10, spread: 11, alpha: 0.08, grain: 0 } : { layers: 7, spread: 6, alpha: 0.13, grain: 0.3 };
      for (const b of g.blobs) style.area(ctx, blob(b.cx, b.cy, b.rx, b.ry, rr, 0.22, 16), body, rr, soft);
      for (const b of g.blobs) style.area(ctx, blob(b.cx, b.cy + b.ry * 0.38, b.rx * 0.82, b.ry * 0.45, rr, 0.22, 14), lit, rr, { layers: 5, spread: wispy ? 8 : 4, alpha: wispy ? 0.09 : 0.08, grain: 0 });
    }
  };
  kit.add("clouds", "shapes", kit.deps(), [sprite([-200, -120, W + 400, L.horizon + 60], paint, mask.sweep("right", 90, kit.seed("clouds")), { feather: 10, res: 0.7 })], 1);
}

export function skyShapes(kit) {
  stars(kit);
  aurora(kit);
  sun(kit);
  clouds(kit);
}
