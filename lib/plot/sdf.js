import { add, dist, len, lerp, mul, sub } from "./math.js";

const ROW = 12;
const KIND = { sph: 0, ell: 1, rc: 2, skirt: 3, blade: 4, box: 5 };

export const LIB = `
uniform highp sampler2D u_data;
uniform float u_count;
vec4 D(int i, int j) { return texelFetch(u_data, ivec2(j, i), 0); }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float rcone(vec3 p, vec4 A, vec4 B) {
  vec3 ba = B.xyz - A.xyz;
  float l2 = dot(ba, ba);
  float rr = A.w - B.w;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - A.xyz;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - B.w;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - A.w;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - A.w;
}
float ellD(vec3 q, vec3 r) { float k0 = length(q / r); float k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / k1; }
float rbox(vec3 q, vec4 b) { vec3 d = abs(q) - b.xyz + b.w; return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - b.w; }
float skirt(vec3 p, int i) {
  vec4 A = D(i, 1);
  vec4 X = D(i, 2);
  vec4 U = D(i, 3);
  vec4 V = D(i, 4);
  vec4 E = D(i, 5);
  vec3 pa = p - A.xyz;
  float h = dot(pa, X.xyz);
  vec3 rp = pa - X.xyz * h;
  float t = clamp(h / A.w, 0.0, 1.0);
  float ex = mix(D(i, 11).x, 1.0, min(1.0, t * 2.5));
  vec2 cs = vec2(dot(rp, U.xyz) / ex, dot(rp, V.xyz));
  float q = length(cs);
  float ang = atan(cs.y, cs.x);
  float tri = abs(fract(ang * V.w / 6.2831853 + sin(ang * 3.0) * 0.12) - 0.5) * 4.0 - 1.0;
  float wave = mix(sin(ang * V.w + sin(ang * 3.0) * 1.3), tri, E.y);
  float tc = max(t, 0.04);
  float r = mix(X.w, U.w, pow(tc, E.z)) + E.x * t * t * wave;
  float slope = (U.w - X.w) * E.z * pow(tc, E.z - 1.0) / A.w;
  float g = E.x * t * t * V.w * mix(1.0, 0.64, E.y) / max(q, 0.03);
  float side = ex * (q - r) / sqrt(1.0 + slope * slope + g * g);
  if (E.w > 0.0) side = abs(side + E.w) - E.w;
  return max(max(side, h - A.w), -h);
}
float leaf(vec3 p, int i, vec4 h) {
  float d;
  if (h.y == 2.0) d = rcone(p, D(i, 1), D(i, 2));
  else if (h.y == 1.0) {
    vec3 q = p - D(i, 1).xyz;
    d = ellD(vec3(dot(q, D(i, 3).xyz), dot(q, D(i, 4).xyz), dot(q, D(i, 5).xyz)), D(i, 2).xyz);
  } else if (h.y == 0.0) {
    vec4 s = D(i, 1);
    d = length(p - s.xyz) - s.w;
  } else if (h.y == 4.0) {
    vec4 A = D(i, 1);
    vec4 N = D(i, 3);
    d = rcone(p + N.xyz * (dot(p - A.xyz, N.xyz) * (N.w - 1.0)), A, D(i, 2)) / N.w;
  } else if (h.y == 5.0) {
    vec3 q = p - D(i, 1).xyz;
    d = rbox(vec3(dot(q, D(i, 3).xyz), dot(q, D(i, 4).xyz), dot(q, D(i, 5).xyz)), D(i, 2));
  } else d = skirt(p, i);
  for (int c = 0; c < 3; c++) {
    if (float(c) >= h.z) break;
    vec4 cp = D(i, 8 + c);
    d = max(d, dot(p, cp.xyz) - cp.w);
  }
  return d;
}
float rconeH(vec3 p, int i) { vec3 a = D(i, 1).xyz; vec3 ba = D(i, 2).xyz - a; return clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0); }

float figures(vec3 p) {
  float best = 1e5;
  float d = 1e5;
  int n = int(u_count);
  int i = 0;
  for (int it = 0; it < 16384; it++) {
    if (i >= n) break;
    vec4 h = D(i, 0);
    if (h.x == 0.0) {
      vec4 b = D(i, 1);
      float bd = length(p - b.xyz) - b.w;
      if (bd > best) i = int(h.y);
      else if (bd > 0.02) {
        best = bd;
        i = int(h.y);
      } else {
        d = 1e5;
        i++;
      }
    } else if (h.x == 1.0) {
      vec4 b = D(i, 1);
      float bd = length(p - b.xyz) - b.w;
      if (bd >= d + h.z) i = int(h.y);
      else if (bd > 0.02 + h.z) {
        d = min(d, bd - h.z * 0.25);
        i = int(h.y);
      } else i++;
    } else if (h.x == 2.0) {
      float e = leaf(p, i, h);
      d = h.w > 0.0 ? smin(d, e, h.w) : min(d, e);
      i++;
    } else {
      best = min(best, d);
      i++;
    }
  }
  return best;
}

void figureInfo(vec3 p, out float mat, out float aux, out vec3 flow) {
  float best = 1e5;
  vec3 lead = vec3(0.0, 1.0, 0.0);
  vec3 acc = vec3(0.0);
  mat = 0.0;
  aux = 0.0;
  int n = int(u_count);
  int i = 0;
  for (int it = 0; it < 16384; it++) {
    if (i >= n) break;
    vec4 h = D(i, 0);
    if (h.x < 1.5) {
      vec4 b = D(i, 1);
      i = length(p - b.xyz) - b.w > 0.03 ? int(h.y) : i + 1;
    } else if (h.x == 2.0) {
      float e = leaf(p, i, h);
      vec4 ax = D(i, 6);
      vec4 au = D(i, 7);
      if (e < best) {
        best = e;
        mat = ax.w;
        aux = au.z > 0.5 ? mix(au.x, au.y, h.y == 2.0 || h.y == 4.0 ? rconeH(p, i) : 0.0) : 0.0;
        lead = ax.xyz;
      }
      float w = exp(-max(e, 0.0) * 260.0);
      vec3 v = ax.xyz;
      if (dot(v, acc) < 0.0) v = -v;
      acc += v * w;
      i++;
    } else i++;
  }
  flow = length(acc) > 1e-5 ? normalize(acc) : lead;
  if (dot(flow, lead) < 0.0) flow = -flow;
}
`;

