function sunRay(ctx) {
  const { cam, sun } = ctx;
  const d = cam.ray(sun[0], sun[1]);
  const hl = Math.hypot(d[0], d[2]) || 1;
  const e = Math.max(Math.atan2(d[1], hl), Math.atan(1 / 3.5));
  return [(d[0] / hl) * Math.cos(e), Math.sin(e), (d[2] / hl) * Math.cos(e)];
}

function eachFigurePoint(ctx, fn) {
  const { F, cam, w, h } = ctx;
  const [ex, ey, ez] = cam.eye;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = F.index(x, y);
      const c = F.code[i];
      if (c < 16) continue;
      const r = cam.ray(x, y);
      const d = F.depth[i];
      fn(ex + r[0] * d, ey + r[1] * d, ez + r[2] * d, c);
    }
  }
}

function grow(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) last = x;
      if (x - last <= r) tmp[y * w + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (mask[y * w + x]) last = x;
      if (last - x <= r) tmp[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y;
      if (y - last <= r) out[y * w + x] = 1;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y;
      if (last - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

function close(mask, w, h, r) {
  const g = grow(mask, w, h, r);
  for (let i = 0; i < g.length; i++) g[i] = g[i] ? 0 : 1;
  const e = grow(g, w, h, r);
  for (let i = 0; i < e.length; i++) e[i] = e[i] ? 0 : 1;
  return e;
}

function splat(ctx, mask, src, P, c) {
  const { cam, w, h } = ctx;
  const [px, py, z] = cam.project(P);
  if (z <= 0) return;
  const x = Math.round(px);
  const y = Math.round(py);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  mask[y * w + x] = 1;
  if (src) src[y * w + x] = c;
}

export function castShadow(ctx) {
  const { F, w, h, horizon, pal, rng } = ctx;
  const L = sunRay(ctx);
  const mask = new Uint8Array(w * h);
  const pts = [];
  let floor = Infinity;
  eachFigurePoint(ctx, (x, y, z) => {
    pts.push(x, y, z);
    floor = Math.min(floor, y);
  });
  for (let i = 0; i < pts.length; i += 3) {
    const t = (pts[i + 1] - floor) / L[1];
    splat(ctx, mask, null, [pts[i] - L[0] * t, floor, pts[i + 2] - L[2] * t], 0);
  }
  const shade = close(mask, w, h, 2);
  const ground = (x, y) => shade[(y | 0) * w + (x | 0)] === 1 && F.codeAt(x, y) === 8;
  const lines = [];
  const pen = pal.sky[pal.sky.length - 2];
  const gap = rng.range(2, 2.6);
  const tilt = rng.range(-0.06, 0.06);
  for (let y0 = Math.max(0, Math.ceil(horizon)); y0 < h; y0 += gap) {
    let run = [];
    const flush = () => {
      if (run.length >= 4 && Math.abs(run[run.length - 2] - run[0]) > 3) lines.push({ pts: run, pen, width: 0.85, layer: "shadow", order: (y0 - horizon) / (h - horizon) });
      run = [];
    };
    for (let x = 0; x < w; x += 2) {
      const y = y0 + (x - w / 2) * tilt;
      if (y >= 0 && y < h && ground(x, y)) run.push(x, y);
      else flush();
    }
    flush();
  }
  return lines;
}
