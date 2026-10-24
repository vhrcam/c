import { context, program, run, target, upload } from "./gl.js";
import { couple } from "./rig.js";
import { mapGLSL } from "./scene.js";
import { SKY_PLACEHOLDER, layersFS, sceneFS } from "./shaders.js";
import { arrivals } from "./timeline.js";
import { cross, dot, norm, sub } from "./vec.js";

const HEAD = `#version 300 es
precision highp float;
in vec2 v_uv;
`;

const DOWN = `${HEAD}
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform sampler2D u_c;
uniform sampler2D u_d;
uniform vec2 u_texel;
vec4 box(sampler2D t) {
  vec2 d = u_texel * 0.5;
  return (texture(t, v_uv - d) + texture(t, v_uv + vec2(d.x, -d.y)) + texture(t, v_uv + vec2(-d.x, d.y)) + texture(t, v_uv + d)) * 0.25;
}
void main() {
  o0 = vec4(box(u_a).rgb, texelFetch(u_a, ivec2(v_uv / u_texel), 0).a);
  o1 = box(u_b);
  o2 = box(u_c);
  o3 = box(u_d);
}`;

const MASK = `${HEAD}
out vec4 o;
uniform sampler2D u_sky;
uniform sampler2D u_shaded;
uniform sampler2D u_lines;
void main() {
  o = vec4(texture(u_lines, v_uv).a, texture(u_sky, v_uv).a, texture(u_shaded, v_uv).a, 1.0);
}`;

const STILL = `${HEAD}
out vec4 o;
uniform sampler2D u_sky;
uniform sampler2D u_clouds;
uniform sampler2D u_shaded;
uniform sampler2D u_lines;
void main() {
  vec4 c = texture(u_clouds, v_uv);
  vec4 s = texture(u_shaded, v_uv);
  vec4 l = texture(u_lines, v_uv);
  vec3 col = mix(texture(u_sky, v_uv).rgb, c.rgb, c.a);
  col = mix(col, s.rgb, s.a);
  o = vec4(mix(col, l.rgb, l.a), 1.0);
}`;

const BRIGHT = `${HEAD}
out vec4 o;
uniform sampler2D u_image;
uniform vec2 u_texel;
void main() {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; i++) c += texture(u_image, v_uv + (vec2(float(i % 2), float(i / 2)) - 0.5) * u_texel * 2.0).rgb;
  o = vec4(max(c * 0.25 - 0.95, 0.0), 1.0);
}`;

const BLUR = `${HEAD}
out vec4 o;
uniform sampler2D u_image;
uniform vec2 u_dir;
void main() {
  float w[5] = float[](0.227, 0.194, 0.122, 0.054, 0.016);
  vec3 c = texture(u_image, v_uv).rgb * w[0];
  for (int i = 1; i < 5; i++) c += (texture(u_image, v_uv + u_dir * float(i)).rgb + texture(u_image, v_uv - u_dir * float(i)).rgb) * w[i];
  o = vec4(c, 1.0);
}`;

export const STAGES = { sketch: [0.3, 3.6], lines: [3.2, 8.6], sky: [7.6, 12.0], flats: [11.2, 15.2], shade: [14.6, 17.4], light: [16.8, 20.4], sign: [20.7, 21.7], end: 22.4 };

