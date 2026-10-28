import { random } from "../../random";
import { noise3 } from "../noise";
import { mixColor, rgb } from "../palette";
import { COMMON } from "./glsl";

const surfaceVertex = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec3 aInfo;
uniform float uR;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = easeOut((uT - aInfo.x) / 1.6);
  if (g <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  vec3 n = normalize(position);
  vec3 p = n * mix(uR * aInfo.y, length(position), g);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * n);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  float facing = dot(wn, normalize(cameraPosition - world.xyz));
  vColor = shade(aColor, world.xyz, wn, 1.0);
  vAlpha = g * smoothstep(-0.05, 0.12, facing);
  gl_PointSize = clamp(uPx * uScale / -mv.z, 1.0, 3.2);
}
`;

const dotFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25 || vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const lineVertex = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec3 aInfo;
uniform float uNight;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * normalize(position));
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  float g = step(aInfo.y, (uT - aInfo.x) / 1.3);
  float facing = dot(wn, normalize(cameraPosition - world.xyz));
  float dark = smoothstep(0.15, -0.25, dot(wn, uKeyDir));
  vColor = uNight > 0.5 ? aColor * (0.3 + dark * 1.4) : shade(aColor, world.xyz, wn, 1.0) * 1.2;
  float fade = aInfo.z < 0.0 ? 1.0 - smoothstep(-aInfo.z, -aInfo.z + 2.0, uT) : 1.0;
  vAlpha = g * smoothstep(-0.1, 0.15, facing) * abs(aInfo.z) * fade * (uNight > 0.5 ? 0.25 + dark * 0.75 : 1.0);
}
`;

const lineFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const cityVertex = /* glsl */ `
${COMMON}
attribute vec3 aInfo;
uniform vec3 uCity;
varying float vAlpha;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * normalize(position));
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  float on = smoothstep(aInfo.x, aInfo.x + 0.8, uT);
  float dark = smoothstep(0.1, -0.25, dot(wn, uKeyDir));
  float facing = smoothstep(-0.05, 0.2, dot(wn, normalize(cameraPosition - world.xyz)));
  vAlpha = on * dark * facing * (0.4 + aInfo.y * 0.6);
  gl_PointSize = 1.0 + aInfo.y * 1.8;
}
`;

const cityFragment = /* glsl */ `
uniform vec3 uCity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vAlpha < 0.01) discard;
  gl_FragColor = vec4(uCity, vAlpha * smoothstep(0.5, 0.0, d));
}
`;

const airVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const airFragment = /* glsl */ `
uniform vec3 uAir;
uniform vec3 uKeyDir;
uniform float uOn;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(1.0 - max(0.0, dot(vN, vV)), 3.0);
  float lit = smoothstep(-0.35, 0.4, dot(vN, uKeyDir));
  gl_FragColor = vec4(uAir, rim * lit * 0.55 * uOn);
}
`;

const orbitVertex = /* glsl */ `
${COMMON}
attribute vec3 aInfo;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = step(aInfo.y, (uT - aInfo.x) / 2.4) * aInfo.z;
}
`;

const orbitFragment = /* glsl */ `
uniform vec3 uInk;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(uInk, vAlpha);
}
`;

function onSphere(rand) {
  const u = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return [Math.cos(a) * r, u, Math.sin(a) * r];
}

