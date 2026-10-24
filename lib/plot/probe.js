import { add, dist, dot, len, madd, mul, sub } from "./math.js";

function rcone(p, a, b, r1, r2) {
  const ba = sub(b, a);
  const l2 = dot(ba, ba);
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pa = sub(p, a);
  const y = dot(pa, ba);
  const z = y - l2;
  const xv = sub(mul(pa, l2), mul(ba, y));
  const x2 = dot(xv, xv);
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt((x2 * a2) * il2) + y * rr) * il2 - r1;
}

function ellD(q, r) {
  const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
  const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]));
  return (k0 * (k0 - 1)) / (k1 || 1e-9);
}

const local = (q, axes) => axes.map((a) => dot(q, a));

function leaf(n, p) {
  let d;
  if (n.kind === "sph") d = len(sub(p, n.c)) - n.r;
  else if (n.kind === "ell") d = ellD(local(sub(p, n.c), n.axes), n.r);
  else if (n.kind === "rc") d = rcone(p, n.a, n.b, n.r1, n.r2);
  else if (n.kind === "blade") d = rcone(add(p, mul(n.n, dot(sub(p, n.a), n.n) * (n.f - 1))), n.a, n.b, n.r1, n.r2) / n.f;
  else if (n.kind === "box") {
    const q = local(sub(p, n.c), n.axes).map((v, i) => Math.abs(v) - n.half[i] + n.round);
    d = Math.hypot(...q.map((v) => Math.max(v, 0))) + Math.min(Math.max(...q), 0) - n.round;
  } else return 1e5;
  for (const c of n.cut ? [n.cut].flat() : []) d = Math.max(d, dot(p, c.n) - c.d);
  return d;
}

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export function sdf(node, p) {
  if (!node.op) return leaf(node, p);
  let d = 1e5;
  for (const c of node.items) {
    const e = sdf(c, p);
    d = node.op === "smin" && node.k > 0 ? smin(d, e, node.k) : Math.min(d, e);
  }
  return d;
}

export function onto(node, target, dir, reach = 0.3) {
  const from = madd(target, dir, -reach);
  let t = 0;
  for (let i = 0; i < 80; i++) {
    const p = madd(from, dir, t);
    const d = sdf(node, p);
    if (d < 2e-4) return p;
    t += Math.max(d * 0.9, 2e-4);
    if (t > reach * 2) return null;
  }
  return null;
}

export function seen(cam, F, P, codes, tol) {
  const [sx, sy, z] = cam.project(P);
  if (z <= 0 || sx < 0 || sy < 0 || sx >= cam.width || sy >= cam.height) return null;
  const i = F.index(sx, sy);
  if (!codes.includes(F.code[i])) return null;
  const S = add(cam.eye, mul(cam.ray(sx, sy), F.depth[i]));
  return dist(S, P) < tol ? [sx, sy] : null;
}