const S = STAGES;
const n = (v) => v.toFixed(2);
const ANIM = (sky) => `${HEAD}
out vec4 o;
uniform sampler2D u_sky;
uniform sampler2D u_clouds;
uniform sampler2D u_shaded;
uniform sampler2D u_lines;
uniform sampler2D u_times;
uniform sampler2D u_glow;
uniform sampler2D u_wide;
uniform vec2 u_sunUv;
uniform vec2 u_texel;
uniform float u_aspect;
uniform float u_t;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 9.1) * 0.15; }
${sky}
vec3 flatColor(int m) {
  if (m == 1) return lin(vec3(0.992, 0.906, 0.851));
  if (m == 2) return lin(vec3(0.957, 0.82, 0.5));
  if (m == 3) return lin(vec3(0.55, 0.33, 0.21));
  if (m == 4) return lin(vec3(0.27, 0.35, 0.55));
  if (m == 5) return lin(vec3(0.24, 0.24, 0.3));
  if (m == 6) return lin(vec3(0.985, 0.958, 0.92));
  return vec3(0.5);
}
vec3 motes(vec2 uv) {
  vec3 c = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float s = 6.0 + float(layer) * 4.0;
    vec2 g = uv * vec2(u_aspect, 1.0) * s;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + float(layer) * 17.0);
    if (h > 0.935) {
      vec2 off = (vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5) * 0.6;
      float r = mix(0.14, 0.3, hash(id + 9.2)) / (1.0 + float(layer) * 0.4);
      float d = length(f - off);
      float glow = smoothstep(r, r * 0.55, d) * 0.55 + smoothstep(r * 0.5, 0.0, d) * 0.25;
      float near = exp(-length((uv - u_sunUv) * vec2(u_aspect, 1.0)) * 1.6);
      c += vec3(1.0, 0.72, 0.42) * glow * smoothstep(0.32, 0.8, near) * 1.6 * (0.5 + 0.5 * h);
    }
  }
  return c;
}
void main() {
  vec2 uv = v_uv;
  float t = u_t;
  vec4 sky = texture(u_sky, uv);
  vec4 clouds = texture(u_clouds, uv);
  vec4 shaded = texture(u_shaded, uv);
  vec4 lines = texture(u_lines, uv);
  vec2 times = texture(u_times, uv).rg;
  int m = int(sky.a * 16.0 + 0.5);
  vec3 col = lin(vec3(0.898, 0.882, 0.847));
  float grain = fbm(uv * vec2(u_aspect, 1.0) * 6.0);

  float skyAt = ${n(S.sky[0])} + (1.0 - uv.y) * 2.4 + (fbm(uv * vec2(4.0, 18.0)) - 0.5) * 0.9;
  col = mix(col, sky.rgb, smoothstep(skyAt, skyAt + 0.7, t));
  float cloudAt = ${n(S.sky[0] + 1.3)} + fbm(uv * 3.0 + 1.7) * 2.6;
  col = mix(col, clouds.rgb, clouds.a * smoothstep(cloudAt, cloudAt + 0.9, t));

  vec4 rough = texture(u_lines, uv + (vec2(noise(uv * 90.0), noise(uv * 90.0 + 7.0)) - 0.5) * u_texel * 2.5);
  float sketchAt = mix(${n(S.sketch[0])}, ${n(S.sketch[1])}, times.r);
  float pencil = rough.a * step(sketchAt, t) * (1.0 - smoothstep(${n(S.flats[0])}, ${n(S.flats[0] + 2.2)}, t));
  col = mix(col, lin(vec3(0.46, 0.62, 0.86)), pencil * 0.6);

  float fillAt = mix(${n(S.flats[0])}, ${n(S.flats[1])}, times.g);
  col = mix(col, flatColor(m), shaded.a * smoothstep(fillAt, fillAt + 0.3, t));
  float shadeAt = ${n(S.shade[0])} + (1.0 - uv.y) * 1.7 + (grain - 0.5) * 0.8;
  col = mix(col, shaded.rgb, shaded.a * smoothstep(shadeAt, shadeAt + 0.6, t));

  float inkAt = mix(${n(S.lines[0])}, ${n(S.lines[1])}, times.r);
  col = mix(col, lines.rgb, lines.a * smoothstep(inkAt, inkAt + 0.05, t));

  float reach = length((uv - u_sunUv) * vec2(u_aspect, 1.0));
  float light = smoothstep(${n(S.light[0])} + reach * 1.4, ${n(S.light[0] + 1.8)} + reach * 1.4, t);
  col += (texture(u_glow, uv).rgb * 0.6 + texture(u_wide, uv).rgb * 0.55 + motes(uv) + c_flare(uv, u_sunUv, u_aspect)) * light;

  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.55 * smoothstep(${n(S.sky[0])}, ${n(S.sky[1])}, t);
  col = col / (1.0 + max(col - 0.85, 0.0) * 0.9);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash(uv * 913.7) - 0.5) * 0.016;
  o = vec4(col, 1.0);
}`;

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export function camera({ eye, look, fov }, aspect) {
  const fwd = norm(sub(look, eye));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const lens = 2 * Math.tan((fov * Math.PI) / 360);
  const project = (d) => {
    const z = dot(d, fwd);
    return [dot(d, right) / z / lens / aspect + 0.5, dot(d, up) / z / lens + 0.5];
  };
  return { eye, matrix: [...right, ...up, ...fwd], lens, project };
}

