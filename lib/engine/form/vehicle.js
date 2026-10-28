import * as THREE from "three";
import { rgb } from "../palette";
import { Kit } from "./building";

export const VEHICLES = ["sedan", "coupe", "sports", "hatchback", "suv", "jeep", "pickup", "van", "limousine", "vintage", "race", "bus", "truck", "train", "galleon", "boat", "sailboat"];

const SIZE = {
  sedan: [4.7, 1.85, 1.45],
  coupe: [4.5, 1.85, 1.35],
  sports: [4.4, 1.95, 1.2],
  hatchback: [4.1, 1.78, 1.5],
  suv: [4.8, 1.95, 1.8],
  jeep: [4.2, 1.85, 1.85],
  pickup: [5.6, 2.0, 1.9],
  van: [5.2, 2.0, 2.25],
  limousine: [6.6, 1.9, 1.45],
  vintage: [4.6, 1.75, 1.65],
  race: [4.9, 2.0, 1.05],
};

export function guessVehicle(label) {
  const l = label.toLowerCase();
  const pairs = [
    [/train|locomotive|steam engine/, "train"],
    [/pirate|galleon|frigate|schooner|tall ship|sailing ship|man.o.war|caravel|clipper|brig\b|warship|ship/, "galleon"],
    [/sailboat|sailing boat|yacht|dinghy/, "sailboat"],
    [/boat|ship|ferry|tug/, "boat"],
    [/bus/, "bus"],
    [/semi|big rig|18.?wheeler|lorry|tractor.?trailer|freight truck/, "truck"],
    [/pickup|pick-up|truck/, "pickup"],
    [/van|minivan/, "van"],
    [/jeep|land rover|wrangler|off.?road/, "jeep"],
    [/suv|crossover/, "suv"],
    [/limo/, "limousine"],
    [/race|formula|f1/, "race"],
    [/vintage|classic|antique|old|retro|1930|1940|1950|beetle|model t/, "vintage"],
    [/sports|ferrari|lamborghini|porsche|supercar|corvette|mustang|muscle/, "sports"],
    [/coupe/, "coupe"],
    [/hatch|mini cooper|golf/, "hatchback"],
  ];
  for (const [re, t] of pairs) if (re.test(l)) return t;
  return "sedan";
}

function profiles(type, L, H) {
  const x0 = -L / 2;
  const x1 = L / 2;
  if (type === "sports" || type === "race")
    return {
      body: [[x0 + 0.05, 0.22], [x1 - 0.05, 0.2], [x1, 0.42], [x1 - 0.6, 0.62], [x1 - 1.6, 0.72], [x0 + 0.9, 0.82], [x0 + 0.1, 0.8], [x0, 0.5]],
      cabin: [[x0 + 1.2, 0.8], [x1 - 1.7, 0.72], [x1 - 2.4, H - 0.02], [x0 + 1.75, H]],
    };
  if (type === "suv" || type === "jeep")
    return {
      body: [[x0 + 0.08, 0.42], [x1 - 0.1, 0.42], [x1, 0.7], [x1 - 0.1, 1.02], [x1 - 1.15, 1.1], [x0 + 0.1, 1.12], [x0, 0.75]],
      cabin: [[x0 + 0.25, 1.1], [x1 - 1.2, 1.08], [x1 - 1.75, H], [x0 + 0.35, H]],
    };
  if (type === "van")
    return {
      body: [[x0 + 0.08, 0.38], [x1 - 0.1, 0.38], [x1, 0.66], [x1 - 0.15, 1.0], [x0 + 0.05, 1.05], [x0, 0.7]],
      cabin: [[x0 + 0.1, 1.04], [x1 - 0.2, 0.98], [x1 - 0.95, H], [x0 + 0.12, H]],
    };
  if (type === "pickup")
    return {
      body: [[x0 + 0.1, 0.45], [x1 - 0.1, 0.45], [x1, 0.75], [x1 - 0.1, 1.08], [x1 - 1.2, 1.12], [x0 + 0.05, 1.12], [x0, 0.8]],
      cabin: [[x0 + 2.2, 1.1], [x1 - 1.25, 1.1], [x1 - 1.8, H], [x0 + 2.35, H]],
    };
  if (type === "hatchback")
    return {
      body: [[x0 + 0.06, 0.3], [x1 - 0.06, 0.3], [x1, 0.55], [x1 - 0.12, 0.8], [x1 - 1.2, 0.92], [x0 + 0.15, 0.95], [x0, 0.6]],
      cabin: [[x0 + 0.2, 0.94], [x1 - 1.25, 0.9], [x1 - 1.95, H], [x0 + 0.55, H - 0.02]],
    };
  if (type === "vintage")
    return {
      body: [[x0 + 0.3, 0.42], [x1 - 0.2, 0.42], [x1 - 0.05, 0.62], [x1 - 0.2, 0.92], [x1 - 1.6, 0.98], [x0 + 0.8, 0.98], [x0 + 0.15, 0.85], [x0, 0.55]],
      cabin: [[x0 + 0.9, 0.97], [x1 - 1.75, 0.97], [x1 - 1.95, H], [x0 + 1.0, H]],
    };
  if (type === "coupe")
    return {
      body: [[x0 + 0.05, 0.28], [x1 - 0.05, 0.28], [x1, 0.52], [x1 - 0.15, 0.74], [x1 - 1.5, 0.86], [x0 + 0.85, 0.9], [x0 + 0.08, 0.86], [x0, 0.56]],
      cabin: [[x0 + 1.0, 0.88], [x1 - 1.55, 0.86], [x1 - 2.35, H], [x0 + 1.9, H - 0.04]],
    };
  return {
    body: [[x0 + 0.05, 0.3], [x1 - 0.05, 0.3], [x1, 0.55], [x1 - 0.15, 0.78], [x1 - 1.5, 0.92], [x0 + 1.0, 0.95], [x0 + 0.1, 0.9], [x0, 0.6]],
    cabin: [[x0 + 1.05, 0.93], [x1 - 1.55, 0.92], [x1 - 2.25, H], [x0 + 1.65, H]],
  };
}

