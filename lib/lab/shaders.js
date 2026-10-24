const COMMON = `#version 300 es
precision highp float;
in vec2 v_uv;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

export function sceneFS(map) {
  return `${COMMON}
layout(location = 0) out vec4 o_color;
layout(location = 1) out vec4 o_geo;
layout(location = 2) out vec4 o_info;
layout(location = 3) out vec4 o_flat;
uniform vec2 u_res;
uniform vec3 u_eye;
uniform mat3 u_cam;
uniform float u_lens;
uniform vec3 u_key;
uniform vec3 u_sun;
uniform vec3 u_head0;
uniform mat3 u_axes0;
uniform float u_size0;
uniform vec3 u_head1;
uniform mat3 u_axes1;
uniform float u_size1;

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float cone(vec3 p, vec3 a, vec3 b, float r1, float r2) { vec3 pa = p - a; vec3 ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(r1, r2, h); }
float ell(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float fold(vec3 p, vec3 a, vec3 b, float r1, float r2, vec3 u, vec3 v, float n, float depth) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float ang = atan(dot(pa, v), dot(pa, u));
  float wave = 0.5 + 0.5 * sin(ang * n + sin(ang * 3.0) * 1.3);
  return length(pa - ba * h) - mix(r1, r2, h) + depth * h * h * wave;
}

${map}

float march(vec3 ro, vec3 rd, out float mat) {
  float t = 0.2;
  for (int i = 0; i < 220; i++) {
    vec2 h = map(ro + rd * t);
    if (h.x < 0.00025 * t) { mat = h.y; return t; }
    t += h.x * 0.8;
    if (t > 9.0) break;
  }
  return -1.0;
}

vec3 normal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0004;
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

float shadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.012;
  for (int i = 0; i < 56; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 14.0 * h / t);
    t += clamp(h, 0.004, 0.06);
    if (res < 0.01 || t > 1.4) break;
  }
  return clamp(res, 0.0, 1.0);
}

float occlusion(vec3 p, vec3 n) {
  float o = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.012 * float(i);
    o += (h - map(p + n * h).x) * w;
    w *= 0.75;
  }
  return clamp(1.0 - o * 9.0, 0.0, 1.0);
}

struct Ink { vec3 lit; vec3 shade; vec3 deep; vec3 shine; };

Ink ink(int m) {
  if (m == 1) return Ink(lin(vec3(0.992, 0.906, 0.851)), lin(vec3(0.945, 0.718, 0.663)), lin(vec3(0.85, 0.53, 0.5)), lin(vec3(1.0, 0.96, 0.94)));
  if (m == 2) return Ink(lin(vec3(0.957, 0.82, 0.5)), lin(vec3(0.83, 0.61, 0.33)), lin(vec3(0.62, 0.41, 0.22)), lin(vec3(1.0, 0.97, 0.8)));
  if (m == 3) return Ink(lin(vec3(0.55, 0.33, 0.21)), lin(vec3(0.36, 0.2, 0.12)), lin(vec3(0.22, 0.11, 0.07)), lin(vec3(0.85, 0.6, 0.44)));
  if (m == 4) return Ink(lin(vec3(0.27, 0.35, 0.55)), lin(vec3(0.17, 0.22, 0.39)), lin(vec3(0.1, 0.13, 0.26)), lin(vec3(0.5, 0.6, 0.8)));
  if (m == 5) return Ink(lin(vec3(0.24, 0.24, 0.3)), lin(vec3(0.16, 0.16, 0.21)), lin(vec3(0.1, 0.1, 0.14)), lin(vec3(0.4, 0.4, 0.5)));
  if (m == 6) return Ink(lin(vec3(0.985, 0.958, 0.92)), lin(vec3(0.84, 0.78, 0.85)), lin(vec3(0.68, 0.61, 0.74)), lin(vec3(1.0, 1.0, 1.0)));
  return Ink(vec3(0.1), vec3(0.06), vec3(0.04), vec3(0.2));
}

vec3 local(vec3 p, vec3 c, mat3 a, float s) { vec3 r = p - c; return vec3(dot(r, a[0]), dot(r, a[1]), dot(r, a[2])) / s; }

float band(float y, float c, float w) { return smoothstep(w, w * 0.35, abs(y - c)); }