export async function prepare(canvas, { width = 1500, height = 1000, ss = 1.5, sky = SKY_PLACEHOLDER, bands = 12, view, onProgress } = {}) {
  canvas.width = width;
  canvas.height = height;
  const gl = context(canvas);
  const scene = couple();
  const W = Math.round(width * ss);
  const H = Math.round(height * ss);
  const t0 = performance.now();
  const programs = {
    scene: program(gl, sceneFS(mapGLSL(scene))),
    layers: program(gl, layersFS(sky)),
    down: program(gl, DOWN),
    mask: program(gl, MASK),
    still: program(gl, STILL),
    bright: program(gl, BRIGHT),
    blur: program(gl, BLUR),
    anim: program(gl, ANIM(sky)),
  };
  const compileMs = performance.now() - t0;

  const cam = camera(view || { eye: [0.03, 1.3, 2.2], look: [0.0, 1.41, 0.0], fov: 30 }, width / height);
  const key = norm([0.45, 0.75, 0.65]);
  const sun = norm(sub([0.0, 1.27, 0], cam.eye));
  const sunUv = cam.project(sun);
  const [h0, h1] = scene.heads;
  const gbuf = target(gl, W, H, 4);
  const uniforms = { u_res: [W, H], u_eye: cam.eye, u_cam: cam.matrix, u_lens: cam.lens, u_key: key, u_sun: sun, u_head0: h0.center, u_axes0: h0.axes.flat(), u_size0: h0.size, u_head1: h1.center, u_axes1: h1.axes.flat(), u_size1: h1.size };
  const t1 = performance.now();
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((H * i) / bands);
    const y1 = Math.floor((H * (i + 1)) / bands);
    run(gl, programs.scene, uniforms, gbuf, [0, y0, W, y1 - y0]);
    gl.flush();
    onProgress?.((i + 1) / (bands + 1));
    await frame();
  }

  const layers = target(gl, W, H, 4);
  run(gl, programs.layers, { u_color: gbuf.textures[0], u_geo: gbuf.textures[1], u_info: gbuf.textures[2], u_res: [W, H], u_sunUv: sunUv, u_px: 1.4 * ss }, layers);
  const small = target(gl, width, height, 4);
  run(gl, programs.down, { u_a: layers.textures[0], u_b: layers.textures[1], u_c: layers.textures[2], u_d: layers.textures[3], u_texel: [1 / W, 1 / H] }, small);
  const [skyTex, cloudTex, shadedTex, lineTex] = small.textures;

  const maskTarget = target(gl, width, height, 1, true);
  run(gl, programs.mask, { u_sky: skyTex, u_shaded: shadedTex, u_lines: lineTex }, maskTarget);
  const mask = new Uint8Array(width * height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, maskTarget.fb);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, mask);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const timesTex = upload(gl, width, height, arrivals(mask, width, height));

  const still = target(gl, width, height, 1);
  run(gl, programs.still, { u_sky: skyTex, u_clouds: cloudTex, u_shaded: shadedTex, u_lines: lineTex }, still);
  const gw = Math.round(width / 4);
  const gh = Math.round(height / 4);
  const glowA = target(gl, gw, gh, 1);
  const glowB = target(gl, gw, gh, 1);
  const wideA = target(gl, Math.round(gw / 3), Math.round(gh / 3), 1);
  const wideB = target(gl, Math.round(gw / 3), Math.round(gh / 3), 1);
  run(gl, programs.bright, { u_image: still.textures[0], u_texel: [1 / gw, 1 / gh] }, glowA);
  for (let i = 0; i < 2; i++) {
    run(gl, programs.blur, { u_image: glowA.textures[0], u_dir: [1.6 / gw, 0] }, glowB);
    run(gl, programs.blur, { u_image: glowB.textures[0], u_dir: [0, 1.6 / gh] }, glowA);
  }
  run(gl, programs.blur, { u_image: glowA.textures[0], u_dir: [1 / gw, 0] }, wideA);
  for (let i = 0; i < 2; i++) {
    run(gl, programs.blur, { u_image: wideA.textures[0], u_dir: [2.2 / wideA.w, 0] }, wideB);
    run(gl, programs.blur, { u_image: wideB.textures[0], u_dir: [0, 2.2 / wideA.h] }, wideA);
  }
  onProgress?.(1);

  const draw = (t) =>
    run(gl, programs.anim, { u_sky: skyTex, u_clouds: cloudTex, u_shaded: shadedTex, u_lines: lineTex, u_times: timesTex, u_glow: glowA.textures[0], u_wide: wideA.textures[0], u_sunUv: sunUv, u_texel: [1 / width, 1 / height], u_aspect: width / height, u_t: t }, null);
  draw(0);
  return { draw, end: STAGES.end, compileMs, renderMs: performance.now() - t1, sunUv };
}