function extrude(points, depth, bevel) {
  const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

function wheel(k, x, z, r, w, tire, rim, spokes = 5) {
  const t = new THREE.CylinderGeometry(r, r, w, 28, 1);
  t.rotateX(Math.PI / 2);
  t.translate(x, r, z);
  k.add(t, tire);
  const side = Math.sign(z) || 1;
  const disc = new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.03, 24);
  disc.rotateX(Math.PI / 2);
  disc.translate(x, r, z + side * (w / 2 + 0.01));
  k.add(disc, rim);
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2;
    const g = new THREE.BoxGeometry(r * 0.12, r * 0.55, 0.04);
    g.translate(0, r * 0.3, 0);
    g.rotateZ(a);
    g.translate(x, r, z + side * (w / 2 + 0.03));
    k.add(g, rim.map((v) => v * 0.8));
  }
  const hub = new THREE.CylinderGeometry(r * 0.14, r * 0.14, 0.05, 12);
  hub.rotateX(Math.PI / 2);
  hub.translate(x, r, z + side * (w / 2 + 0.04));
  k.add(hub, rim);
}

function car(k, type, col) {
  const [L, W, H] = SIZE[type] || SIZE.sedan;
  const { body, cabin } = profiles(type, L, H);
  k.add(extrude(body, W, 0.08), col.paint);
  const glass = extrude(cabin, W * 0.84, 0.05);
  k.add(glass, col.glass, 0.15);
  const roofLine = cabin.slice(2);
  const roof = extrude([[roofLine[1][0] + 0.05, roofLine[1][1] - 0.04], [roofLine[0][0] - 0.05, roofLine[0][1] - 0.04], [roofLine[0][0] - 0.05, roofLine[0][1] + 0.03], [roofLine[1][0] + 0.05, roofLine[1][1] + 0.03]], W * 0.86, 0.03);
  k.add(roof, col.paint);
  for (const [x, y] of [cabin[0], cabin[1]]) k.box(0.08, H - y, W * 0.86, x, y, 0, col.paint);
  const r = type === "jeep" || type === "suv" || type === "pickup" ? 0.42 : type === "van" ? 0.36 : type === "race" ? 0.36 : 0.34;
  const base = type === "limousine" ? L * 0.36 : L * 0.31;
  for (const x of [-base, base]) for (const s of [-1, 1]) wheel(k, x, s * (W / 2 - 0.12), r, 0.26, col.tire, col.rim, type === "vintage" ? 12 : 5);
  const front = L / 2;
  const lightY = type === "vintage" ? 0.95 : body[2][1] + 0.08;
  for (const s of [-1, 1]) {
    if (type === "vintage") {
      const g = new THREE.CylinderGeometry(0.13, 0.13, 0.14, 16);
      g.rotateZ(Math.PI / 2);
      g.translate(front - 0.32, lightY + 0.05, s * W * 0.33);
      k.add(g, col.light, 1);
    } else k.box(0.06, 0.1, W * 0.2, front - 0.04, lightY - 0.05, s * W * 0.33, col.light, 1);
    k.box(0.06, 0.1, W * 0.18, -front + 0.03, body[body.length - 2][1] - 0.18, s * W * 0.34, col.tail, 0.7);
    k.box(0.22, 0.08, 0.14, cabin[1][0] - 0.05, body[3][1] + 0.12, s * (W / 2 + 0.06), col.paint);
  }
  k.box(0.08, 0.2, W * 0.42, front - 0.02, body[1][1] + 0.08, 0, col.trim);
  k.box(0.14, 0.12, W * 0.94, front - 0.03, body[0][1] - 0.02, 0, col.trim);
  k.box(0.14, 0.12, W * 0.94, -front + 0.03, body[0][1] - 0.02, 0, col.trim);
  if (type === "pickup") {
    k.box(L * 0.36, 0.5, 0.08, -L * 0.29, 1.1, W / 2 - 0.08, col.paint);
    k.box(L * 0.36, 0.5, 0.08, -L * 0.29, 1.1, -W / 2 + 0.08, col.paint);
    k.box(0.08, 0.5, W - 0.1, -L / 2 + 0.06, 1.1, 0, col.paint);
  }
  if (type === "vintage") for (const s of [-1, 1]) {
    k.box(L * 0.42, 0.06, 0.28, 0, 0.62, s * (W / 2 + 0.06), col.trim);
    for (const x of [-base, base]) {
      const f = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 20, 1, false, 0, Math.PI);
      f.rotateX(Math.PI / 2);
      f.rotateZ(Math.PI / 2);
      f.translate(x, 0.34, s * (W / 2 - 0.12));
      k.add(f, col.paint);
    }
  }
  if (type === "race") {
    k.box(0.5, 0.06, W * 1.05, -L / 2 + 0.2, 1.05, 0, col.paint);
    for (const s of [-1, 1]) k.box(0.3, 0.5, 0.05, -L / 2 + 0.25, 0.6, s * W * 0.45, col.trim);
  }
  return [0, H * 0.5, 0];
}

