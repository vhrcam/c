import * as THREE from "three";
import { random } from "../../random";
import { Kit } from "../form/building";
import { vehicle } from "../form/vehicle";
import { rgb } from "../palette";

const ASPHALT = rgb("#34363b");
const WALK = rgb("#8e8b85");
const PAINT = rgb("#e8e4d8");
const FACADES = ["#b9b3a7", "#8e959e", "#c7c0b2", "#6f7782", "#a7988a", "#d7d2c8", "#7f8a86", "#9fa8b3"].map(rgb);
const LEAF = rgb("#4f7444");
const BARK = rgb("#4a3a2c");
const ROCK = rgb("#7b766d");

function free(spots, x, z, r) {
  return spots.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + r);
}

function tree(k, x, z, h, rand, leaf = LEAF) {
  k.cylinder(h * 0.05, h * 0.035, h * 0.45, x, 0, z, BARK, 8);
  const g = new THREE.IcosahedronGeometry(h * 0.32, 1);
  g.scale(1, 1.15, 1);
  g.translate(x, h * 0.62, z);
  k.add(g, leaf.map((v) => v * (0.85 + rand() * 0.3)));
}

function pine(k, x, z, h, rand) {
  k.cylinder(h * 0.04, h * 0.03, h * 0.25, x, 0, z, BARK, 6);
  for (let i = 0; i < 3; i++) k.cone(h * (0.32 - i * 0.07), h * 0.42, x, h * (0.18 + i * 0.22), z, rgb("#2f5a3a").map((v) => v * (0.85 + rand() * 0.3)), 9);
}

function rock(k, x, z, r, rand, color = ROCK) {
  const g = new THREE.DodecahedronGeometry(r, 0);
  g.scale(1, 0.6 + rand() * 0.4, 1 + rand() * 0.3);
  g.rotateY(rand() * 6);
  g.translate(x, r * 0.25, z);
  k.add(g, color.map((v) => v * (0.85 + rand() * 0.3)));
}

function streetlight(k, x, z, h, face) {
  k.cylinder(0.12, 0.09, h, x, 0, z, rgb("#2b2c30"), 8);
  k.box(0.12, 0.12, 1.4, x, h - 0.1, z + face * 0.6, rgb("#2b2c30"));
  k.box(0.5, 0.18, 0.5, x, h - 0.3, z + face * 1.2, rgb("#ffe2a8"), 1);
}

