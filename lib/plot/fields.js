import { DEPTH_MAX } from "./gbuffer.js";

const LOG = Math.log(1 + DEPTH_MAX);

export function fields(g, ss) {
  const { W, H, a, b, c } = g;
  const N = W * H;
  const code = new Uint8Array(N);
  const depth = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    code[i] = a[j + 1];
    depth[i] = code[i] ? Math.exp(((a[j + 2] * 256 + a[j + 3]) / 65535) * LOG) - 1 : Infinity;
  }

  const index = (x, y) => {
    const gx = Math.min(W - 1, Math.max(0, Math.round(x * ss - 0.5)));
    const gy = Math.min(H - 1, Math.max(0, Math.round(y * ss - 0.5)));
    return gy * W + gx;
  };

  const sample = (buf, ch, x, y) => {
    const fx = Math.min(W - 1.001, Math.max(0, x * ss - 0.5));
    const fy = Math.min(H - 1.001, Math.max(0, y * ss - 0.5));
    const x0 = fx | 0;
    const y0 = fy | 0;
    const u = fx - x0;
    const v = fy - y0;
    const i = (y0 * W + x0) * 4 + ch;
    const r = W * 4;
    return ((buf[i] * (1 - u) + buf[i + 4] * u) * (1 - v) + (buf[i + r] * (1 - u) + buf[i + r + 4] * u) * v) / 255;
  };

  const along = (x, y, out) => {
    const vx = sample(b, 0, x, y) * 2 - 1;
    const vy = sample(b, 1, x, y) * 2 - 1;
    const l = Math.hypot(vx, vy) || 1;
    out[0] = vx / l;
    out[1] = vy / l;
    return out;
  };

  const ring = (x, y, out) => {
    const t = Math.atan2(sample(b, 3, x, y) * 2 - 1, sample(b, 2, x, y) * 2 - 1) / 2;
    out[0] = Math.cos(t);
    out[1] = Math.sin(t);
    return out;
  };

  return {
    W,
    H,
    ss,
    w: W / ss,
    h: H / ss,
    raw: g,
    code,
    depth,
    index,
    codeAt: (x, y) => code[index(x, y)],
    depthAt: (x, y) => depth[index(x, y)],
    ndv: (x, y) => sample(a, 0, x, y),
    light: (x, y) => sample(c, 0, x, y),
    ao: (x, y) => sample(c, 1, x, y),
    rim: (x, y) => sample(c, 2, x, y),
    aux: (x, y) => sample(c, 3, x, y),
    along,
    ring,
  };
}
