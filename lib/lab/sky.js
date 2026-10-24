export const SKY_GLSL = `
float sk_h1(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 sk_h2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float sk_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sk_h1(i), sk_h1(i + vec2(1.0, 0.0)), u.x), mix(sk_h1(i + vec2(0.0, 1.0)), sk_h1(i + vec2(1.0, 1.0)), u.x), u.y);
}

float sk_fbm(vec2 p, int n) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    s += a * sk_noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

vec3 sk_lin(vec3 c) {
  return pow(c, vec3(2.2));
}

vec3 sk_bs(vec3 c[8], float x) {
  x = clamp(x, 0.0, 7.0);
  int i = int(min(floor(x), 6.0));
  float t = x - float(i);
  float t2 = t * t;
  float t3 = t2 * t;
  float u = 1.0 - t;
  return (c[max(i - 1, 0)] * u * u * u + c[i] * (3.0 * t3 - 6.0 * t2 + 4.0) + c[i + 1] * (3.0 * (t + t2 - t3) + 1.0) + c[min(i + 2, 7)] * t3) / 6.0;
}

vec3 c_sky(vec2 uv, vec2 sun, float aspect) {
  vec3 st[8] = vec3[8](vec3(1.0, 0.88, 0.6), vec3(1.0, 0.68, 0.34), vec3(0.98, 0.5, 0.36), vec3(0.88, 0.44, 0.55), vec3(0.6, 0.5, 0.76), vec3(0.3, 0.43, 0.8), vec3(0.11, 0.25, 0.63), vec3(0.03, 0.09, 0.36));
  float dx = (uv.x - sun.x) * aspect;
  float near = exp(-dx * dx * 1.4);
  float h = clamp(uv.y, 0.0, 1.0);
  vec3 col = sk_lin(sk_bs(st, pow(h, mix(0.95, 1.3, near)) * 7.0));
  col *= 1.0 + near * 1.3 * exp(-h * 6.0);
  return col * mix(0.78, 1.0, max(near, 1.0 - h));
}

vec3 sk_glow(vec2 d) {
  float r = length(d);
  float wide = exp(-length(d * vec2(0.42, 1.5)) / 0.15);
  return vec3(2.6, 1.3, 0.42) * exp(-r / 0.03) + vec3(1.2, 0.48, 0.15) * exp(-r / 0.09) + vec3(0.5, 0.17, 0.08) * wide;
}

vec4 c_sun(vec2 uv, vec2 sun, float aspect) {
  float px = max(fwidth(uv.y), 1e-4);
  vec2 d = vec2((uv.x - sun.x) * aspect, uv.y - sun.y);
  float R = 0.024;
  float r = length(d);
  float disc = clamp((R - r) / px + 0.5, 0.0, 1.0);
  float mu = sqrt(max(1.0 - r * r / (R * R), 0.0));
  return vec4(mix(vec3(6.0, 3.2, 1.2), vec3(12.0, 9.0, 5.0), mu) * disc + sk_glow(d), disc);
}

float sk_smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sk_tower(vec2 p, vec2 b, float w, float h, float k) {
  float bound = max(abs(p.x - b.x) - 1.6 * w, max(b.y - p.y, p.y - b.y - h - 0.1 * w));
  if (bound > 0.25) return bound;
  float d = 1e3;
  vec2 c = b;
  for (int i = 0; i < 6; i++) {
    float t = float(i) / 5.0;
    float r = w * mix(1.0, 0.72, t) * (0.85 + 0.3 * sk_h1(vec2(k, float(i))));
    c = b + vec2(w * 0.35 * sin(k * 3.0 + t * 3.5) * t, t * (h - 0.72 * w) + r * 0.5);
    d = sk_smin(d, length(p - c) - r, w * 0.4);
  }
  d = sk_smin(d, length(p - c - vec2(w * 0.5, -w * 0.12)) - w * 0.56, w * 0.35);
  d = sk_smin(d, length(p - c + vec2(w * 0.52, w * 0.1)) - w * 0.52, w * 0.35);
  return max(d, b.y - p.y);
}

vec2 sk_mass(vec2 p, vec2 s, float aspect, vec4 rs) {
  float side = s.x > aspect * 0.5 ? -1.0 : 1.0;
  float base = clamp(s.y - 0.1, 0.1, 0.4);
  float mx = s.x + side * (0.46 + 0.08 * (rs.x - 0.5));
  float d = sk_tower(p, vec2(mx, base), 0.13, 0.68 + 0.08 * rs.y, rs.z * 6.28);
  d = sk_smin(d, sk_tower(p, vec2(mx - side * 0.15, base + 0.02), 0.085, 0.3, rs.w * 6.28 + 1.0), 0.03);
  d = sk_smin(d, sk_tower(p, vec2(mx + side * 0.16, base), 0.1, 0.42 + 0.06 * rs.x, rs.y * 6.28 + 2.0), 0.03);
  d = min(d, sk_tower(p, vec2(s.x - side * (0.38 + 0.06 * rs.w), base + 0.03), 0.1, 0.32 + 0.08 * rs.z, rs.x * 6.28 + 3.0));
  d = min(d, sk_tower(p, vec2(mx + side * 0.64, base + 0.01), 0.1, 0.46, rs.z * 6.28 + 4.0));
  float all = d;
  float yb = clamp(s.y - 0.018, 0.14, 0.42);
  if (abs(p.y - yb) < 0.3) {
    float th = 0.016 + 0.09 * (sk_noise(vec2(p.x * 2.4 + rs.y * 40.0, 1.3)) * 0.7 + sk_noise(vec2(p.x * 5.3, 7.1)) * 0.3 - 0.5);
    all = min(all, (abs(p.y - yb + 0.012 * sk_noise(vec2(p.x * 6.0, 5.0))) - th) * 0.8);
  }
  vec2 cs = vec2(0.3, 0.2);
  vec2 o = vec2(rs.w * 0.3, 0.46);
  vec2 cid = floor((p - o) / cs);
  if (cid.y >= 0.0 && cid.y < 2.0) {
    vec2 h = sk_h2(cid + rs.xy * 50.0);
    if (h.x > 0.5) {
      vec2 c = (cid + 0.4 + 0.2 * sk_h2(cid + rs.zw * 30.0 + 9.1)) * cs + o;
      float w = 0.014 + 0.016 * h.y;
      float pd = length((p - c) * vec2(0.5, 1.0)) - w;
      pd = sk_smin(pd, length(p - c - vec2(w * 0.9, -w * 0.2)) - w * 0.62, w * 0.4);
      pd = sk_smin(pd, length(p - c + vec2(w * 0.95, w * 0.25)) - w * 0.55, w * 0.4);
      all = min(all, max(pd, c.y - w * 0.55 - p.y));
    }
  }
  return vec2(all, d);
}

vec2 sk_warp(vec2 p, vec4 rs) {
  vec2 q = p * 3.0 + rs.xy * 20.0;
  return p + (vec2(sk_fbm(q, 3), sk_fbm(q + vec2(5.2, 1.3), 3)) - 0.44) * 0.06;
}

float sk_shape(vec2 p, vec2 s, float aspect, vec4 rs, out float B) {
  vec2 q = sk_warp(p, rs);
  vec2 m = sk_mass(q, s, aspect, rs);
  B = m.x;
  if (m.x > 0.16) return m.x;
  float big = smoothstep(0.1, 0.0, m.y);
  float d = m.x + mix(0.03, 0.075, big);
  for (int k = 0; k < 5; k++) {
    float cs = 0.11 * pow(0.55, float(k));
    vec2 id0 = floor(q / cs);
    float bk = 0.0;
    for (int j = 0; j < 9; j++) {
      vec2 id = id0 + vec2(float(j % 3) - 1.0, float(j / 3) - 1.0);
      vec2 h = sk_h2(id + float(k) * 37.0 + rs.xy * 91.0);
      float r = cs * (0.45 + 0.5 * fract(h.x * 7.3 + h.y * 3.1));
      vec2 v = q - (id + 0.15 + 0.7 * h) * cs;
      float u = max(1.0 - dot(v, v) / (r * r), 0.0);
      bk = max(bk, r * u * (1.5 - 0.5 * u));
    }
    bk *= k < 2 ? big : smoothstep(cs * 1.2, 0.0, d);
    d -= bk;
    if (k == 1) B = d;
  }
  return d;
}

vec4 sk_cirrus(vec2 p, vec2 s, vec4 rs) {
  vec2 q = mat2(0.99, 0.14, -0.14, 0.99) * p + rs.zw * 30.0;
  vec2 w = vec2(sk_fbm(q * vec2(1.5, 4.0), 3), sk_fbm(q * vec2(1.5, 4.0) + 5.2, 3)) - 0.45;
  float f = sk_fbm(vec2(q.x * 1.4, q.y * 16.0) + w * vec2(1.2, 4.0), 5);
  float m = smoothstep(0.5, 0.8, p.y) * smoothstep(0.3, 0.6, sk_noise(q * vec2(1.2, 2.5) + 3.3));
  float a = smoothstep(0.5, 0.75, f) * m * (0.55 + 0.45 * sk_noise(vec2(q.x * 30.0, q.y * 140.0)));
  vec3 col = mix(sk_lin(vec3(0.95, 0.55, 0.72)), sk_lin(vec3(1.0, 0.74, 0.55)), smoothstep(0.6, 0.0, abs(p.x - s.x)));
  float g = sk_fbm(vec2(q.x * 2.2, q.y * 38.0) + w * vec2(0.8, 2.0) + 11.0, 4);
  float sa = smoothstep(0.5, 0.72, g) * smoothstep(0.17, 0.24, p.y) * smoothstep(0.36, 0.27, p.y) * 0.7;
  float near = exp(-length((p - s) * vec2(0.35, 1.0)) * 5.0);
  vec3 sc = mix(sk_lin(vec3(0.85, 0.5, 0.6)), vec3(2.6, 1.5, 0.6), near);
  float at = sa + a * (1.0 - sa);
  return vec4((sc * sa + col * a * (1.0 - sa)) / max(at, 1e-5), at);
}

vec4 c_clouds(vec2 uv, vec2 sun, float aspect, float seed) {
  float px = max(fwidth(uv.y), 1e-4);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 s = vec2(sun.x * aspect, sun.y);
  vec4 rs = vec4(sk_h1(vec2(seed, 1.7)), sk_h1(vec2(seed, 2.9)), sk_h1(vec2(seed, 4.3)), sk_h1(vec2(seed, 5.1)));
  vec2 ts = s - p;
  float ds = length(ts);
  vec2 dir = ts / max(ds, 1e-4);
  float prox = exp(-ds * ds * 9.0);
  vec4 ci = sk_cirrus(p, s, rs);
  vec4 cu = vec4(0.0);
  float B;
  float dc = sk_shape(p, s, aspect, rs, B);
  vec2 gd = vec2(dFdx(dc), dFdy(dc));
  float fw = clamp(abs(gd.x) + abs(gd.y), 0.5 * px, 4.0 * px);
  vec2 gc = gd / max(length(gd), 1e-7);
  if (dc < fw) {
    float cov = clamp(0.5 - dc / fw, 0.0, 1.0);
    float wb = mix(0.02, 0.045, smoothstep(0.1, 0.9, ds)) * (0.55 + 0.9 * sk_noise(p * 9.0 + rs.zw * 40.0));
    float b2;
    float l1 = smoothstep(-0.002, 0.002, sk_shape(p + dir * 0.005, s, aspect, rs, b2));
    float l3 = smoothstep(-0.01, 0.01, sk_shape(p + dir * wb * 2.5, s, aspect, rs, b2));
    float l2 = smoothstep(-0.004, 0.004, sk_shape(p + dir * wb, s, aspect, rs, b2));
    float tau = 0.0;
    float t = 0.003;
    for (int i = 0; i < 12; i++) {
      tau += clamp(0.5 - sk_mass(sk_warp(p + dir * t, rs), s, aspect, rs).x / 0.01, 0.0, 1.0) * t * 0.34 * step(t, ds);
      t *= 1.5;
    }
    float occl = exp(-max(tau - wb, 0.0) * 35.0);
    float inner = max(-dc, 0.0);
    float scatter = prox * exp(-tau / 0.012);
    sk_shape(p + vec2(0.0, 0.015), s, aspect, rs, b2);
    float up = clamp(0.5 + (b2 - B) * 18.0, 0.0, 1.0) * 0.7 + 0.3 * smoothstep(0.2, 0.9, uv.y);
    float skyRim = exp(-inner / 0.006) * smoothstep(0.0, -0.6, dot(gc, dir));
    vec3 col = mix(mix(sk_lin(vec3(0.5, 0.44, 0.56)), sk_lin(vec3(0.33, 0.4, 0.6)), up), sk_lin(vec3(0.6, 0.45, 0.6)), smoothstep(0.55, 1.1, ds) * 0.7) * (0.65 + 0.35 * exp(-tau / 0.08)) * (1.0 + 0.35 * skyRim);
    col = mix(col, mix(sk_lin(vec3(0.92, 0.55, 0.66)), sk_lin(vec3(0.98, 0.58, 0.42)), prox), l3 * occl * 0.7);
    float lam = exp(-tau / (wb * 1.5));
    col = mix(col, mix(sk_lin(vec3(0.98, 0.6, 0.58)), sk_lin(vec3(1.0, 0.78, 0.42)) * 1.5, prox) * (0.75 + 0.45 * lam), l2 * occl);
    col = mix(col, mix(sk_lin(vec3(1.0, 0.75, 0.62)) * 1.1, vec3(3.2, 2.6, 1.7), prox), l1 * occl);
    col += vec3(1.0, 0.6, 0.3) * scatter * 2.0;
    float fog = clamp(0.8 * exp(-(uv.y - 0.12) * 5.0) + 0.15 * prox, 0.0, 0.75);
    cu = vec4(mix(col, c_sky(uv, sun, aspect), fog), cov * (1.0 - 0.4 * scatter));
  }
  float a = cu.a + ci.a * (1.0 - cu.a);
  return vec4((cu.rgb * cu.a + ci.rgb * ci.a * (1.0 - cu.a)) / max(a, 1e-5), a);
}

float sk_row(vec2 p, float w, float h0, float amp, float sd, out vec4 hb) {
  float ci = floor(p.x / w);
  float dmin = 1e3;
  float zb = 9.0;
  hb = vec4(0.0, 0.0, 0.0, 1.0);
  for (int k = -2; k <= 2; k++) {
    float i = ci + float(k);
    vec2 a = sk_h2(vec2(i, sd));
    vec2 b = sk_h2(vec2(i + 57.3, sd + 11.0));
    float cx = (i + 0.5 + (a.x - 0.5) * 0.7) * w;
    float hw = w * (0.3 + 0.55 * b.x);
    float ht = h0 + amp * pow(a.y, 1.5) * (0.3 + 1.1 * sk_noise(vec2(cx * 2.2, sd)));
    float ax = abs(p.x - cx);
    float d = max(ax - hw, p.y - ht);
    float top = ht;
    if (b.y > 0.72) {
      float t2 = ht + amp * 0.3 * (b.y - 0.6);
      d = min(d, max(ax - hw * 0.55, p.y - t2));
      if (ax < hw * 0.55) top = t2;
    }
    if (a.y > 0.8 && b.y < 0.4) d = min(d, max(abs(p.x - cx - hw * 0.25) - 0.0011, p.y - ht - 0.02 - 0.03 * b.x));
    dmin = min(dmin, d);
    float z = fract(a.x * 17.0 + b.y * 5.0);
    if (d < 0.0015 && z < zb) {
      zb = z;
      hb = vec4(i, p.x - cx + hw, top, hw);
    }
  }
  return dmin;
}

vec3 sk_facade(vec2 p, vec4 hb, float sc, float px) {
  vec2 cell = vec2(0.0045, 0.0058) * sc;
  vec2 g = vec2(hb.y, p.y) / cell;
  vec2 gi = floor(g);
  vec2 gf = fract(g);
  vec2 aa = px / cell;
  float wx = smoothstep(0.22 - aa.x, 0.22 + aa.x, gf.x) - smoothstep(0.72 - aa.x, 0.72 + aa.x, gf.x);
  float wy = smoothstep(0.3 - aa.y, 0.3 + aa.y, gf.y) - smoothstep(0.72 - aa.y, 0.72 + aa.y, gf.y);
  float lit = step(0.8 - 0.45 * sk_h1(vec2(gi.y * 0.37, hb.x)), sk_h1(gi + hb.x * 13.1));
  float inside = step(cell.x, hb.y) * step(hb.y, 2.0 * hb.w - cell.x) * step(p.y, hb.z - cell.y * 1.2);
  float hue = sk_h1(gi + hb.x * 7.7 + 3.0);
  return mix(vec3(1.0, 0.52, 0.2), vec3(1.0, 0.82, 0.55), hue * hue) * (1.0 + 2.0 * sk_h1(gi.yx + hb.x)) * lit * wx * wy * inside;
}

vec4 c_city(vec2 uv, vec2 sun, float aspect, float seed) {
  float px = max(fwidth(uv.y), 1e-4);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 s = vec2(sun.x * aspect, sun.y);
  vec3 hz = mix(c_sky(vec2(uv.x, 0.13), sun, aspect) * 0.16, sk_lin(vec3(0.3, 0.37, 0.56)), 0.5) + sk_glow(vec2(p.x - s.x, 0.13 - s.y)) * 0.12;
  float glowX = exp(-(p.x - s.x) * (p.x - s.x) * 6.0);
  vec4 acc = vec4(0.0);
  for (int r = 0; r < 3; r++) {
    float fr = float(r) * 0.5;
    float h0 = mix(0.09, 0.022, fr);
    float amp = mix(0.1, 0.055, fr);
    float haze = mix(0.62, 0.12, fr);
    vec4 hb;
    float d = sk_row(p, mix(0.045, 0.1, fr), h0, amp, seed * 3.7 + fr * 38.0, hb);
    if (r == 2) d = min(d, p.y - 0.016 - 0.008 * sk_noise(vec2(p.x * 40.0, 1.0)));
    float a = clamp(0.5 - d / px, 0.0, 1.0);
    vec3 base = sk_lin(vec3(0.12, 0.15, 0.26)) * (0.75 + 0.5 * sk_h1(vec2(hb.x, fr)));
    float mist = (1.0 - smoothstep(h0 * 0.3, h0 + amp * 0.4, p.y)) * 0.3 * (1.0 - fr * 0.8);
    vec3 col = mix(base, hz, clamp(haze + mist, 0.0, 1.0));
    col += sk_facade(p, hb, mix(0.65, 1.0, fr), px) * mix(0.35, 1.0, fr) * (1.0 - haze * 0.5);
    col += hz * 0.9 * glowX * smoothstep(hb.z - 0.004, hb.z, p.y) * (1.0 - fr * 0.6);
    acc = vec4(col * a, a) + acc * (1.0 - a);
  }
  return vec4(acc.rgb / max(acc.a, 1e-5), acc.a);
}

vec3 c_flare(vec2 uv, vec2 sun, float aspect) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 s = vec2(sun.x * aspect, sun.y);
  vec2 d = p - s;
  float r = length(d);
  vec2 u = d / max(r, 1e-4);
  float rays = pow(sk_noise(u * 3.0 + 4.1), 3.0) * 0.7 + pow(sk_noise(u * 9.0 + 1.3), 4.0) * 0.6;
  rays *= exp(-r / 0.3) * smoothstep(0.02, 0.12, r) * smoothstep(-0.35, 0.3, u.y) * smoothstep(0.12, 0.25, uv.y);
  vec3 col = vec3(1.0, 0.55, 0.25) * rays * 0.6;
  col += vec3(1.0, 0.6, 0.3) * exp(-abs(d.y) / 0.0035) * exp(-abs(d.x) / 0.45) * 0.18;
  vec3 ring = vec3(exp(-pow((r - 0.335) / 0.012, 2.0)), exp(-pow((r - 0.325) / 0.012, 2.0)), exp(-pow((r - 0.315) / 0.012, 2.0)));
  col += ring * 0.025 * smoothstep(-0.3, 0.2, u.y);
  float gk[6] = float[6](0.4, 0.75, 1.1, 1.45, 1.75, 2.1);
  float gr[6] = float[6](0.018, 0.05, 0.03, 0.09, 0.022, 0.06);
  vec3 gc[6] = vec3[6](vec3(0.5, 0.9, 0.6) * 0.04, vec3(1.0, 0.5, 0.3) * 0.05, vec3(0.6, 0.5, 1.0) * 0.035, vec3(0.3, 0.8, 1.0) * 0.03, vec3(1.0, 0.8, 0.4) * 0.05, vec3(0.9, 0.4, 0.8) * 0.03);
  vec2 ax = vec2(aspect * 0.5, 0.5) - s;
  for (int i = 0; i < 6; i++) {
    vec2 q = p - s - ax * gk[i];
    float hx = max(abs(q.x) * 0.866 + abs(q.y) * 0.5, abs(q.y));
    col += gc[i] * smoothstep(gr[i], gr[i] * 0.75, hx) * (0.35 + 0.65 * smoothstep(gr[i] * 0.4, gr[i], hx));
  }
  return col;
}
`;