function city(ctx, scene, placed, k, rand) {
  const R = scene.stage;
  const P = Math.min(70, Math.max(32, R / 3.4));
  const road = Math.min(14, P * 0.24);
  const walk = road * 0.28;
  const cx = scene.cx;
  const cz = scene.cz;
  const spots = placed.map((p) => ({ x: p.spot.x, z: p.spot.z, r: Math.max(Math.abs(p.box.max[0] - p.box.min[0]), Math.abs(p.box.max[2] - p.box.min[2])) * 0.55 + 2 }));
  const inside = (x, z, pad = 0) => Math.hypot(x - cx, z - cz) < R * 0.94 - pad;
  const n = Math.ceil(R / P) + 1;
  k.delay = 0;
  for (let i = -n; i <= n; i++) {
    const off = (i + 0.5) * P;
    const half = Math.sqrt(Math.max(0, (R * 0.94) ** 2 - off * off));
    if (half < road) continue;
    k.box(half * 2, 0.04, road, cx, 0.01, cz + off, ASPHALT);
    k.box(road, 0.04, half * 2, cx + off, 0.012, cz, ASPHALT);
    for (let t = -half + 3; t < half - 3; t += 6) {
      k.box(2.2, 0.05, 0.2, cx + t, 0.02, cz + off, PAINT);
      k.box(0.2, 0.05, 2.2, cx + off, 0.022, cz + t, PAINT);
    }
  }
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const bx = cx + i * P;
      const bz = cz + j * P;
      if (!inside(bx, bz, P * 0.35)) continue;
      const size = P - road;
      k.delay = 0;
      k.box(size, 0.18, size, bx, 0, bz, WALK);
      const inner = size - walk * 2;
      const lots = rand() < 0.5 ? 1 : 2;
      const dist = Math.hypot(bx - cx, bz - cz) / R;
      for (let a = 0; a < lots; a++)
        for (let b = 0; b < lots; b++) {
          const w = inner / lots - 1.5;
          const x = bx - inner / 2 + (inner / lots) * (a + 0.5);
          const z = bz - inner / 2 + (inner / lots) * (b + 0.5);
          if (!free(spots, x, z, w * 0.6)) continue;
          const tall = Math.max(10, (1 - dist) * (1 - dist) * scene.height * (0.35 + rand() * 0.75));
          const h = Math.round(tall / 3.4) * 3.4 + 3.4;
          k.delay = dist * 3.2 + rand() * 0.6;
          k.facade = 1;
          const face = FACADES[Math.floor(rand() * FACADES.length)];
          const ww = w * (0.75 + rand() * 0.25);
          const wd = w * (0.75 + rand() * 0.25);
          k.box(ww, h, wd, x, 0.18, z, face);
          if (h > 40 && rand() < 0.7) k.box(ww * 0.7, h * 0.25, wd * 0.7, x, h + 0.18, z, face.map((v) => v * 0.95));
          k.facade = 0;
          k.box(ww + 0.3, 0.6, wd + 0.3, x, h + 0.18, z, face.map((v) => v * 0.8));
          if (rand() < 0.6) k.cylinder(1.2, 1.2, 2.6, x + ww * 0.2, h + 0.78, z - wd * 0.2, rgb("#5a4a3c"), 10);
          if (rand() < 0.5) k.box(2.4, 1.2, 1.6, x - ww * 0.25, h + 0.78, z + wd * 0.2, rgb("#9a9a96"));
          if (h > 60 && rand() < 0.5) k.cylinder(0.2, 0.1, h * 0.12, x, h + 0.78, z, rgb("#c9cdd2"), 6);
        }
      k.delay = dist * 3.2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = bx + sx * (size / 2 - walk * 0.5);
        const lz = bz + sz * (size / 2 - walk * 0.5);
        if (inside(lx, lz, 2) && free(spots, lx, lz, 1)) streetlight(k, lx, lz, 6.5, -sz);
      }
      for (let t = 0; t < 3; t++) {
        const s2 = rand() < 0.5 ? -1 : 1;
        const along = (rand() - 0.5) * size * 0.7;
        const tx = rand() < 0.5 ? bx + along : bx + s2 * (size / 2 - walk * 0.5);
        const tz = tx === bx + along ? bz + s2 * (size / 2 - walk * 0.5) : bz + along;
        if (inside(tx, tz, 2) && free(spots, tx, tz, 2)) tree(k, tx, tz, 6 + rand() * 3, rand);
      }
    }
  const cars = Math.round(6 + rand() * 6);
  for (let c = 0; c < cars; c++) {
    const i = Math.round((rand() - 0.5) * 2 * (n - 1));
    const off = (i + 0.5) * P;
    const t = (rand() - 0.5) * 2 * R * 0.8;
    const alongX = rand() < 0.5;
    const lane = (rand() < 0.5 ? -1 : 1) * road * 0.22;
    const x = alongX ? cx + t : cx + off + lane;
    const z = alongX ? cz + off + lane : cz + t;
    if (!inside(x, z, 4) || !free(spots, x, z, 3)) continue;
    const kind = rand() < 0.15 ? "bus" : rand() < 0.25 ? "van" : rand() < 0.5 ? "hatchback" : "sedan";
    const car = vehicle({ label: kind, colors: [rand() < 0.25 ? "#e6b929" : ["#b5352d", "#25375c", "#e7e3da", "#2d2f33", "#6f7480"][Math.floor(rand() * 5)]], vehicle: { type: kind } }, rand);
    const g = car.geometry;
    g.rotateY(alongX ? (lane > 0 ? 0 : Math.PI) : lane > 0 ? -Math.PI / 2 : Math.PI / 2);
    g.translate(x, 0.04, z);
    g.setAttribute("delay", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count).fill(Math.hypot(x - cx, z - cz) / R * 3.2 + 1), 1));
    k.parts.push(g);
  }
}