function leafBound(l) {
  if (l.kind === "sph") return { c: l.c, r: l.r };
  if (l.kind === "ell") return { c: l.c, r: Math.max(...l.r) };
  if (l.kind === "rc" || l.kind === "blade") return { c: lerp(l.a, l.b, 0.5), r: dist(l.a, l.b) / 2 + Math.max(l.r1, l.r2) };
  if (l.kind === "box") return { c: l.c, r: len(l.half) };
  if (l.kind === "skirt") return { c: lerp(l.a, l.b, 0.5), r: Math.hypot(dist(l.a, l.b) / 2, Math.max(l.r1, l.r2) + l.depth) };
  throw new Error(`unknown primitive ${l.kind}`);
}

function sphere(bounds) {
  const c = mul(bounds.reduce((s, b) => add(s, b.c), [0, 0, 0]), 1 / bounds.length);
  return { c, r: Math.max(...bounds.map((b) => dist(c, b.c) + b.r)) };
}

function objects(node, out) {
  if (node.op === "min") node.items.forEach((c) => objects(c, out));
  else out.push(leaves(node, node.op === "smin" ? node.k : 0));
  return out;
}

function leaves(node, k) {
  if (!node.op) return [{ leaf: node, k }];
  return node.items.flatMap((c) => leaves(c, node.op === "smin" ? node.k : 0));
}

function chunks(list) {
  const out = [];
  let cur = null;
  for (const item of list) {
    item.bound = leafBound(item.leaf);
    if (!cur || cur.items.length >= 6 || dist(cur.items[0].bound.c, item.bound.c) > 0.14) {
      cur = { items: [] };
      out.push(cur);
    }
    cur.items.push(item);
  }
  return out;
}

export function flatten(nodes) {
  const rows = [];
  const row = () => {
    const r = new Float32Array(ROW * 4);
    rows.push(r);
    return (j, v) => r.set(v, j * 4);
  };
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const obj of objects({ op: "min", items: nodes }, [])) {
    const parts = chunks(obj);
    const kmax = Math.max(...obj.map((o) => o.k));
    const ob = sphere(parts.flatMap((c) => c.items.map((i) => i.bound)));
    const head = row();
    head(1, [...ob.c, ob.r + kmax * 0.25]);
    for (const part of parts) {
      const ck = Math.max(...part.items.map((i) => i.k));
      const cb = sphere(part.items.map((i) => i.bound));
      const ch = row();
      ch(1, [...cb.c, cb.r]);
      for (const { leaf: n, k, bound } of part.items) {
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a], bound.c[a] - bound.r);
          hi[a] = Math.max(hi[a], bound.c[a] + bound.r);
        }
        const put = row();
        const cuts = n.cut ? [n.cut].flat().slice(0, 3) : [];
        put(0, [2, KIND[n.kind], cuts.length, k]);
        if (n.kind === "sph") put(1, [...n.c, n.r]);
        if (n.kind === "ell") {
          put(1, [...n.c, 0]);
          put(2, [...n.r, 0]);
          n.axes.forEach((a, j) => put(3 + j, [...a, 0]));
        }
        if (n.kind === "rc" || n.kind === "blade") {
          put(1, [...n.a, n.r1]);
          put(2, [...n.b, n.r2]);
        }
        if (n.kind === "blade") put(3, [...n.n, n.f]);
        if (n.kind === "box") {
          put(1, [...n.c, 0]);
          put(2, [...n.half, n.round]);
          n.axes.forEach((a, j) => put(3 + j, [...a, 0]));
        }
        if (n.kind === "skirt") {
          put(1, [...n.a, len(sub(n.b, n.a))]);
          put(2, [...n.axis, n.r1]);
          put(3, [...n.u, n.r2]);
          put(4, [...n.v, n.folds]);
          put(5, [n.depth, n.sharp ?? 0, n.power ?? 1, n.thick ?? 0]);
          put(11, [n.ex ?? 1, 0, 0, 0]);
        }
        cuts.forEach((c, j) => put(8 + j, [...c.n, c.d]));
        put(6, [...n.axis, n.m]);
        put(7, [...(n.aux || [0, 0]), n.aux ? 1 : 0, 0]);
      }
      ch(0, [1, rows.length, ck, 0]);
    }
    row()(0, [3, 0, 0, 0]);
    head(0, [0, rows.length, kmax, 0]);
  }
  const data = new Float32Array(rows.length * ROW * 4);
  rows.forEach((r, i) => data.set(r, i * ROW * 4));
  return { data, rows: rows.length, width: ROW, box: [lo.map((v) => v - 0.04), hi.map((v) => v + 0.04)] };
}
