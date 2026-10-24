export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const madd = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
export const dist = (a, b) => len(sub(a, b));
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const mix = (a, b, t) => a + (b - a) * t;

export function smooth(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rotate(v, axis, angle) {
  const k = norm(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

export function frame(o, forward, up) {
  const x = norm(forward);
  const z = norm(cross(x, up));
  return { o, x, y: cross(z, x), z };
}

export const toWorld = (F, l) => add(F.o, add(add(mul(F.x, l[0]), mul(F.y, l[1])), mul(F.z, l[2])));
export const toDir = (F, l) => add(add(mul(F.x, l[0]), mul(F.y, l[1])), mul(F.z, l[2]));

export function turn(F, axis, angle, o = F.o) {
  return { o, x: rotate(F.x, axis, angle), y: rotate(F.y, axis, angle), z: rotate(F.z, axis, angle) };
}

export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return add(add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)), add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)));
}
