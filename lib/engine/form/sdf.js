import { add, cross, len, lerp, mul, norm, sub } from "../math";

export const GLSL_PRIMS = /* glsl */ `
float smin(float a, float b, float k) { if (k <= 0.0) return min(a, b); float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdEll(vec3 q, vec3 r) { float k0 = length(q / r); float k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdRBox(vec3 q, vec3 b, float r) { vec3 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r; }
float sdRCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float sdCyl(vec3 p, vec3 a, vec3 b, float r) {
  vec3 ba = b - a;
  vec3 pa = p - a;
  float baba = dot(ba, ba);
  float paba = dot(pa, ba);
  float x = length(pa * baba - ba * paba) - r * baba;
  float y = abs(paba - baba * 0.5) - baba * 0.5;
  float x2 = x * x;
  float y2 = y * y * baba;
  float d = (max(x, y) < 0.0) ? -min(x2, y2) : (((x > 0.0) ? x2 : 0.0) + ((y > 0.0) ? y2 : 0.0));
  return sign(d) * sqrt(abs(d)) / baba;
}
float sdCone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  float rba = rb - ra;
  float baba = dot(b - a, b - a);
  float papa = dot(p - a, p - a);
  float paba = dot(p - a, b - a) / baba;
  float x = sqrt(max(0.0, papa - paba * paba * baba));
  float cax = max(0.0, x - ((paba < 0.5) ? ra : rb));
  float cay = abs(paba - 0.5) - 0.5;
  float k = rba * rba + baba;
  float f = clamp((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
  float cbx = x - ra - f * rba;
  float cby = paba - f;
  float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
}
float sdTorus(vec3 q, float R, float r) { return length(vec2(length(q.xz) - R, q.y)) - r; }
`;

const f = (x) => {
  const v = Number.isFinite(x) ? x : 0;
  const s = v.toFixed(5);
  return s.includes(".") ? s : `${s}.0`;
};
const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
const m3 = (m) => `mat3(${m.map(f).join(", ")})`;

function euler(rot) {
  const [x, y, z] = rot.map((d) => (d * Math.PI) / 180);
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);
  const r = [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz, cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz, -sy, sx * cy, cx * cy];
  return { r, t: [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]] };
}

function basis(axis) {
  const y = norm(axis);
  const helper = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = norm(cross(helper, y));
  const z = cross(x, y);
  return { x, y, z };
}

function catmull(points, steps) {
  if (points.length < 3) return points;
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function resample(values, n) {
  if (!values.length) return Array(n).fill(0.05);
  if (values.length === 1) return Array(n).fill(values[0]);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / Math.max(1, n - 1)) * (values.length - 1);
    const k = Math.min(values.length - 2, Math.floor(t));
    return values[k] + (values[k + 1] - values[k]) * (t - k);
  });
}

function safeCone(a, b, r1, r2) {
  const l = len(sub(b, a));
  const gap = Math.abs(r1 - r2);
  if (l < 1e-4) return { a, b: add(a, [0, 1e-3, 0]), r1: Math.max(r1, r2), r2: Math.max(r1, r2) };
  if (gap > l * 0.95) {
    const keep = l * 0.95;
    return r1 > r2 ? { a, b, r1, r2: r1 - keep } : { a, b, r1: r2 - keep, r2 };
  }
  return { a, b, r1, r2 };
}