function tire(k, x, z, r, w, col, rand) {
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = -Math.PI / 2 + t * Math.PI;
    prof.push(new THREE.Vector2(r * 0.62 + Math.cos(a) * r * 0.38 * (0.82 + 0.18 * Math.cos(a)), Math.sin(a) * w * 0.5));
  }
  const g = new THREE.LatheGeometry(prof, 32);
  g.rotateX(Math.PI / 2);
  g.translate(x, r, z);
  k.add(g, col.tire);
  const side = Math.sign(z) || 1;
  const rim = new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.7, 28);
  rim.rotateX(Math.PI / 2);
  rim.translate(x, r, z + side * 0.02);
  k.add(rim, col.rim);
  const dish = new THREE.CylinderGeometry(r * 0.42, r * 0.5, 0.04, 24);
  dish.rotateX(Math.PI / 2);
  dish.translate(x, r, z + side * (w * 0.36 + 0.02));
  k.add(dish, col.rim.map((v) => v * 0.75));
  for (let s2 = 0; s2 < 6; s2++) {
    const a = (s2 / 6) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(r * 0.1, r * 0.46, 0.05);
    spoke.translate(0, r * 0.26, 0);
    spoke.rotateZ(a);
    spoke.translate(x, r, z + side * (w * 0.36 + 0.05));
    k.add(spoke, col.rim);
    const nut = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6);
    nut.rotateX(Math.PI / 2);
    nut.translate(x + Math.cos(a + 0.5) * r * 0.16, r + Math.sin(a + 0.5) * r * 0.16, z + side * (w * 0.36 + 0.06));
    k.add(nut, col.rim.map((v) => v * 0.6));
  }
  void rand;
}

function flare(k, x, z, r, w, color) {
  const g = new THREE.CylinderGeometry(r * 1.18, r * 1.18, w, 24, 1, true, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2);
  g.translate(x, r * 1.02, z);
  k.add(g, color);
}