vec4 face(vec3 q) {
  vec4 o = vec4(0.0);
  if (length(q) > 0.15 || q.x < 0.0) return o;
  float phi = atan(q.z, q.x);
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? 1.0 : -1.0;
    float u = s * phi;
    float e = clamp((u - 0.24) / 0.42, 0.0, 1.0);
    float inEye = step(0.24, u) * step(u, 0.66);
    float lid = -0.006 - 0.008 * sin(3.14159 * e) + 0.006 * smoothstep(0.75, 1.0, e);
    float lash = band(q.y, lid, 0.0024) * inEye;
    float tip = band(q.y, lid - 0.004 - (e - 0.8) * 0.02, 0.0018) * step(0.8, e) * inEye;
    float b2 = clamp((u - 0.2) / 0.44, 0.0, 1.0);
    float brow = band(q.y, 0.032 + 0.006 * sin(3.14159 * b2), 0.0016) * step(0.2, u) * step(u, 0.64);
    vec2 cheek = vec2((u - 0.56) * 0.08, q.y + 0.034);
    float blush = smoothstep(0.024, 0.004, length(cheek));
    float hatch = step(fract((u * 0.11 + q.y) * 180.0), 0.24) * smoothstep(0.018, 0.008, length(cheek));
    o.a = max(o.a, max(lash, tip));
    o.g = max(o.g, brow);
    o.b = max(o.b, blush * 0.6 + hatch * 0.3);
  }
  float mouth = band(q.y, -0.063 + phi * phi * 0.06, 0.0015) * step(abs(phi), 0.17);
  o.a = max(o.a, mouth * 0.55);
  return o;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec3 rd = normalize(u_cam * vec3(uv * u_lens, 1.0));
  vec3 ro = u_eye;
  float mat = 0.0;
  float t = march(ro, rd, mat);
  if (t < 0.0) {
    o_color = vec4(0.0);
    o_geo = vec4(0.5, 0.5, 0.5, 1.0);
    o_info = vec4(0.0);
    o_flat = vec4(0.0);
    return;
  }
  vec3 pos = ro + rd * t;
  vec3 n = normal(pos);
  int m = int(mat + 0.5);
  Ink k = ink(m);
  float ao = occlusion(pos, n);
  float lit = smoothstep(-0.03, 0.05, dot(n, u_key)) * smoothstep(0.25, 0.6, shadow(pos + n * 0.002, u_key));
  float crease = 1.0 - smoothstep(0.35, 0.62, ao);
  vec3 warm = lin(vec3(1.0, 0.9, 0.8));
  vec3 cool = lin(vec3(0.84, 0.8, 1.0));
  vec3 col = mix(k.shade * cool, k.lit * warm, lit);
  col = mix(col, k.deep * cool, crease * (1.0 - lit * 0.6));
  vec3 base = k.lit;

  vec3 q0 = local(pos, u_head0, u_axes0, u_size0);
  vec3 q1 = local(pos, u_head1, u_axes1, u_size1);
  vec3 q = length(q0) < length(q1) ? q0 : q1;

  float shine = 0.0;
  if (m == 2 || m == 3) {
    float r = length(q);
    float el = asin(clamp(q.y / max(r, 1e-4), -1.0, 1.0));
    float az = atan(q.z, q.x);
    float jag = 0.05 * sin(az * 19.0) * sin(az * 7.0 + 1.3) + 0.025 * sin(az * 41.0);
    shine = smoothstep(0.1, 0.06, abs(el - 0.62 - jag)) * step(r, 0.16) * smoothstep(-0.1, 0.35, dot(n, u_key));
    col = mix(col, k.shine, shine * 0.75);
  }
  if (m == 1) {
    vec4 fx = face(q);
    vec3 lashColor = lin(vec3(0.24, 0.13, 0.1));
    col = mix(col, lin(vec3(0.98, 0.55, 0.56)), fx.b * 0.6);
    col = mix(col, lashColor, fx.a);
    col = mix(col, lin(vec3(0.42, 0.25, 0.16)), fx.g * 0.8);
    base = mix(base, lin(vec3(0.98, 0.55, 0.56)), fx.b * 0.6);
    base = mix(base, lashColor, fx.a);
  }

  float facing = 1.0 - max(dot(n, -rd), 0.0);
  float rimTerm = pow(facing, 1.6) * smoothstep(-0.3, 0.4, dot(n, u_sun) + 0.1);
  float rim = smoothstep(0.3, 0.46, rimTerm);
  o_color = vec4(col, 1.0);
  o_geo = vec4(n * 0.5 + 0.5, t / 8.0);
  o_info = vec4(mat / 16.0, lit, rim, shine);
  o_flat = vec4(base, 1.0);
}`;
}

export const SKY_PLACEHOLDER = `
vec3 c_sky(vec2 uv, vec2 sun, float aspect) {
  vec3 top = vec3(0.09, 0.08, 0.32);
  vec3 mid = vec3(0.75, 0.26, 0.42);
  vec3 low = vec3(1.0, 0.55, 0.22);
  float y = uv.y;
  vec3 c = mix(low, mid, smoothstep(0.1, 0.55, y));
  return mix(c, top, smoothstep(0.5, 1.0, y));
}
vec4 c_clouds(vec2 uv, vec2 sun, float aspect, float seed) { return vec4(0.0); }
vec4 c_sun(vec2 uv, vec2 sun, float aspect) {
  vec2 d = (uv - sun) * vec2(aspect, 1.0);
  float r = length(d);
  return vec4(vec3(1.0, 0.75, 0.4) * (exp(-r * 6.0) * 1.2 + smoothstep(0.045, 0.04, r) * 3.0), smoothstep(0.045, 0.04, r));
}
vec4 c_city(vec2 uv, vec2 sun, float aspect, float seed) { return vec4(0.0); }
vec3 c_flare(vec2 uv, vec2 sun, float aspect) { return vec3(0.0); }
`;

export function layersFS(sky) {
  return `${COMMON}
