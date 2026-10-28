import { random } from "../random.js";
import { MAT } from "./figure.js";
import { add, dist, madd, mul, toWorld } from "./math.js";

const SKULL = {
  f: { c: [-0.006, 0.02, 0], r: [0.088, 0.093, 0.08] },
  m: { c: [-0.006, 0.02, 0], r: [0.091, 0.096, 0.083] },
};

function radius(e, d) {
  return 1 / Math.sqrt((d[0] / e.r[0]) ** 2 + (d[1] / e.r[1]) ** 2 + (d[2] / e.r[2]) ** 2);
}

export function hairLines(scene, cam, F, pens, pal, seed) {
  const lines = [];
  const flow = [0, 0];
  scene.people.forEach((sk, idx) => {
    const rng = random((seed ^ (0x68e31da4 + idx * 977)) >>> 0);
    const f = sk.spec.sex === "f";
    const code = (idx + 1) * 16 + (f ? MAT.hairB : MAT.hairA);
    const H = sk.head;
    const k = sk.hk;
    const e = sk.skull || SKULL[sk.spec.sex];
    const [ox, oy] = cam.project(H.o);
    const [ux, uy] = cam.project(madd(H.o, cam.up, 0.1 * k));
    const ppm = Math.hypot(ux - ox, uy - oy) / (0.1 * k);
    const head = 0.1 * k * ppm;
    if (head < 18) return;
    const hair = (x, y) => x >= 0 && y >= 0 && x < cam.width && y < cam.height && F.codeAt(x, y) === code;
    const deep = (x, y, r) => hair(x, y) && hair(x + r, y) && hair(x - r, y) && hair(x, y + r) && hair(x, y - r);

    const band = 0.011 * k * ppm;
    const phi = rng.range(0.42, 0.68);
    const shine = [];
    for (let i = 0; i <= 160; i++) {
      const th = (i / 160) * Math.PI * 2;
      const d = [Math.cos(phi) * Math.cos(th), Math.sin(phi), Math.cos(phi) * Math.sin(th)];
      const rr = radius(e, d) + 0.014;
      const P = toWorld(H, [(e.c[0] + d[0] * rr) * k, (e.c[1] + d[1] * rr) * k, (e.c[2] + d[2] * rr) * k]);
      const [x, y] = cam.project(P);
      if (!deep(x, y, 2.5)) continue;
      const S = add(cam.eye, mul(cam.ray(x, y), F.depthAt(x, y)));
      if (dist(S, P) > 0.03 * k) continue;
      shine.push([x, y]);
    }
    const step = Math.max(1.4, band * 0.28);
    let acc = 0;
    for (let i = 1; i < shine.length; i++) {
      const [ax, ay] = shine[i - 1];
      const [bx, by] = shine[i];
      const seg = Math.hypot(bx - ax, by - ay);
      if (seg > band * 2) continue;
      for (acc += seg; acc >= step; acc -= step) {
        const t = 1 - acc / Math.max(seg, 1e-6);
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        if (rng() < 0.15) continue;
        F.along(x, y, flow);
        const off = rng.range(-0.35, 0.35) * band;
        const len = band * rng.range(0.7, 1.4);
        const cx = x + flow[0] * off;
        const cy = y + flow[1] * off;
        const pts = [cx - flow[0] * len * 0.5, cy - flow[1] * len * 0.5, cx + flow[0] * len * 0.5, cy + flow[1] * len * 0.5];
        if (!deep(pts[0], pts[1], 1.5) || !deep(pts[2], pts[3], 1.5)) continue;
        lines.push({ pts, pen: pal.paper, width: Math.max(1.8, Math.min(3.4, band * 0.32)), layer: "shine", order: rng() });
        if (rng() < 0.45) {
          const down = flow[1] >= 0 ? 1 : -1;
          const tx = cx + flow[0] * down * len * 0.55;
          const ty = cy + flow[1] * down * len * 0.55;
          const spike = band * rng.range(0.5, 1.1);
          const tick = [tx - flow[1] * 1.2, ty + flow[0] * 1.2, tx + flow[0] * down * spike, ty + flow[1] * down * spike, tx + flow[1] * 1.2, ty - flow[0] * 1.2];
          if (deep(tick[2], tick[3], 1)) lines.push({ pts: tick, pen: pens.hairDark(idx + 1), width: 0.8, layer: "shine", order: rng() + 1 });
        }
      }
    }

    const [wx, wy] = cam.project(add(H.o, mul(scene.wind, 0.2)));
    const wl = Math.hypot(wx - ox, wy - oy) || 1;
    const wind = [(wx - ox) / wl, (wy - oy) / wl];
    const edges = [];
    const reach = head * 6;
    for (let y = Math.max(0, oy - reach); y < Math.min(cam.height, oy + reach); y += 2) {
      for (let x = Math.max(0, ox - reach); x < Math.min(cam.width, ox + reach); x += 2) {
        if (!hair(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
          if (dx * wind[0] + dy * wind[1] < 0.2) continue;
          if (F.codeAt(x + dx * 3, y + dy * 3) < 16) {
            edges.push([x, y, dx, dy]);
            break;
          }
        }
      }
    }
    const count = Math.min(edges.length, Math.round(rng.range(4, 10) * Math.min(2.5, head / 40)));
    const pen = pens.hairDark(idx + 1);
    for (let n = 0; n < count; n++) {
      const [x0, y0, dx, dy] = edges.splice(rng.int(0, edges.length - 1), 1)[0];
      let vx = dx + wind[0] * 1.3;
      let vy = dy + wind[1] * 1.3 + 0.15;
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      const len = head * rng.range(0.15, 0.55);
      const turn = rng.range(-0.05, 0.05);
      const wave = rng.range(0.6, 1.6);
      let x = x0 - vx * 2;
      let y = y0 - vy * 2;
      const pts = [x, y];
      for (let s = 0; s < len; s += 2) {
        const a = turn + Math.sin(s * 0.12 + n) * 0.04 * wave;
        [vx, vy] = [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
        x += vx * 2;
        y += vy * 2;
        if (s > 6 && F.codeAt(x, y) >= 16) break;
        pts.push(x, y);
      }
      if (pts.length >= 8) lines.push({ pts, pen, width: 0.75, layer: "flyaway", order: n / count });
    }
  });
  return lines;
}