function pickup(k, col, rand) {
  const L = 5.7;
  const W = 2.0;
  const r = 0.43;
  const fx = L / 2;
  const rx = -L / 2;
  const axF = fx - 1.05;
  const axR = rx + 1.25;
  const chrome = rgb("#d4d7db");
  const dark = rgb("#1b1c1e");
  k.box(L - 0.6, 0.3, W * 0.72, 0, 0.42, 0, dark);
  const body = [[rx, 0.62], [fx - 0.05, 0.62], [fx, 0.82], [fx - 0.04, 1.18], [fx - 1.55, 1.3], [fx - 2.05, 1.32], [rx + 2.35, 1.32], [rx + 2.35, 1.26], [rx, 1.26]];
  const shape = new THREE.Shape(body.map(([a, b]) => new THREE.Vector2(a, b)));
  const bodyG = new THREE.ExtrudeGeometry(shape, { depth: W - 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
  bodyG.translate(0, 0, -(W - 0.12) / 2);
  k.add(bodyG, col.paint);
  const cab = [[fx - 2.05, 1.3], [fx - 1.55, 1.3], [fx - 2.25, 1.95], [rx + 2.45, 1.95], [rx + 2.35, 1.3]];
  const cabG = new THREE.ExtrudeGeometry(new THREE.Shape(cab.map(([a, b]) => new THREE.Vector2(a, b))), { depth: W - 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  cabG.translate(0, 0, -(W - 0.22) / 2);
  k.add(cabG, col.paint);
  k.box(0.06, 0.52, W - 0.4, fx - 1.88, 1.36, 0, col.glass, 0.12, 0);
  const ws = new THREE.BoxGeometry(0.7, 0.04, W - 0.36);
  ws.rotateZ(-0.82);
  ws.translate(fx - 1.88, 1.62, 0);
  k.add(ws, col.glass, 0.15);
  for (const s2 of [-1, 1]) {
    k.box(1.1, 0.5, 0.04, rx + 3.05, 1.38, s2 * (W / 2 - 0.08), col.glass, 0.15);
    k.box(0.06, 0.62, 0.05, rx + 2.55, 1.32, s2 * (W / 2 - 0.08), col.paint);
    k.box(0.05, 0.9, 0.03, rx + 3.65, 0.42 + 0.4, s2 * (W / 2 + 0.005), dark);
    k.box(0.05, 0.9, 0.03, rx + 2.4, 0.42 + 0.4, s2 * (W / 2 + 0.005), dark);
    k.box(0.22, 0.05, 0.05, rx + 3.4, 1.05, s2 * (W / 2 + 0.02), chrome);
    k.box(0.08, 0.06, 0.4, fx - 2.0, 1.42, s2 * (W / 2 + 0.12), dark);
    k.box(0.12, 0.22, 0.24, fx - 2.0, 1.4, s2 * (W / 2 + 0.3), col.paint);
    const step = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 10);
    step.rotateZ(Math.PI / 2);
    step.translate(rx + 3.2, 0.5, s2 * (W / 2 + 0.06));
    k.add(step, chrome);
  }
  k.box(0.06, 0.5, W - 0.4, rx + 2.38, 1.4, 0, col.glass, 0.12);
  const bedL = 2.3;
  const bx = rx + bedL / 2 + 0.02;
  k.box(bedL, 0.06, W - 0.16, bx, 0.98, 0, dark);
  for (const s2 of [-1, 1]) k.box(bedL, 0.34, 0.08, bx, 0.98, s2 * (W / 2 - 0.08), col.paint);
  k.box(0.08, 0.34, W - 0.16, rx + 0.04, 0.98, 0, col.paint);
  k.box(0.05, 0.05, 0.4, rx - 0.0, 1.18, 0, chrome);
  for (const s2 of [-1, 1]) k.box(0.05, 0.36, 0.14, rx - 0.02, 0.92, s2 * (W / 2 - 0.12), col.tail, 0.8);
  k.box(0.12, 0.42, W * 0.64, fx + 0.01, 0.72, 0, dark);
  for (let i = 0; i < 4; i++) k.box(0.14, 0.04, W * 0.6, fx + 0.03, 0.62 + i * 0.1, 0, chrome);
  k.box(0.16, 0.5, 0.06, fx + 0.02, 0.62, 0, chrome);
  for (const s2 of [-1, 1]) {
    k.box(0.08, 0.2, 0.36, fx - 0.02, 0.92, s2 * W * 0.36, chrome);
    k.box(0.1, 0.15, 0.3, fx - 0.0, 0.94, s2 * W * 0.36, col.light, 1);
    k.box(0.08, 0.08, 0.12, fx - 0.02, 0.78, s2 * W * 0.44, rgb("#f0a020"), 0.6);
  }
  k.box(0.22, 0.22, W + 0.02, fx + 0.08, 0.42, 0, chrome);
  k.box(0.2, 0.2, W + 0.02, rx - 0.08, 0.5, 0, chrome);
  for (const [x, s2] of [[axF, 1], [axF, -1], [axR, 1], [axR, -1]]) {
    flare(k, x, s2 * (W / 2 - 0.05), r, 0.36, col.paint.map((v) => v * 0.82));
    tire(k, x, s2 * (W / 2 - 0.16), r, 0.3, col, rand);
  }
  const exhaust = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10);
  exhaust.rotateZ(Math.PI / 2);
  exhaust.translate(rx - 0.1, 0.36, W * 0.3);
  k.add(exhaust, chrome);
  k.cylinder(0.01, 0.01, 0.8, fx - 2.0, 1.32, W / 2 - 0.1, dark, 4);
  return [0, 1, 0];
}

function semi(k, col, rand) {
  const W = 2.5;
  const chrome = rgb("#d6d9dd");
  const dark = rgb("#1a1b1d");
  const r = 0.52;
  k.box(13.2, 0.35, 1.0, -1.2, 0.85, 0, dark);
  const hood = [[2.4, 0.95], [5.6, 0.95], [5.75, 1.25], [5.6, 2.15], [3.6, 2.45], [2.4, 2.5]];
  const hg = new THREE.ExtrudeGeometry(new THREE.Shape(hood.map(([a, b]) => new THREE.Vector2(a, b))), { depth: W - 0.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 });
  hg.translate(0, 0, -(W - 0.6) / 2);
  k.add(hg, col.paint);
  k.box(0.14, 1.15, W * 0.52, 5.72, 1.05, 0, chrome);
  for (let i = 0; i < 9; i++) k.box(0.16, 1.0, 0.04, 5.74, 1.12, -W * 0.24 + (W * 0.48 * i) / 8, dark);
  for (const s2 of [-1, 1]) {
    k.box(0.16, 0.26, 0.42, 5.55, 1.55, s2 * (W * 0.38), chrome);
    k.box(0.18, 0.18, 0.32, 5.58, 1.57, s2 * (W * 0.38), col.light, 1);
    const fend = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.55, 20, 1, true, Math.PI / 2, Math.PI);
    fend.rotateX(Math.PI / 2);
    fend.translate(4.5, r * 1.05, s2 * (W / 2 - 0.2));
    k.add(fend, col.paint);
  }
  k.box(0.3, 0.38, W + 0.1, 5.9, 0.62, 0, chrome);
  k.box(2.2, 2.0, W, 1.3, 1.25, 0, col.paint);
  k.box(0.06, 0.85, W - 0.3, 2.42, 2.2, 0, col.glass, 0.15);
  k.box(2.0, 0.45, W - 0.2, 1.2, 3.25, 0, col.paint.map((v) => v * 0.92));
  k.box(2.1, 2.7, W, -0.9, 1.25, 0, col.paint);
  k.box(2.1, 0.6, W - 0.3, -0.9, 3.95, 0, col.paint.map((v) => v * 0.9));
  for (const s2 of [-1, 1]) {
    k.box(1.3, 0.75, 0.04, 1.45, 2.25, s2 * (W / 2 + 0.01), col.glass, 0.15);
    k.box(0.05, 1.3, 0.03, 0.6, 1.6, s2 * (W / 2 + 0.005), dark);
    k.box(0.06, 0.06, 0.6, 2.2, 2.6, s2 * (W / 2 + 0.3), dark);
    k.box(0.12, 0.5, 0.26, 2.2, 2.35, s2 * (W / 2 + 0.6), dark);
    k.cylinder(0.11, 0.1, 3.2, -0.15, 1.6, s2 * (W / 2 - 0.15), chrome, 14);
    k.cylinder(0.14, 0.14, 0.12, -0.15, 4.8, s2 * (W / 2 - 0.15), dark, 14);
    const tank = new THREE.CylinderGeometry(0.34, 0.34, 1.5, 20);
    tank.rotateZ(Math.PI / 2);
    tank.translate(1.2, 0.85, s2 * (W / 2 - 0.25));
    k.add(tank, chrome);
    for (let st = 0; st < 3; st++) k.box(0.4, 0.04, 0.25, 2.35, 0.45 + st * 0.35, s2 * (W / 2 + 0.05), chrome);
  }
  k.cylinder(0.65, 0.65, 0.12, -2.2, 1.0, 0, dark, 20);
  const TL = 13.5;
  const tx = -2.0 - TL / 2 + 0.6;
  k.box(TL, 3.0, W, tx, 1.3, 0, col.trim);
  for (let i = 0; i <= 26; i++) for (const s2 of [-1, 1]) k.box(0.06, 2.9, 0.04, tx - TL / 2 + (TL * i) / 26, 1.35, s2 * (W / 2 + 0.01), col.trim.map((v) => v * 0.86));
  k.box(TL, 0.12, W + 0.04, tx, 4.25, 0, col.trim.map((v) => v * 0.9));
  k.box(0.05, 2.9, 0.04, tx - TL / 2 - 0.01, 1.35, 0, dark);
  for (const s2 of [-1, 1]) {
    k.box(0.05, 0.12, 0.16, tx - TL / 2 - 0.02, 1.0, s2 * (W / 2 - 0.2), col.tail, 0.8);
    k.box(TL * 0.45, 0.55, 0.04, tx + TL * 0.02, 0.62, s2 * (W / 2 - 0.02), col.trim.map((v) => v * 0.7));
    k.box(0.1, 1.0, 0.1, tx + TL * 0.32, 0.3, s2 * (W / 2 - 0.4), dark);
  }
  k.box(0.1, 0.2, W, tx - TL / 2 + 0.3, 0.55, 0, chrome);
  const axles = [[4.5, false], [-1.0, true], [-2.4, true], [tx - TL / 2 + 1.9, true], [tx - TL / 2 + 3.2, true]];
  for (const [x, dual] of axles)
    for (const s2 of [-1, 1]) {
      tire(k, x, s2 * (W / 2 - 0.2), r, 0.32, col, rand);
      if (dual) tire(k, x, s2 * (W / 2 - 0.56), r, 0.32, col, rand);
    }
  return [0, 2, 0];
}

function bus(k, col, truck) {
  const L = truck ? 6.5 : 12;
  const W = 2.55;
  const H = truck ? 3.2 : 3.2;
  if (truck) {
    k.add(extrude([[1.6, 0.6], [4.2, 0.6], [4.4, 1.2], [4.3, 2.9], [2.2, 3.1], [1.6, 3.1]], W, 0.08), col.paint);
    k.add(extrude([[3.05, 1.9], [4.25, 1.85], [4.2, 2.75], [3.1, 2.85]], W * 0.9, 0.03), col.glass, 0.15);
    k.box(10.5, 3.0, W, -4.0, 1.1, 0, col.trim);
    k.box(10.5, 0.3, W + 0.04, -4.0, 0.85, 0, col.tire);
    for (const x of [3.4, 0.2, -1.2, -7.4, -8.6]) for (const s of [-1, 1]) wheel(k, x, s * (W / 2 - 0.2), 0.52, 0.4, col.tire, col.rim, 8);
    for (const s of [-1, 1]) k.box(0.06, 0.18, 0.4, 4.42, 0.95, s * W * 0.36, col.light, 1);
    return [-1, 2, 0];
  }
  k.add(extrude([[-L / 2, 0.35], [L / 2, 0.35], [L / 2, H - 0.3], [L / 2 - 0.3, H], [-L / 2, H], [-L / 2, 0.35]], W, 0.1), col.paint);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) k.box(1.0, 0.95, 0.06, -L / 2 + 1.0 + i * 1.18, 1.75, s * (W / 2 + 0.01), col.glass, 0.6);
  k.box(0.06, 1.3, W * 0.88, L / 2 + 0.01, 1.6, 0, col.glass, 0.4);
  for (const x of [L * 0.32, -L * 0.3]) for (const s of [-1, 1]) wheel(k, x, s * (W / 2 - 0.2), 0.5, 0.36, col.tire, col.rim, 8);
  for (const s of [-1, 1]) k.box(0.06, 0.16, 0.36, L / 2 + 0.02, 0.7, s * W * 0.36, col.light, 1);
  return [0, H * 0.5, 0];
}

