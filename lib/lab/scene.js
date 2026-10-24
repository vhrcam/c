import { bounds } from "./rig.js";

const f = (n) => {
  const s = Number(n).toFixed(5);
  return s.includes(".") ? s : `${s}.0`;
};
const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
const m3 = ([x, y, z]) => `mat3(${[0, 1, 2].map((j) => `${f(x[j])}, ${f(y[j])}, ${f(z[j])}`).join(", ")})`;

function basis(a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(...d);
  const w = d.map((x) => x / l);
  const helper = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = [helper[1] * w[2] - helper[2] * w[1], helper[2] * w[0] - helper[0] * w[2], helper[0] * w[1] - helper[1] * w[0]];
  const ul = Math.hypot(...u);
  const uu = u.map((x) => x / ul);
  const v = [w[1] * uu[2] - w[2] * uu[1], w[2] * uu[0] - w[0] * uu[2], w[0] * uu[1] - w[1] * uu[0]];
  return [uu, v];
}

function prim(p) {
  if (p.kind === "sph") return `t = length(p - ${v3(p.c)}) - ${f(p.r)};`;
  if (p.kind === "fold") {
    const [u, v] = basis(p.a, p.b);
    return `t = fold(p, ${v3(p.a)}, ${v3(p.b)}, ${f(p.r1)}, ${f(p.r2)}, ${v3(u)}, ${v3(v)}, ${f(p.folds)}, ${f(p.depth)});`;
  }
  if (p.kind === "ell") return `q = ${m3(p.axes)} * (p - ${v3(p.c)}); t = ell(q, ${v3(p.r)});`;
  return `t = cone(p, ${v3(p.a)}, ${v3(p.b)}, ${f(p.r1)}, ${f(p.r2)});`;
}

function group(g) {
  const b = bounds(g.prims);
  const body = g.prims.map((p) => `      ${prim(p)} if (t < best) { best = t; gm = ${f(p.m)}; } g = smin(g, t, ${f(p.k ?? g.k)});`).join("\n");
  return `  // ${g.name}
  t = length(p - ${v3(b.c)}) - ${f(b.r)};
  if (t < d) {
    if (t > 0.04) { d = t; m = 0.0; }
    else {
      g = 1e5; best = 1e5; gm = 0.0;
${body}
      if (g < d) { d = g; m = gm; }
    }
  }`;
}

export function mapGLSL(scene) {
  return `vec2 map(vec3 p) {
  float d = 1e5; float m = 0.0; float t; float g; float best; float gm; vec3 q;
${scene.groups.map(group).join("\n")}
  return vec2(d, m);
}`;
}