layout(location = 0) out vec4 o_sky;
layout(location = 1) out vec4 o_clouds;
layout(location = 2) out vec4 o_shaded;
layout(location = 3) out vec4 o_lines;
uniform sampler2D u_color;
uniform sampler2D u_geo;
uniform sampler2D u_info;
uniform vec2 u_res;
uniform vec2 u_sunUv;
uniform float u_px;
${sky}

vec3 lineColor(int m) {
  if (m == 1) return lin(vec3(0.6, 0.32, 0.3));
  if (m == 2) return lin(vec3(0.45, 0.27, 0.12));
  if (m == 3) return lin(vec3(0.16, 0.07, 0.04));
  if (m == 4) return lin(vec3(0.07, 0.09, 0.2));
  if (m == 5) return lin(vec3(0.06, 0.06, 0.09));
  if (m == 6) return lin(vec3(0.45, 0.38, 0.52));
  return vec3(0.05);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / u_res.y;
  vec4 c = texture(u_color, uv);
  vec4 g = texture(u_geo, uv);
  vec4 info = texture(u_info, uv);
  int m = int(info.r * 16.0 + 0.5);
  vec3 n = g.rgb * 2.0 - 1.0;
  float depth = g.a;
  float line = 0.0;
  vec2 px = u_px / u_res;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236;
    if (c.a > 0.5 && texture(u_color, uv + vec2(cos(a), sin(a)) * px * 1.7).a < 0.5) line = 1.0;
  }
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 o2 = vec2(cos(a), sin(a)) * px * 0.85;
    vec4 cn = texture(u_color, uv + o2);
    vec4 gn = texture(u_geo, uv + o2);
    vec4 inn = texture(u_info, uv + o2);
    int mn = int(inn.r * 16.0 + 0.5);
    if (c.a > 0.5 && cn.a > 0.5) {
      float dd = gn.a - depth;
      if (dd > 0.0035 + depth * 0.02) line = max(line, 1.0);
      vec3 nn = gn.rgb * 2.0 - 1.0;
      if (dot(n, nn) < 0.55 && dd > -0.001) line = max(line, 0.75);
      if (mn != m && dd > -0.0005) line = max(line, 0.9);
    }
  }
  vec3 sky = c_sky(uv, u_sunUv, aspect) + c_sun(uv, u_sunUv, aspect).rgb;
  vec4 cl = c_clouds(uv, u_sunUv, aspect, 7.0);
  vec4 city = c_city(uv, u_sunUv, aspect, 3.0);
  vec3 cloudRgb = mix(cl.rgb, city.rgb, city.a);
  float cloudA = max(cl.a, city.a);
  vec3 sunCol = vec3(1.0, 0.58, 0.28);
  vec3 shaded = c.rgb + sunCol * info.b * 1.6;
  vec3 lc = mix(lineColor(m), sunCol * 0.9, info.b * 0.6);
  o_sky = vec4(sky, float(m) / 16.0);
  o_clouds = vec4(cloudRgb, cloudA);
  o_shaded = vec4(shaded, c.a);
  o_lines = vec4(lc, line * c.a);
}`;
}