function train(k, col) {
  const R = 0.85;
  const boiler = new THREE.CylinderGeometry(R, R, 6.2, 32);
  boiler.rotateZ(Math.PI / 2);
  boiler.translate(1.4, 2.1, 0);
  k.add(boiler, col.paint);
  for (const x of [-0.6, 1.2, 3.0]) {
    const band = new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.12, 32);
    band.rotateZ(Math.PI / 2);
    band.translate(x, 2.1, 0);
    k.add(band, col.brass);
  }
  const smoke = new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.9, 32);
  smoke.rotateZ(Math.PI / 2);
  smoke.translate(4.7, 2.1, 0);
  k.add(smoke, col.trim);
  k.cylinder(0.32, 0.42, 1.3, 4.4, 2.8, 0, col.trim, 18);
  k.cylinder(0.5, 0.36, 0.3, 4.4, 4.05, 0, col.trim, 18);
  k.dome(0.42, 2.4, 2.85, 0, col.brass, 0.8);
  k.box(2.4, 2.6, 2.6, -2.6, 1.2, 0, col.paint);
  k.box(2.7, 0.18, 2.9, -2.6, 3.8, 0, col.trim);
  for (const s of [-1, 1]) k.box(1.2, 0.9, 0.06, -2.6, 2.6, s * 1.31, col.glass, 0.8);
  k.box(7.8, 0.35, 2.4, 0.6, 0.95, 0, col.trim);
  k.prism([[0, 0], [0, 1.0], [1.0, 0]], 2.2, 5.0, 0.15, 0, col.trim, "z");
  for (const x of [-1.4, 0.4, 2.2]) for (const s of [-1, 1]) wheel(k, x, s * 1.05, 0.75, 0.18, col.trim, col.red, 12);
  for (const x of [3.9, 4.6]) for (const s of [-1, 1]) wheel(k, x, s * 1.05, 0.42, 0.16, col.trim, col.red, 8);
  for (const s of [-1, 1]) k.box(3.8, 0.12, 0.08, 0.4, 1.25, s * 1.16, col.brass);
  k.box(0.2, 0.36, 0.36, 5.2, 2.1, 0, col.light, 1);
  k.box(4.6, 2.2, 2.5, -6.6, 0.95, 0, col.paint);
  k.box(4.4, 0.5, 2.3, -6.6, 3.15, 0, col.coal);
  for (const x of [-7.8, -5.4]) for (const s of [-1, 1]) wheel(k, x, s * 1.05, 0.45, 0.16, col.trim, col.red, 8);
  return [0, 2, 0];
}