export function expand(parts) {
  const prims = [];
  const push = (p, src, extra = {}) => prims.push({ ...p, part: src.index, name: src.name, color: src.color, under: src.under, fur: src.fur ?? 1, flow: src.flow, blend: src.blend, cut: src.cut, ...extra });
  parts.forEach((part, index) => {
    const src = { ...part, index };
    const r1 = part.r[0];
    const r2 = part.r[1] ?? r1;
    if (part.shape === "sweep") {
      const raw = part.path.length >= 2 ? part.path : [part.a, part.b];
      const pts = catmull(raw, raw.length > 2 ? 3 : 1);
      const radii = resample(part.radii.length ? part.radii : [r1, r2], pts.length);
      for (let i = 0; i < pts.length - 1; i++) {
        const c = safeCone(pts[i], pts[i + 1], radii[i], radii[i + 1]);
        push({ shape: "rcone", ...c, axis: norm(sub(pts[i + 1], pts[i])), along: [i / (pts.length - 1), (i + 1) / (pts.length - 1)] }, src, { blend: i ? 0 : part.blend });
      }
    } else if (part.shape === "capsule") {
      push({ shape: "rcone", ...safeCone(part.a, part.b, r1, r2), axis: norm(sub(part.b, part.a)), along: [0, 1] }, src);
    } else if (part.shape === "cylinder") {
      push({ shape: "cyl", a: part.a, b: part.b, r1, axis: norm(sub(part.b, part.a)) }, src);
    } else if (part.shape === "cone") {
      push({ shape: "cone", a: part.a, b: part.b, r1, r2, axis: norm(sub(part.b, part.a)) }, src);
    } else if (part.shape === "torus") {
      const axis = len(part.b) > 1e-6 ? norm(part.b) : [0, 1, 0];
      push({ shape: "torus", c: part.a, axis, R: r1, r: Math.max(0.002, r2 === r1 ? r1 * 0.25 : r2), frame: basis(axis) }, src);
    } else if (part.shape === "lathe") {
      const axis = len(part.b) > 1e-6 ? norm(part.b) : [0, 1, 0];
      const profile = part.profile.length >= 2 ? part.profile : [[r1, 0], [r1, 1]];
      push({ shape: "lathe", c: part.a, axis, frame: basis(axis), profile }, src);
    } else if (part.shape === "box") {
      const size = part.b.map((s) => Math.max(0.002, Math.abs(s) / 2));
      push({ shape: "box", c: part.a, size, round: Math.min(r1, ...size) * 0.9, m: euler(part.rot) }, src);
    } else {
      const radii = part.b.map((s) => Math.max(0.002, Math.abs(s)));
      push({ shape: "ell", c: part.a, radii, m: euler(part.rot) }, src);
    }
  });
  return prims;
}

function expr(p, i, k = "") {
  if (p.shape === "rcone") return `sdRCone(p, ${v3(p.a)}, ${v3(p.b)}, ${f(p.r1)}, ${f(p.r2)})`;
  if (p.shape === "cyl") return `sdCyl(p, ${v3(p.a)}, ${v3(p.b)}, ${f(p.r1)})`;
  if (p.shape === "cone") return `sdCone(p, ${v3(p.a)}, ${v3(p.b)}, ${f(p.r1)}, ${f(p.r2)})`;
  if (p.shape === "torus") {
    const { x, y, z } = p.frame;
    const q = `(p - ${v3(p.c)})`;
    return `sdTorus(vec3(dot(${q}, ${v3(x)}), dot(${q}, ${v3(y)}), dot(${q}, ${v3(z)})), ${f(p.R)}, ${f(p.r)})`;
  }
  if (p.shape === "lathe") return `lathe${k}_${i}(p)`;
  if (p.shape === "box") return `sdRBox(${m3(p.m.t)} * (p - ${v3(p.c)}), ${v3(p.size)}, ${f(p.round)})`;
  return `sdEll(${m3(p.m.t)} * (p - ${v3(p.c)}), ${v3(p.radii)})`;
}