export function planet(ctx, form) {
  const { THREE, U, plan, W, quality } = ctx;
  const s = form.subject;
  const R = form.size / 2;
  const rand = random((plan.seed ^ 0x3c6ef372) >>> 0);
  const n = noise3((plan.seed + 5) >>> 0);
  const label = s.label.toLowerCase();
  const gas = (s.traits.gas ?? 0) > 0.5 || /jupiter|saturn|neptune|uranus|gas/.test(label);
  const dry = /mars|red planet|desert|moon|mercury/.test(label);
  const oceanFrac = gas ? 0 : dry ? 0 : s.traits.ocean ?? (label.includes("earth") ? 0.68 : 0.55);
  const given = s.colors.map(rgb);
  const deep = given[0] && !dry ? given[0] : rgb(dry ? "#7a3b22" : "#173a63");
  const shallow = mixColor(deep, rgb("#4fa3b8"), dry ? 0 : 0.55);
  const lowland = given[1] || rgb(dry ? "#b5562f" : "#5f8a47");
  const highland = given[2] || rgb(dry ? "#d08455" : "#8a7651");
  const peak = rgb(dry ? "#e2b48a" : "#a7a29a");
  const ice = rgb("#eef3f6");

  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.41;
  group.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);

  const N = Math.round(280000 * quality);
  const pts = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const info = new Float32Array(N * 3);
  const elev = new Float32Array(N);
  const dirs = [];
  for (let i = 0; i < N; i++) {
    const d = onSphere(rand);
    dirs.push(d);
    elev[i] = gas ? 0 : n(d[0] * 1.6, d[1] * 1.6, d[2] * 1.6, 5) + n(d[0] * 5, d[1] * 5, d[2] * 5) * 0.12;
  }
  const sorted = Float32Array.from(elev).sort();
  const sea = gas ? 0 : sorted[Math.floor(Math.min(0.97, oceanFrac) * (N - 1))];
  const top = sorted[N - 1];
  const bands = given.length >= 2 ? given : ["#d9b38c", "#b9835a", "#efe1c8", "#a8653f", "#e8cba4", "#8c5a3c"].map(rgb);
  for (let i = 0; i < N; i++) {
    const d = dirs[i];
    const e = elev[i];
    let c;
    let r = R;
    if (gas) {
      const lat = d[1] + n(d[0] * 3, d[1] * 9, d[2] * 3) * 0.08;
      const k = (lat * 0.5 + 0.5) * bands.length * 1.6;
      const a = bands[Math.floor(k) % bands.length];
      const b = bands[(Math.floor(k) + 1) % bands.length];
      c = mixColor(a, b, k % 1);
    } else if (e <= sea) {
      c = mixColor(deep, shallow, Math.max(0, 1 - (sea - e) * 7));
    } else {
      const h = (e - sea) / Math.max(0.01, top - sea);
      c = h < 0.35 ? mixColor(lowland, highland, h / 0.35) : h < 0.75 ? mixColor(highland, peak, (h - 0.35) / 0.4) : mixColor(peak, ice, (h - 0.75) / 0.25);
      const arid = n(d[0] * 2 + 9, d[1] * 2, d[2] * 2) > 0.18 && Math.abs(d[1]) < 0.45;
      if (arid && !dry) c = mixColor(c, rgb("#c9a36a"), 0.6);
      r = R * (1 + h * 0.035);
    }
    if (!gas && Math.abs(d[1]) > 0.86 + n(d[0] * 4, 0, d[2] * 4) * 0.08) c = ice;
    pts.set([d[0] * r, d[1] * r, d[2] * r], i * 3);
    col.set(c, i * 3);
    const land = e > sea;
    info.set([land ? W.detail[0] + rand() * (W.detail[1] - W.detail[0] - 2) : W.form[0] + rand() * (W.form[1] - W.form[0] - 2), land ? 0.92 : 0.82, 0], i * 3);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.996, 64, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...deep.map((v) => v * 0.22), THREE.SRGBColorSpace) }));
  spin.add(core);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aInfo", new THREE.BufferAttribute(info, 3));
  const surface = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { ...U, uR: { value: R }, uPx: { value: R * 0.012 } }, vertexShader: surfaceVertex, fragmentShader: dotFragment, transparent: true }));
  surface.frustumCulled = false;
  spin.add(surface);

  const lp = [];
  const lc = [];
  const li = [];
  const ring = (fn, count, birth, alpha, color, fade) => {
    for (let k = 0; k < count; k++) {
      const a = fn(k / count);
      const b = fn((k + 1) / count);
      lp.push(...a, ...b);
      lc.push(...color, ...color);
      li.push(birth, k / count, fade ? -fade * alpha : alpha, birth, k / count, fade ? -fade * alpha : alpha);
    }
  };
  const ink = ctx.pal.ink;
  for (let m = 0; m < 12; m++) {
    const lon = (m / 12) * Math.PI * 2;
    ring((t) => { const lat = (t - 0.5) * Math.PI; return [Math.cos(lat) * Math.cos(lon) * R * 1.004, Math.sin(lat) * R * 1.004, Math.cos(lat) * Math.sin(lon) * R * 1.004]; }, 64, W.structure[0] + 0.4 + m * 0.12, 0.5, ink, W.detail[1]);
  }
  for (let p = 1; p < 8; p++) {
    const lat = (p / 8 - 0.5) * Math.PI;
    ring((t) => [Math.cos(lat) * Math.cos(t * Math.PI * 2) * R * 1.004, Math.sin(lat) * R * 1.004, Math.cos(lat) * Math.sin(t * Math.PI * 2) * R * 1.004], 96, W.structure[0] + 1.2 + p * 0.15, 0.5, ink, W.detail[1]);
  }
  if (!gas) {
    const GW = Math.round(320 * Math.max(0.6, quality));
    const GH = Math.round(GW / 2);
    const field = new Float32Array(GW * GH);
    const dir = (u, v) => {
      const lon = (u / (GW - 1)) * Math.PI * 2;
      const lat = (v / (GH - 1) - 0.5) * Math.PI;
      return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    };
    for (let v = 0; v < GH; v++)
      for (let u = 0; u < GW; u++) {
        const d = dir(u, v);
        field[v * GW + u] = n(d[0] * 1.6, d[1] * 1.6, d[2] * 1.6, 5) + n(d[0] * 5, d[1] * 5, d[2] * 5) * 0.12;
      }
    const levels = [sea, ...[1, 2, 3, 4, 5, 6].map((k) => sea + ((top - sea) * k) / 8)];
    const coast = mixColor(ink, lowland, 0.3);
    levels.forEach((level, li2) => {
      for (let v = 0; v < GH - 1; v++)
        for (let u = 0; u < GW - 1; u++) {
          const a = field[v * GW + u] - level;
          const b = field[v * GW + u + 1] - level;
          const c = field[(v + 1) * GW + u + 1] - level;
          const d = field[(v + 1) * GW + u] - level;
          const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
          if (idx === 0 || idx === 15) continue;
          const e = [
            [u + a / (a - b), v],
            [u + 1, v + b / (b - c)],
            [u + d / (d - c), v + 1],
            [u, v + a / (a - d)],
          ];
          const segs = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] }[idx];
          const rr = R * (1 + ((level - sea) / Math.max(0.01, top - sea)) * 0.035 + 0.003);
          for (const [p, q] of segs) {
            for (const k of [p, q]) {
              const dd = dir(e[k][0], e[k][1]);
              lp.push(dd[0] * rr, dd[1] * rr, dd[2] * rr);
              lc.push(...(li2 === 0 ? coast : mixColor(highland, ink, 0.25)));
              li.push(W.detail[0] + 0.5 + li2 * 0.5, (u / GW + v / GH * 0.3) % 1, li2 === 0 ? 0.9 : 0.4);
            }
          }
        }
    });
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
  lg.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(lc), 3));
  lg.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(li), 3));
  const lines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({ uniforms: { ...U, uNight: { value: 0 } }, vertexShader: lineVertex, fragmentShader: lineFragment, transparent: true, depthWrite: false }));
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  spin.add(lines);

  if (!gas && !dry) {
    const cities = [];
    for (let i = 0; i < N && cities.length < 2600 * quality; i += 3) {
      const e = elev[i];
      if (e <= sea || e > sea + (top - sea) * 0.45) continue;
      const d = dirs[i];
      if (Math.abs(d[1]) > 0.75) continue;
      if (n(d[0] * 9 + 3, d[1] * 9, d[2] * 9) < 0.12) continue;
      cities.push(d);
    }
    const cp = new Float32Array(cities.length * 3);
    const ci = new Float32Array(cities.length * 3);
    cities.forEach((d, i) => {
      cp.set(d.map((v) => v * R * 1.006), i * 3);
      ci.set([W.light[0] + rand() * 3, rand(), 0], i * 3);
    });
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.BufferAttribute(cp, 3));
    cg.setAttribute("aInfo", new THREE.BufferAttribute(ci, 3));
    const city = rgb("#ffc978");
    const lights = new THREE.Points(cg, new THREE.ShaderMaterial({ uniforms: { ...U, uCity: { value: new THREE.Vector3(...city) } }, vertexShader: cityVertex, fragmentShader: cityFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lights.frustumCulled = false;
    spin.add(lights);
    const np = [];
    const nc = [];
    const ni = [];
    const step = Math.max(1, Math.floor(cities.length / 700));
    for (let i = 0; i < cities.length; i += step) {
      const a = cities[i];
      let best = null;
      let bd = Infinity;
      for (let j = 0; j < cities.length; j += step) {
        if (j === i) continue;
        const b = cities[j];
        const dd = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (dd < bd && dd > 1e-5) [best, bd] = [b, dd];
      }
      if (!best || bd > 0.03) continue;
      const birth = W.light[0] + 1 + rand() * 3;
      for (let k = 0; k < 6; k++) {
        const t0 = k / 6;
        const t1 = (k + 1) / 6;
        const at = (t) => {
          const m = [a[0] + (best[0] - a[0]) * t, a[1] + (best[1] - a[1]) * t, a[2] + (best[2] - a[2]) * t];
          const l = Math.hypot(...m);
          const lift = 1.006 + Math.sin(t * Math.PI) * Math.sqrt(bd) * 0.08;
          return m.map((v) => (v / l) * R * lift);
        };
        np.push(...at(t0), ...at(t1));
        nc.push(...city, ...city);
        ni.push(birth, t0, 0.55, birth, t1, 0.55);
      }
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.BufferAttribute(new Float32Array(np), 3));
    ng.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(nc), 3));
    ng.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(ni), 3));
    const net = new THREE.LineSegments(ng, new THREE.ShaderMaterial({ uniforms: { ...U, uNight: { value: 1 } }, vertexShader: lineVertex, fragmentShader: lineFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    net.frustumCulled = false;
    spin.add(net);
  }

  if (!dry) {
    const M = Math.round((gas ? 0 : 38000) * quality);
    const cpos = [];
    const cinf = [];
    for (let i = 0, tries = 0; cpos.length < M * 3 && tries < M * 8; tries++) {
      const d = onSphere(rand);
      const v = n(d[0] * 2.4 + 20, d[1] * 3.2, d[2] * 2.4, 4) + Math.sin(d[1] * 9) * 0.05;
      if (v < 0.2 + rand() * 0.12) continue;
      const r = R * (1.022 + rand() * 0.012);
      cpos.push(d[0] * r, d[1] * r, d[2] * r);
      cinf.push(W.world[0] + rand() * 4, 0.97, 0);
      i++;
    }
    if (cpos.length) {
      const cg = new THREE.BufferGeometry();
      cg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cpos), 3));
      cg.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(cpos.length).fill(0.93), 3));
      cg.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(cinf), 3));
      const clouds = new THREE.Points(cg, new THREE.ShaderMaterial({ uniforms: { ...U, uR: { value: R * 1.03 }, uPx: { value: R * 0.008 } }, vertexShader: surfaceVertex, fragmentShader: "varying vec3 vColor; varying float vAlpha; void main() { vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25 || vAlpha < 0.01) discard; gl_FragColor = vec4(vColor, vAlpha * 0.55); }", transparent: true, depthWrite: false }));
      clouds.frustumCulled = false;
      clouds.userData.drift = true;
      tilt.add(clouds);
    }
    const air = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, 64, 32),
      new THREE.ShaderMaterial({ uniforms: { uAir: { value: new THREE.Vector3(...rgb("#8fb8ff")) }, uKeyDir: U.uKeyDir, uOn: { value: 0 } }, vertexShader: airVertex, fragmentShader: airFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide })
    );
    air.userData.air = true;
    group.add(air);
  }

  const op = [];
  const oi = [];
  for (let o = 0; o < 3; o++) {
    const rr = R * (1.45 + o * 0.38);
    const inc = (rand() - 0.5) * 1.1;
    const node = rand() * Math.PI;
    const m = 200;
    for (let k = 0; k < m; k++) {
      for (const t of [k / m, (k + 1) / m]) {
        const a = t * Math.PI * 2;
        let p = [Math.cos(a) * rr, 0, Math.sin(a) * rr];
        p = [p[0], p[2] * Math.sin(inc), p[2] * Math.cos(inc)];
        p = [p[0] * Math.cos(node) - p[2] * Math.sin(node), p[1], p[0] * Math.sin(node) + p[2] * Math.cos(node)];
        op.push(...p);
        oi.push(W.world[0] + o * 0.8, k / m, 0.22);
      }
    }
  }
  const og = new THREE.BufferGeometry();
  og.setAttribute("position", new THREE.BufferAttribute(new Float32Array(op), 3));
  og.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(oi), 3));
  const orbits = new THREE.LineSegments(og, new THREE.ShaderMaterial({ uniforms: { ...U, uInk: { value: new THREE.Vector3(...ink) } }, vertexShader: orbitVertex, fragmentShader: orbitFragment, transparent: true, depthWrite: false }));
  orbits.frustumCulled = false;
  group.add(orbits);

  return {
    object: group,
    update: (T) => {
      spin.rotation.y = T * 0.035;
      tilt.children.forEach((c) => c.userData.drift && (c.rotation.y = T * 0.05));
      group.children.forEach((c) => c.userData.air && (c.material.uniforms.uOn.value = Math.min(1, Math.max(0, (T - W.light[0]) / 3))));
    },
  };
}
