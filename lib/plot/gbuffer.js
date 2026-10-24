import { context, program, run, target } from "./gl.js";
import { LIB, flatten } from "./sdf.js";

export const DEPTH_MAX = 600;

const SHADER = (defines = "") => `#version 300 es
precision highp float;
${defines}
in vec2 v_uv;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
uniform vec2 u_res;
uniform vec3 u_eye;
uniform mat3 u_cam;
uniform float u_lens;
uniform vec3 u_key;
uniform vec3 u_sun;
uniform vec4 u_hills;
uniform vec4 u_bound;
uniform highp sampler3D u_vol;
uniform vec3 u_bmin;
uniform vec3 u_bmax;
uniform float u_err;
${LIB}
float coarse(vec3 p, out bool inside) {
  vec3 uvw = (p - u_bmin) / (u_bmax - u_bmin);
  inside = all(greaterThanEqual(uvw, vec3(0.0))) && all(lessThanEqual(uvw, vec3(1.0)));
  return texture(u_vol, uvw).r;
}
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float hills(vec2 xz) {
  vec2 q = xz * u_hills.y + u_hills.z;
  float h = vnoise(q) * 0.6 + vnoise(q * 2.03 + 7.1) * 0.28 + vnoise(q * 4.1 + 3.3) * 0.12;
  float far = smoothstep(5.0, 40.0, length(xz));
  return (h - 0.35) * u_hills.x * far;
}

float marchFigures(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / rd;
  vec3 a = (u_bmin - ro) * inv;
  vec3 b = (u_bmax - ro) * inv;
  vec3 lo = min(a, b);
  vec3 hi = max(a, b);
  float tn = max(max(lo.x, lo.y), lo.z);
  float tf = min(min(hi.x, hi.y), hi.z);
  if (tf < max(tn, 0.0)) return -1.0;
  float t = max(tn, 0.01);
  bool inside;
  for (int i = 0; i < 400; i++) {
    if (t > tf) break;
    vec3 p = ro + rd * t;
    float c = coarse(p, inside);
    if (c > 0.03) {
      t += c - u_err;
      continue;
    }
#ifdef COARSEONLY
    if (c < 0.006) return t;
    t += 0.003;
    continue;
#endif
    float d = figures(p);
    if (d < 0.00008 * t + 0.00003) return t;
    t += d * 0.9;
  }
  return -1.0;
}

float marchGround(vec3 ro, vec3 rd) {
  if (rd.y > -0.0005 && ro.y > u_hills.x * 0.7) return -1.0;
  float t = 0.05;
  if (rd.y < 0.0 && u_hills.x < 1e-4) return -ro.y / rd.y;
  float lt = t;
  float lh = 0.0;
  for (int i = 0; i < 400; i++) {
    vec3 p = ro + rd * t;
    float h = p.y - hills(p.xz);
    if (h < 0.0) {
      float a = lt;
      float b = t;
      for (int j = 0; j < 8; j++) {
        float m = 0.5 * (a + b);
        vec3 q = ro + rd * m;
        if (q.y - hills(q.xz) < 0.0) b = m; else a = m;
      }
      return 0.5 * (a + b);
    }
    lt = t;
    lh = h;
    t += max(0.01 * t + 0.01, h * 0.6);
    if (t > ${DEPTH_MAX.toFixed(1)}) break;
  }
  return -1.0;
}

vec3 figureNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0006;
  return normalize(e.xyy * figures(p + e.xyy) + e.yyx * figures(p + e.yyx) + e.yxy * figures(p + e.yxy) + e.xxx * figures(p + e.xxx));
}

vec3 groundNormal(vec3 p) {
  float e = 0.02;
  return normalize(vec3(hills(p.xz - vec2(e, 0.0)) - hills(p.xz + vec2(e, 0.0)), 2.0 * e, hills(p.xz - vec2(0.0, e)) - hills(p.xz + vec2(0.0, e))));
}

float shadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.008;
  bool inside;
  for (int i = 0; i < 40; i++) {
    vec3 q = ro + rd * t;
    float c = coarse(q, inside);
    if (!inside) break;
    float h = c > 0.05 ? c - u_err : figures(q);
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.006, 0.1);
    if (res < 0.01) break;
  }
  return clamp(res, 0.0, 1.0);
}

float occlusion(vec3 p, vec3 n) {
  float o = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.018 * float(i);
    o += (h - figures(p + n * h)) * w;
    w *= 0.6;
  }
  return clamp(1.0 - o * 5.0, 0.0, 1.0);
}

vec2 screenDir(vec3 pos, vec3 v) {
  vec3 d = pos - u_eye;
  vec3 pc = vec3(dot(d, u_cam[0]), dot(d, u_cam[1]), dot(d, u_cam[2]));
  vec3 vc = vec3(dot(v, u_cam[0]), dot(v, u_cam[1]), dot(v, u_cam[2]));
  vec2 s = vec2(vc.x * pc.z - pc.x * vc.z, -(vc.y * pc.z - pc.y * vc.z));
  return length(s) > 1e-9 ? normalize(s) : vec2(1.0, 0.0);
}

vec2 pack16(float x) {
  float v = clamp(x, 0.0, 1.0) * 65535.0;
  float hi = floor(v / 256.0);
  return vec2(hi, v - hi * 256.0) / 255.0;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec3 rd = normalize(u_cam * vec3(uv * u_lens, 1.0));
  vec3 ro = u_eye;
  float tf = marchFigures(ro, rd);
  float tg = marchGround(ro, rd);
  bool fig = tf > 0.0 && (tg < 0.0 || tf < tg);
  float t = fig ? tf : tg;
  if (t < 0.0) {
    o0 = vec4(0.0, 0.0, 1.0, 1.0);
    o1 = vec4(0.5, 0.5, 0.5, 0.5);
    o2 = vec4(0.0);
    return;
  }
  vec3 pos = ro + rd * t;
  vec3 n;
  float mat = 8.0;
  float aux = 0.0;
  vec3 flow = vec3(1.0, 0.0, 0.0);
  float light;
  float ao = 1.0;
  if (fig) {
    n = figureNormal(pos);
#ifndef NOINFO
    figureInfo(pos, mat, aux, flow);
#endif
#ifndef NOSHADE
    ao = occlusion(pos, n);
#endif
    light = max(dot(n, u_key), 0.0);
#ifndef NOSHADE
    if (light > 0.0) light *= shadow(pos + n * 0.006, u_key);
#endif
  } else {
    n = groundNormal(pos);
    light = max(dot(n, u_key), 0.0);
    if (length(pos.xz - u_bound.xz) < 3.0) light *= mix(0.35, 1.0, shadow(pos + n * 0.01, u_key));
    flow = normalize(cross(n, u_cam[2]));
  }
  float ndv = max(dot(n, -rd), 0.0);
  vec3 along = normalize(flow - n * dot(flow, n) + 1e-6);
  vec2 sa = screenDir(pos, along);
  vec2 sr = screenDir(pos, cross(n, along));
  float ang = atan(sr.y, sr.x) * 2.0;
  float rim = pow(1.0 - ndv, 2.0) * smoothstep(-0.2, 0.5, dot(n, u_sun));
  float depth = log(1.0 + t) / log(1.0 + ${DEPTH_MAX.toFixed(1)});
  o0 = vec4(ndv, mat / 255.0, pack16(depth));
  o1 = vec4(sa * 0.5 + 0.5, vec2(cos(ang), sin(ang)) * 0.5 + 0.5);
  o2 = vec4(light, ao, rim, aux);
}`;

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const VOLUME = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform vec3 u_bmin;
uniform vec3 u_cell;
uniform float u_z;
${LIB}
void main() {
  vec3 p = u_bmin + vec3(gl_FragCoord.xy, u_z + 0.5) * u_cell;
  o = vec4(clamp(figures(p), -0.2, 0.6), 0.0, 0.0, 1.0);
}`;

let shared = null;

function volume(gl, prog, scene, data, cell) {
  const [bmin, bmax] = scene.box;
  const n = bmax.map((v, i) => Math.max(2, Math.ceil((v - bmin[i]) / cell)));
  const max = [bmin[0] + n[0] * cell, bmin[1] + n[1] * cell, bmin[2] + n[2] * cell];
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, n[0], n[1], n[2], 0, gl.RED, gl.HALF_FLOAT, null);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  for (let z = 0; z < n[2]; z++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, z);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    run(gl, prog, { u_data: data, u_count: scene.rows, u_bmin: bmin, u_cell: [cell, cell, cell], u_z: z }, { fb, w: n[0], h: n[1] });
  }
  gl.deleteFramebuffer(fb);
  return { tex, bmin, bmax: max };
}

function setup() {
  if (shared && !shared.gl.isContextLost()) return shared;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  shared = { gl: context(canvas), programs: new Map() };
  return shared;
}

function dataTexture(gl, { data, rows, width }) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, rows, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return t;
}

export async function gbuffer({ nodes, cam, W, H, key, sun, hills = [0, 0.05, 0, 0], bound, bands = 4, defines = "", onProgress }) {
  const { gl, programs } = setup();
  const t0 = performance.now();
  const scene = flatten(nodes);
  const source = SHADER(defines);
  let prog = programs.get(source);
  if (!prog) {
    prog = program(gl, source);
    programs.set(source, prog);
  }
  const data = dataTexture(gl, scene);
  if (!programs.has("volume")) programs.set("volume", program(gl, VOLUME));
  const cell = 0.0125;
  const vol = volume(gl, programs.get("volume"), scene, data, cell);
  gl.finish();
  const compileMs = performance.now() - t0;
  const out = target(gl, W, H, 3, true);
  const uniforms = { u_vol: { volume: vol.tex }, u_bmin: vol.bmin, u_bmax: vol.bmax, u_err: cell * 0.87 + 0.002, u_data: data, u_count: scene.rows, u_res: [W, H], u_eye: cam.eye, u_cam: cam.matrix, u_lens: cam.lens, u_key: key, u_sun: sun, u_hills: hills, u_bound: bound };
  const t1 = performance.now();
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((H * i) / bands);
    const y1 = Math.floor((H * (i + 1)) / bands);
    run(gl, prog, uniforms, out, [0, y0, W, y1 - y0]);
    gl.finish();
    onProgress?.((i + 1) / bands);
    await frame();
  }
  const read = (i) => {
    const px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const flipped = new Uint8Array(px.length);
    const row = W * 4;
    for (let y = 0; y < H; y++) flipped.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    return flipped;
  };
  const buffers = { a: read(0), b: read(1), c: read(2) };
  const renderMs = performance.now() - t1;
  gl.deleteTexture(data);
  gl.deleteTexture(vol.tex);
  out.textures.forEach((t) => gl.deleteTexture(t));
  gl.deleteFramebuffer(out.fb);
  return { W, H, ...buffers, compileMs, renderMs };
}
