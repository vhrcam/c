import { length } from "./contours.js";
import { add, cross, dist, dot, lerp, madd, mul, norm, sub } from "./math.js";

export function handLines(scene, cam, F, pens) {
  const lines = [];
  const hit = (x, y) => {
    if (x < 0 || y < 0 || x >= cam.width || y >= cam.height) return null;
    const i = F.index(x, y);
    return { code: F.code[i], S: add(cam.eye, mul(cam.ray(x, y), F.depth[i])) };
  };
  scene.people.forEach((sk, idx) => {
    const skin = (idx + 1) * 16 + 1;
    for (const key of ["L", "R"]) {
      const rig = sk.arms[key].rig;
      if (!rig) continue;
      const P0 = rig.fingers[1].pts[0];
      const [ax, ay] = cam.project(P0);
      const [bx, by] = cam.project(madd(P0, cam.up, 0.01));
      const ppm = Math.hypot(bx - ax, by - ay) / 0.01;
      const digits = [...rig.fingers.map((f) => ({ ...f, from: 0 })), { ...rig.thumb, from: 1 }];
      for (const dg of digits) {
        const px = dg.rad(0.5) * ppm;
        if (px < 1.3) continue;
        const wf = Math.min(1.2, Math.max(0.6, px / 2.6));
        const push = (run, pen, width, kind) => {
          if (run.length >= 4 && length(run) > 2.5) lines.push({ pts: run, pen, width: width * wf, layer: "hands", kind, code: skin });
        };
        outline(dg, cam, hit, skin, push, pens);
        if (px > 2.2) detail(dg, rig, cam, hit, skin, push, pens);
      }
    }
  });
  return lines;
}

function samples(dg) {
  const total = dg.lens.reduce((a, b) => a + b, 0);
  const out = [];
  let acc = dg.lens.slice(0, dg.from).reduce((a, b) => a + b, 0);
  for (let j = dg.from; j < dg.lens.length; j++) {
    const n = 7;
    for (let s = j === dg.from ? 1 : 0; s < n; s++) {
      const u = s / n;
      out.push({ P: lerp(dg.pts[j], dg.pts[j + 1], u), d: dg.dirs[j].d, r: dg.rad((acc + u * dg.lens[j]) / total) });
    }
    acc += dg.lens[j];
  }
  const last = dg.lens.length - 1;
  const r = dg.rad(1);
  out.push({ P: madd(dg.pts[last + 1], dg.dirs[last].d, -r * 0.6), d: dg.dirs[last].d, r, tip: true });
  return out;
}

function outline(dg, cam, hit, skin, push, pens) {
  const S = samples(dg);
  const poly = [];
  const side = (s, sign) => {
    const v = norm(sub(s.P, cam.eye));
    return { p: madd(s.P, norm(cross(s.d, v)), sign * s.r), a: s.P, r: s.r };
  };
  for (const s of S) poly.push(side(s, 1));
  const t = S[S.length - 1];
  const v = norm(sub(t.P, cam.eye));
  const s3 = norm(cross(t.d, v));
  for (let q = 1; q < 6; q++) {
    const f = (q / 6) * Math.PI;
    poly.push({ p: madd(t.P, add(mul(s3, Math.cos(f)), mul(t.d, Math.sin(f))), t.r), a: t.P, r: t.r });
  }
  for (let i = S.length - 1; i >= 0; i--) poly.push(side(S[i], -1));
  let run = [];
  for (const e of poly) {
    const [px, py] = cam.project(e.p);
    const [qx, qy] = cam.project(e.a);
    const l = Math.hypot(px - qx, py - qy) || 1;
    const ox = (px - qx) / l;
    const oy = (py - qy) / l;
    const inn = hit(px - ox, py - oy);
    const out = hit(px + ox * 1.6, py + oy * 1.6);
    const mine = inn && inn.code === skin && dist(inn.S, e.p) < e.r * 1.4 + 0.002;
    const behind = out && out.code >= 16 && (out.code & 15) === 1;
    if (mine && behind) run.push(px, py);
    else {
      push(run, pens.ink, 0.95, "finger");
      run = [];
    }
  }
  push(run, pens.ink, 0.95, "finger");
}

function detail(dg, rig, cam, hit, skin, push, pens) {
  const total = dg.lens.reduce((a, b) => a + b, 0);
  const last = dg.lens.length - 1;
  const surf = (j, u, v) => {
    const { d, n } = dg.dirs[j];
    const sd = norm(cross(d, n));
    const t = (dg.lens.slice(0, j).reduce((a, b) => a + b, 0) + u * dg.lens[j]) / total;
    const nrm = add(mul(n, -Math.cos(v)), mul(sd, Math.sin(v)));
    return { Q: madd(lerp(dg.pts[j], dg.pts[j + 1], u), nrm, dg.rad(t) * 1.02), nrm, r: dg.rad(t) };
  };
  const trace = (pts, pen, width, kind) => {
    let run = [];
    for (const { Q, nrm, r } of pts) {
      const [x, y] = cam.project(Q);
      const h = hit(x, y);
      const ok = dot(nrm, sub(cam.eye, Q)) > 0 && h && h.code === skin && dist(h.S, Q) < r * 0.8 + 0.0015;
      if (ok) run.push(x, y);
      else {
        push(run, pen, width, kind);
        run = [];
      }
    }
    push(run, pen, width, kind);
  };
  const vm = rig.nail === "almond" ? 0.6 : 0.7;
  const width = (u) => (rig.nail === "almond" ? vm * (1 - 0.55 * Math.max(0, (u - 0.6) / 0.35) ** 1.5) : vm);
  const cut = (v) => (rig.nail === "square" ? 0.46 : 0.44 + 0.08 * (1 - Math.cos((v / vm) * Math.PI * 0.5)));
  const nail = [];
  for (let q = 0; q <= 5; q++) {
    const u = 0.92 - (q / 5) * (0.92 - cut(-vm));
    nail.push(surf(last, u, -width(u)));
  }
  for (let q = 1; q < 8; q++) {
    const v = -vm + (q / 8) * 2 * vm;
    nail.push(surf(last, cut(v) - (rig.nail === "square" ? 0 : 0.03 * Math.cos((v / vm) * Math.PI * 0.5)), v));
  }
  for (let q = 5; q >= 0; q--) {
    const u = 0.92 - (q / 5) * (0.92 - cut(vm));
    nail.push(surf(last, u, width(u)));
  }
  trace(nail, pens.mouth, 0.75, "nail");
  const creases = dg.from ? [[last, 0.08]] : [[1, 0.06], [1, 0.15], [2, 0.08]];
  for (const [j, u] of creases) {
    const arc = [];
    for (let q = 0; q <= 8; q++) {
      const v = -0.85 + (q / 8) * 1.7;
      arc.push(surf(j, u - 0.03 * Math.cos(v), v));
    }
    trace(arc, pens.mouth, 0.7, "crease");
  }
}