function latheFn(p, i, k = "") {
  const right = p.profile.map(([r, h]) => [Math.max(0.001, r), h]);
  const left = [...right].reverse().map(([r, h]) => [-r, h]);
  const poly = [...right, ...left];
  const n = poly.length;
  const { x, y, z } = p.frame;
  return `
float lathe${k}_${i}(vec3 p) {
  const vec2 v[${n}] = vec2[${n}](${poly.map(([a, b]) => `vec2(${f(a)}, ${f(b)})`).join(", ")});
  vec3 q = p - ${v3(p.c)};
  vec2 s = vec2(length(vec2(dot(q, ${v3(x)}), dot(q, ${v3(z)}))), dot(q, ${v3(y)}));
  float d = dot(s - v[0], s - v[0]);
  float sg = 1.0;
  for (int k = 0, j = ${n - 1}; k < ${n}; j = k, k++) {
    vec2 e = v[j] - v[k];
    vec2 w = s - v[k];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(s.y >= v[k].y, s.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) sg *= -1.0;
  }
  return sg * sqrt(d);
}`;
}

export function compile(prims, k = "") {
  const fns = prims.map((p, i) => (p.shape === "lathe" ? latheFn(p, i, k) : "")).join("\n");
  const body = (track) =>
    prims
      .map((p, i) => {
        const e = `e = ${expr(p, i, k)};`;
        if (p.cut) return `${e} d = smax(d, -e, ${f(p.blend)});`;
        const pick = track ? ` if (e < best) { best = e; id = ${f(i)}; }` : "";
        return `${e}${pick} d = smin(d, e, ${f(p.blend)});`;
      })
      .join("\n  ");
  return `${k === "" ? GLSL_PRIMS : ""}
${fns}
float sdf${k}(vec3 p) {
  float d = 1e5;
  float e;
  ${body(false)}
  return d;
}
float sdfId${k}(vec3 p, out float id) {
  float d = 1e5;
  float e;
  float best = 1e5;
  id = 0.0;
  ${body(true)}
  return d;
}
${
  k === ""
    ? `vec3 sdfNormal(vec3 p, float h) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * sdf(p + k.xyy * h) + k.yyx * sdf(p + k.yyx * h) + k.yxy * sdf(p + k.yxy * h) + k.xxx * sdf(p + k.xxx * h));
}`
    : ""
}
`;
}

export function bounds(prims) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const grow = (c, r) => {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], c[k] - r);
      hi[k] = Math.max(hi[k], c[k] + r);
    }
  };
  for (const p of prims) {
    if (p.cut) continue;
    if (p.shape === "rcone" || p.shape === "cone") {
      grow(p.a, p.r1);
      grow(p.b, p.r2);
    } else if (p.shape === "cyl") {
      grow(p.a, p.r1);
      grow(p.b, p.r1);
    } else if (p.shape === "torus") grow(p.c, p.R + p.r);
    else if (p.shape === "lathe") {
      const rmax = Math.max(...p.profile.map((q) => q[0]));
      for (const [, h] of p.profile) grow(add(p.c, mul(p.axis, h)), rmax);
    } else if (p.shape === "box") grow(p.c, len(p.size));
    else grow(p.c, Math.max(...p.radii));
  }
  if (!Number.isFinite(lo[0])) return { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] };
  return { min: lo, max: hi };
}

export function axisOf(p) {
  if (p.axis) return p.axis;
  if (p.shape === "ell") {
    const k = p.radii.indexOf(Math.max(...p.radii));
    const m = p.m.r;
    return norm([m[k], m[3 + k], m[6 + k]]);
  }
  return [0, 1, 0];
}

export function centerOf(p) {
  if (p.c) return p.c;
  return lerp(p.a, p.b, 0.5);
}

export function transformParts(parts, scale, offset) {
  const P = (q) => add(mul(q, scale), offset);
  const points = ["capsule", "cylinder", "cone", "sweep"];
  return parts.map((p) => ({
    ...p,
    a: p.a && P(p.a),
    b: p.b && (points.includes(p.shape) ? P(p.b) : p.shape === "ellipsoid" || p.shape === "box" ? mul(p.b, scale) : p.b),
    r: p.r.map((r) => r * scale),
    path: p.path.map(P),
    radii: p.radii.map((r) => r * scale),
    profile: p.profile.map(([r, h]) => [r * scale, h * scale]),
    blend: p.blend * scale,
  }));
}