function boat(k, col, sail) {
  const L = sail ? 9 : 11;
  const W = sail ? 3 : 3.6;
  const hull = new THREE.BufferGeometry();
  const rings = 14;
  const pos = [];
  const ring = (t) => {
    const x = -L / 2 + t * L;
    const taper = t > 0.7 ? Math.sqrt(1 - (t - 0.7) / 0.3) : 1 - (0.7 - t) * 0.25;
    const w = (W / 2) * taper;
    const lift = t > 0.85 ? (t - 0.85) * 2.2 : 0;
    return [[x, 1.6 + lift, -w], [x, 0.4 + lift * 0.5, -w * 0.85], [x, 0, 0], [x, 0.4 + lift * 0.5, w * 0.85], [x, 1.6 + lift, w]];
  };
  for (let i = 0; i < rings; i++) {
    const a = ring(i / rings);
    const b = ring((i + 1) / rings);
    for (let j = 0; j < 4; j++) pos.push(...a[j], ...b[j], ...b[j + 1], ...a[j], ...b[j + 1], ...a[j + 1]);
  }
  hull.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  hull.computeVertexNormals();
  k.add(hull, col.paint);
  k.box(L * 0.9, 0.12, W * 0.82, -L * 0.03, 1.5, 0, col.deck);
  k.box(L * 0.95, 0.18, 0.08, 0, 1.0, W / 2 - 0.02, col.trim);
  k.box(L * 0.95, 0.18, 0.08, 0, 1.0, -W / 2 + 0.02, col.trim);
  if (sail) {
    k.cylinder(0.09, 0.07, 11, 0.6, 1.6, 0, col.trim, 10);
    k.prism([[0, 0], [0, 10], [-4.2, 0]], 0.04, 0.5, 2.4, 0, col.sail, "z");
    k.prism([[0, 0], [0, 8], [3.2, 0]], 0.04, 0.75, 2.4, 0, col.sail, "z");
    k.box(2.4, 0.9, 1.6, -1.8, 1.6, 0, col.deck);
  } else {
    k.box(3.6, 1.8, W * 0.66, -0.6, 1.6, 0, col.cabin);
    k.box(0.06, 0.6, W * 0.6, 1.22, 2.5, 0, col.glass, 0.6);
    k.box(2.6, 1.2, W * 0.56, -0.9, 3.4, 0, col.cabin);
    k.cylinder(0.25, 0.25, 1.6, -1.6, 4.6, 0, col.red, 16);
  }
  return [0, 1.6, 0];
}