function countryside(ctx, scene, placed, k, rand, terrainShape) {
  const R = scene.stage;
  const { plan } = ctx;
  const setting = plan.world.setting;
  const spots = placed.map((p) => ({ x: p.spot.x, z: p.spot.z, r: Math.max(Math.abs(p.box.max[0] - p.box.min[0]), Math.abs(p.box.max[2] - p.box.min[2])) * 0.6 + 2 }));
  const winter = plan.world.season === "winter" || setting === "snowfield" || plan.world.weather === "snow";
  const alpine = terrainShape?.alpine || setting === "mountains" || setting === "snowfield";
  const desert = setting === "desert";
  const fall = plan.world.season === "fall";
  const leaf = fall ? rgb("#c8682e") : plan.world.season === "spring" ? rgb("#8fbf6a") : LEAF;
  const scale = Math.max(1, scene.radius / 6);
  const at = (x, z) => (terrainShape ? terrainShape.height(x, z) : 0);
  const hero = placed[0];
  if (hero && hero.form.extra?.style && ["mansion", "house", "cottage", "cabin", "farmhouse", "modern", "barn", "church", "castle", "windmill"].includes(hero.form.extra.style)) {
    const front = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), hero.spot.yaw);
    const start = Math.max(Math.abs(hero.box.max[0]), Math.abs(hero.box.min[0]));
    for (let d = start; d < R * 0.95; d += 1.6) {
      const x = hero.spot.x + front.x * d;
      const z = hero.spot.z + front.z * d;
      k.delay = (d / R) * 2;
      k.box(1.7, 0.06, 2.6 * scale * 0.5 + 0.6, x, at(x, z) + 0.02, z, desert ? rgb("#cdb48a") : rgb("#b7a98f"), 0, Math.atan2(front.z, front.x) + Math.PI / 2);
    }
  }
  const forest = setting === "forest";
  const count = Math.round((forest ? 30 : alpine ? 22 : desert ? 16 : 14) * Math.max(0.6, ctx.quality));
  const heroH = Math.max(3, scene.height);
  const vx = scene.view.x;
  const vz = scene.view.z;
  const vl = Math.hypot(vx, vz) || 1;
  for (let i = 0, tries = 0; i < count && tries < count * 14; tries++) {
    const a = rand() * Math.PI * 2;
    const r = scene.radius * 1.25 + rand() * (R * 0.92 - scene.radius * 1.25);
    const x = scene.cx + Math.cos(a) * r;
    const z = scene.cz + Math.sin(a) * r;
    const toward = (Math.cos(a) * vx + Math.sin(a) * vz) / vl;
    if (toward > 0.45) continue;
    if (!free(spots, x, z, 2)) continue;
    const y = at(x, z);
    if (terrainShape?.coast && y < 0.3) continue;
    i++;
    k.delay = (r / R) * 2.5 + rand() * 0.4;
    const h = heroH * (0.45 + rand() * 0.45) * (alpine ? 0.8 : 1);
    const g0 = k.parts.length;
    if (desert) {
      if (rand() < 0.6) {
        k.cylinder(0.35 * scale, 0.3 * scale, h * 0.6, x, 0, z, rgb("#5e8a4a"), 8);
        k.cylinder(0.22 * scale, 0.2 * scale, h * 0.25, x + 0.6 * scale, h * 0.25, z, rgb("#5e8a4a"), 8);
      } else rock(k, x, z, (0.6 + rand()) * scale, rand, rgb("#b8946a"));
    } else if (alpine || winter) {
      if (rand() < 0.75) pine(k, x, z, h * 1.3, rand);
      else rock(k, x, z, (0.5 + rand() * 0.9) * scale, rand);
    } else if (rand() < 0.65) tree(k, x, z, h, rand, leaf);
    else if (rand() < 0.5) rock(k, x, z, (0.4 + rand() * 0.6) * scale, rand);
    else {
      const g = new THREE.IcosahedronGeometry(0.9 * scale, 0);
      g.scale(1.3, 0.7, 1.1);
      g.translate(x, 0.45 * scale, z);
      k.add(g, leaf.map((v) => v * 0.9));
    }
    for (let j = g0; j < k.parts.length; j++) k.parts[j].translate(0, y, 0);
  }
}

export function dress(ctx, scene, placed, terrainShape) {
  const { plan } = ctx;
  const rand = random((plan.seed ^ 0x7a3f1c29) >>> 0);
  const k = new Kit();
  const setting = plan.world.setting;
  const urban = setting === "city" || /\b(city|downtown|street|urban|skyline|town|block)\b/i.test(plan.text) || placed.some((p) => p.form.extra?.style === "skyscraper");
  if (setting === "void" || setting === "space" || terrainShape?.open) return null;
  else if (urban) city(ctx, scene, placed, k, rand);
  else countryside(ctx, scene, placed, k, rand, terrainShape);
  if (!k.parts.length) return null;
  const geometry = k.geometry();
  geometry.computeBoundingBox();
  return { geometry, urban };
}

