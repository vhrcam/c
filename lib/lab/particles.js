const VERT = `#version 300 es
layout(location = 0) in vec2 p;
out vec2 v_uv;
void main() {
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylor(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylor(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const UPDATE = `#version 300 es
precision highp float;
layout(location = 0) out vec4 o_pos;
layout(location = 1) out vec4 o_vel;
layout(location = 2) out vec4 o_col;
uniform sampler2D u_pos;
uniform sampler2D u_vel;
uniform sampler2D u_col;
uniform sampler2D u_field;
uniform sampler2D u_target;
uniform sampler2D u_region;
uniform vec2 u_size;
uniform vec2 u_sun;
uniform vec4 u_box;
uniform float u_aspect;
uniform float u_t;
uniform float u_dt;
uniform float u_active;
uniform float u_alive;
uniform float u_spawnSun;
uniform float u_figures;
uniform float u_structure;
uniform float u_turb;
uniform float u_speed;
uniform vec2 u_life;
${NOISE}
vec2 curl(vec2 p, float t) {
  float e = 0.004;
  float a = snoise(vec3(p.x, p.y + e, t));
  float b = snoise(vec3(p.x, p.y - e, t));
  float c = snoise(vec3(p.x + e, p.y, t));
  float d = snoise(vec3(p.x - e, p.y, t));
  return vec2(a - b, -(c - d)) / (2.0 * e);
}
float regionAt(vec2 p) { return floor(texture(u_region, p).r * 255.0 + 0.5); }
void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(u_pos, id, 0);
  vec4 V = texelFetch(u_vel, id, 0);
  vec4 C = texelFetch(u_col, id, 0);
  float index = (float(id.y) * u_size.x + float(id.x)) / (u_size.x * u_size.y);
  float age = V.z + u_dt;
  bool dead = P.x < 0.0 || age > V.w || P.x > 1.0 || P.y < 0.0 || P.y > 1.0;
  if (dead) {
    vec2 seed = vec2(id) + vec2(u_t * 61.7, u_t * 17.3);
    if (u_alive < 0.5 || index > u_active || hash(seed + 1.7) > 0.35) {
      o_pos = vec4(-1.0);
      o_vel = vec4(0.0, 0.0, 0.0, 0.0);
      o_col = C;
      return;
    }
    vec2 p;
    vec2 v = vec2(0.0);
    if (hash(seed) < u_spawnSun) {
      float ang = hash(seed + 3.1) * 6.2831;
      float rad = pow(hash(seed + 5.3), 2.0) * 0.06;
      vec2 dir = vec2(cos(ang), sin(ang));
      p = u_sun + dir * rad * vec2(1.0 / u_aspect, 1.0);
      v = dir * u_speed * 1.6;
    } else if (hash(seed + 9.9) < u_figures) {
      p = mix(u_box.xy, u_box.zw, vec2(hash(seed + 2.2), hash(seed + 4.4)));
    } else {
      p = vec2(hash(seed + 7.7), hash(seed + 8.8));
    }
    vec3 base = texture(u_target, p).rgb;
    float j = hash(seed + 12.5);
    vec3 tint = base * (0.88 + 0.24 * j) + (vec3(hash(seed + 13.1), hash(seed + 14.2), hash(seed + 15.3)) - 0.5) * 0.06;
    o_pos = vec4(p, p);
    o_vel = vec4(v, 0.0, mix(u_life.x, u_life.y, hash(seed + 6.6)));
    o_col = vec4(clamp(tint, 0.0, 1.0), regionAt(p) / 255.0);
    return;
  }
  vec2 p = P.xy;
  vec2 v = V.xy;
  float reg = floor(C.a * 255.0 + 0.5);
  vec2 f = texture(u_field, p).xy;
  if (dot(f, v) < 0.0) f = -f;
  vec2 c = curl(p * vec2(u_aspect, 1.0) * 2.4, u_t * 0.07 + reg * 3.0);
  float cl = length(c);
  vec2 swirl = cl > 1e-4 ? c / cl : vec2(1.0, 0.0);
  float hold = reg >= 10.0 ? 1.0 : reg == 2.0 ? 0.95 : reg == 1.0 ? 0.7 : 0.38;
  vec2 dir = normalize(mix(swirl * u_turb, f, u_structure * hold) + vec2(1e-5));
  float speed = u_speed * (reg >= 10.0 ? 0.5 : reg == 2.0 ? 0.6 : 1.0);
  v = mix(v, dir * speed, 0.14);
  vec2 np = p + v * u_dt * vec2(1.0 / u_aspect, 1.0);
  if (regionAt(np) != reg) {
    o_pos = vec4(np, p);
    o_vel = vec4(v, 1e5, 1.0);
    o_col = C;
    return;
  }
  o_pos = vec4(np, p);
  o_vel = vec4(v, age, V.w);
  o_col = C;
}`;

const TRAILS = `#version 300 es
precision highp float;
uniform sampler2D u_pos;
uniform sampler2D u_vel;
uniform sampler2D u_col;
uniform vec2 u_size;
uniform float u_alpha;
out vec4 v_color;
void main() {
  int pid = gl_VertexID / 2;
  ivec2 id = ivec2(pid % int(u_size.x), pid / int(u_size.x));
  vec4 P = texelFetch(u_pos, id, 0);
  vec4 V = texelFetch(u_vel, id, 0);
  vec4 C = texelFetch(u_col, id, 0);
  vec2 p = gl_VertexID % 2 == 0 ? P.zw : P.xy;
  float life = V.w;
  float fade = smoothstep(0.0, 0.25, V.z) * (1.0 - smoothstep(life * 0.8, life, V.z));
  float reg = floor(C.a * 255.0 + 0.5);
  float a = u_alpha * fade * (reg >= 10.0 ? 1.15 : 1.0);
  v_color = vec4(C.rgb, a);
  gl_Position = P.x < 0.0 || V.z > life ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;

const SPARKS = `#version 300 es
precision highp float;
uniform sampler2D u_pos;
uniform sampler2D u_vel;
uniform sampler2D u_col;
uniform vec2 u_size;
uniform float u_glow;
uniform float u_point;
uniform vec4 u_frame;
out vec4 v_color;
void main() {
  ivec2 id = ivec2(gl_VertexID % int(u_size.x), gl_VertexID / int(u_size.x));
  vec4 P = texelFetch(u_pos, id, 0);
  vec4 V = texelFetch(u_vel, id, 0);
  vec4 C = texelFetch(u_col, id, 0);
  float fade = smoothstep(0.0, 0.2, V.z) * (1.0 - smoothstep(V.w * 0.7, V.w, V.z));
  v_color = vec4(mix(C.rgb, vec3(1.0, 0.96, 0.86), 0.55), u_glow * fade);
  vec2 p = u_frame.xy + P.xy * u_frame.zw;
  gl_Position = P.x < 0.0 || V.z > V.w ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  gl_PointSize = u_point;
}`;

const FLAT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 o;
void main() { o = v_color; }`;

const DOT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  o = vec4(v_color.rgb, v_color.a * smoothstep(1.0, 0.0, d));
}`;

const SHOW = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_acc;
uniform vec4 u_frame;
uniform vec3 u_paper;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 img = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 a = (img - u_frame.xy) / u_frame.zw;
  vec3 col = u_paper;
  if (a.x >= 0.0 && a.y >= 0.0 && a.x <= 1.0 && a.y <= 1.0) col = texture(u_acc, vec2(a.x, 1.0 - a.y)).rgb;
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
  o = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function link(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function tex(gl, w, h, internal, format, type, data, filter = gl.NEAREST) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function uniforms(gl, prog, values) {
  let unit = 0;
  for (const [name, v] of Object.entries(values)) {
    const loc = gl.getUniformLocation(prog, name);
    if (loc === null) continue;
    if (v instanceof WebGLTexture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, v);
      gl.uniform1i(loc, unit++);
    } else if (typeof v === "number") gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2fv(loc, v);
    else if (v.length === 3) gl.uniform3fv(loc, v);
    else gl.uniform4fv(loc, v);
  }
}

const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

export function phases(t) {
  return {
    active: 0.015 + 0.985 * ramp(t, 0.6, 7) ** 1.6,
    alive: t < 9.2 ? 1 : 0,
    spawnSun: 0.97 - 0.9 * ramp(t, 1.4, 6),
    figures: 0.42 * ramp(t, 5.5, 9),
    structure: 0.08 + 0.8 * ramp(t, 2.5, 9.5),
    turb: 1 - 0.2 * ramp(t, 5, 11),
    speed: 0.17 - 0.08 * ramp(t, 3, 11),
    alpha: 0.3 + 0.08 * ramp(t, 5, 10),
    life: [1.2 + 0.6 * ramp(t, 0, 6) - 0.9 * ramp(t, 6.5, 9), 2.6 + 1.4 * ramp(t, 0, 6) - 2.2 * ramp(t, 6.5, 9)],
    glow: t < 12.5 ? 0.55 * (1 - ramp(t, 9, 12.5)) + 0.12 * (1 - ramp(t, 10.5, 12.5)) : 0,
  };
}

export function particles(canvas, sc, { count = 384, frame = [0.04, 0.028, 0.92, 0.92], paper = [0.949, 0.922, 0.871] } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("This browser can't run WebGL2");
  gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("EXT_float_blend");
  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const empty = gl.createVertexArray();

  const update = link(gl, VERT, UPDATE);
  const trails = link(gl, TRAILS, FLAT);
  const sparks = link(gl, SPARKS, DOT);
  const show = link(gl, VERT, SHOW);

  const { w, h } = sc;
  const field = tex(gl, w, h, gl.RG16F, gl.RG, gl.FLOAT, sc.dirs, gl.LINEAR);
  const rgba = new Uint8Array(w * h * 4);
  const reg = new Uint8Array(w * h * 4);
  let box = [1, 1, 0, 0];
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = sc.rgb[i * 3];
    rgba[i * 4 + 1] = sc.rgb[i * 3 + 1];
    rgba[i * 4 + 2] = sc.rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
    reg[i * 4] = sc.region[i];
    if (sc.region[i] >= 10) {
      const x = (i % w) / w;
      const y = Math.floor(i / w) / h;
      box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
    }
  }
  const target = tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, rgba, gl.LINEAR);
  const region = tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, reg, gl.NEAREST);

  const size = [count, count];
  const state = () => {
    const make = () => tex(gl, count, count, gl.RGBA32F, gl.RGBA, gl.FLOAT, new Float32Array(count * count * 4).fill(-1));
    const t = [make(), make(), make()];
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    t.forEach((x, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, x, 0));
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    return { t, fb };
  };
  let a = state();
  let b = state();

  const aw = Math.round(canvas.width * frame[2]);
  const ah = Math.round(canvas.height * frame[3]);
  const acc = tex(gl, aw, ah, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.LINEAR);
  const accFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, accFb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, acc, 0);

  const sun = [sc.sun[0] / w, sc.sun[1] / h];
  const aspect = canvas.width / canvas.height;

  const reset = () => {
    for (const s of [a, b]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fb);
      gl.clearBufferfv(gl.COLOR, 0, [-1, -1, -1, -1]);
      gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
      gl.clearBufferfv(gl.COLOR, 2, [0, 0, 0, 0]);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, accFb);
    gl.clearColor(paper[0], paper[1], paper[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  const step = (t, dt) => {
    const ph = phases(t);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(quad);
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
    gl.viewport(0, 0, count, count);
    gl.useProgram(update);
    uniforms(gl, update, { u_pos: a.t[0], u_vel: a.t[1], u_col: a.t[2], u_field: field, u_target: target, u_region: region, u_size: size, u_sun: sun, u_box: box, u_aspect: aspect, u_t: t, u_dt: dt, u_active: ph.active, u_alive: ph.alive, u_spawnSun: ph.spawnSun, u_figures: ph.figures, u_structure: ph.structure, u_turb: ph.turb, u_speed: ph.speed, u_life: ph.life });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [a, b] = [b, a];

    gl.bindFramebuffer(gl.FRAMEBUFFER, accFb);
    gl.viewport(0, 0, aw, ah);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(empty);
    gl.useProgram(trails);
    uniforms(gl, trails, { u_pos: a.t[0], u_vel: a.t[1], u_col: a.t[2], u_size: size, u_alpha: ph.alpha });
    gl.drawArrays(gl.LINES, 0, count * count * 2);
  };

  const draw = (t) => {
    const ph = phases(t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(quad);
    gl.useProgram(show);
    uniforms(gl, show, { u_acc: acc, u_frame: frame, u_paper: paper });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (ph.glow > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.bindVertexArray(empty);
      gl.useProgram(sparks);
      uniforms(gl, sparks, { u_pos: a.t[0], u_vel: a.t[1], u_col: a.t[2], u_size: size, u_glow: ph.glow, u_point: 2.6 * (canvas.width / 1500), u_frame: frame });
      gl.drawArrays(gl.POINTS, 0, count * count);
    }
  };

  reset();
  return { step, draw, reset, end: 12.5 };
}