function galleon(k, col, pirate, rand) {
  const L = 30;
  const B = 8;
  const rings = 26;
  const deckAt = (t) => 4.2 + Math.pow(Math.abs(t - 0.42) / 0.58, 2.2) * 2.4 + (t < 0.18 ? (0.18 - t) * 6 : 0);
  const halfW = (t) => (B / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06 + 0.04)), 0.55) * (t > 0.88 ? 1 - (t - 0.88) * 2.2 : 1);
  const section = (t) => {
    const x = -L / 2 + t * L;
    const w = Math.max(0.05, halfW(t));
    const top = deckAt(t);
    const keel = t > 0.94 ? (t - 0.94) * 14 : 0;
    return [[x, top, -w * 0.92], [x, top * 0.55, -w], [x, top * 0.18 + keel, -w * 0.7], [x, keel, 0], [x, top * 0.18 + keel, w * 0.7], [x, top * 0.55, w], [x, top, w * 0.92]];
  };
  const pos = [];
  for (let i = 0; i < rings; i++) {
    const a = section(i / rings);
    const b = section((i + 1) / rings);
    for (let j = 0; j < a.length - 1; j++) pos.push(...a[j], ...b[j], ...b[j + 1], ...a[j], ...b[j + 1], ...a[j + 1]);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  hull.computeVertexNormals();
  k.add(hull, col.paint);
  for (let i = 0; i < rings; i++) {
    const t = (i + 0.5) / rings;
    const x = -L / 2 + t * L;
    const w = halfW(t);
    for (const s of [-1, 1]) {
      k.box(L / rings + 0.02, 0.35, 0.12, x, deckAt(t) * 0.55 - 0.15, s * (w + 0.02), col.trim);
      if (i > 3 && i < rings - 4 && i % 2 === 0) k.box(0.5, 0.45, 0.1, x, deckAt(t) * 0.55 + 0.45, s * (w * 0.98 + 0.03), col.coal);
    }
  }
  const deck = new THREE.BoxGeometry(L * 0.86, 0.15, B * 0.86);
  deck.translate(0, 4.3, 0);
  k.add(deck, col.deck);
  k.box(6.5, 2.6, B * 0.82, -L / 2 + 3.6, 4.3, 0, col.paint);
  k.box(6.9, 0.3, B * 0.88, -L / 2 + 3.6, 6.9, 0, col.trim);
  for (let i = 0; i < 4; i++) k.box(0.1, 0.9, 0.9, -L / 2 + 0.25, 5.0, -2.4 + i * 1.6, col.light, 1);
  k.box(0.4, 0.5, 0.4, -L / 2 + 0.4, 7.4, 0, col.light, 1);
  k.box(4, 1.6, B * 0.7, L / 2 - 4.2, 4.3, 0, col.paint);
  const sprit = new THREE.CylinderGeometry(0.15, 0.22, 9, 10);
  sprit.rotateZ(-Math.PI / 2 + 0.28);
  sprit.translate(L / 2 + 2.6, 6.8, 0);
  k.add(sprit, col.trim);
  const sails = pirate ? rgb("#2b2826") : col.sail;
  const masts = [
    { x: 6.5, h: 22 },
    { x: -1, h: 26 },
    { x: -8.5, h: 18 },
  ];
  for (const m of masts) {
    k.cylinder(0.32, 0.22, m.h, m.x, 4.3, 0, col.trim, 12);
    const yards = m.h > 20 ? 3 : 2;
    for (let y = 0; y < yards; y++) {
      const yy = 4.3 + m.h * (0.38 + y * 0.22);
      const span = (B * 1.25) * (1 - y * 0.2);
      const yard = new THREE.CylinderGeometry(0.12, 0.12, span, 8);
      yard.rotateX(Math.PI / 2);
      yard.translate(m.x, yy, 0);
      k.add(yard, col.trim);
      const sh = m.h * 0.18;
      const sail = new THREE.PlaneGeometry(span * 0.92, sh, 8, 6);
      const sp = sail.getAttribute("position");
      for (let i = 0; i < sp.count; i++) {
        const u = sp.getX(i) / (span * 0.46);
        const v = sp.getY(i) / (sh / 2);
        sp.setZ(i, (1 - u * u) * (1 - v * v * 0.3) * sh * 0.22 + (rand() - 0.5) * 0.02);
      }
      sail.computeVertexNormals();
      sail.rotateY(Math.PI / 2);
      sail.translate(m.x + 0.35, yy - sh / 2 - 0.15, 0);
      k.add(sail, sails);
    }
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(m.x, 4.3 + m.h * 0.92, 0);
      const b2 = new THREE.Vector3(m.x - 1.5, 4.6, s * (halfW(0.5) - 0.2));
      const g = new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b2), 4);
      g.translate(0, a.distanceTo(b2) / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b2).normalize()));
      g.translate(b2.x, b2.y, b2.z);
      k.add(g, col.coal);
    }
  }
  k.prism([[L / 2 + 6.2, 8.6], [6.9, 4.3 + 22 * 0.56], [L / 2 - 1.4, 6.6]], 0.05, 0, 0, 0, sails, "z");
  k.box(0.05, 1.6, 2.6, -1 + 0.15, 4.3 + 26 + 0.4, 1.2, pirate ? rgb("#151515") : col.red);
  return [0, 8, 0];
}

export function vehicle(subject, rand) {
  const type = VEHICLES.includes(subject.vehicle?.type) ? subject.vehicle.type : guessVehicle(subject.label);
  const [c0, c1] = subject.colors;
  const palette = type === "train" ? ["#1f2a24", "#1c1c1e", "#5a1f1a"] : type === "boat" ? ["#f1eee6", "#25375c", "#b5352d"] : ["#b5352d", "#25375c", "#e7e3da", "#2d2f33", "#4d8748", "#c8a13f"];
  const paint = rgb(c0 || palette[Math.floor(rand() * palette.length)]);
  const col = {
    paint,
    glass: rgb("#1f2a36"),
    trim: rgb(c1 || "#2a2a2c"),
    tire: rgb("#151515"),
    rim: rgb("#c9cdd2"),
    light: rgb("#fff1c4"),
    tail: rgb("#c2241d"),
    brass: rgb("#c8a24a"),
    red: rgb("#9c2a22"),
    coal: rgb("#141414"),
    deck: rgb("#b48a5a"),
    cabin: rgb("#f1eee6"),
    sail: rgb("#f3efe4"),
  };
  const k = new Kit();
  let heart;
  if (type === "pickup") heart = pickup(k, col, rand);
  else if (type === "truck") heart = semi(k, { ...col, trim: rgb(c1 || "#e9e7e2") }, rand);
  else if (type === "bus") heart = bus(k, col, false);
  else if (type === "train") heart = train(k, col);
  else if (type === "galleon") heart = galleon(k, { ...col, paint: subject.colors[0] ? paint : rgb("#4a3020"), trim: rgb(subject.colors[1] || "#2a1d14"), deck: rgb("#8a6a45"), light: rgb("#ffc070") }, /pirate|black|skull|jolly/i.test(subject.label + " " + (subject.vehicle?.note || "")), rand);
  else if (type === "boat" || type === "sailboat") heart = boat(k, col, type === "sailboat");
  else heart = car(k, type, col);
  const geometry = k.geometry();
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const shift = new THREE.Vector3(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geometry.translate(shift.x, shift.y, shift.z);
  geometry.computeBoundingBox();
  return { geometry, heart: [heart[0] + shift.x, heart[1] + shift.y, heart[2] + shift.z], style: type };
}
