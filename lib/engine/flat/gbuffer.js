import { GLSL_PRIMS, compile } from "../form/sdf";
import { rgb } from "../palette";
import { NOISE } from "../space/glsl";

const v3 = (c) => `vec3(${c.map((x) => x.toFixed(4)).join(", ")})`;

const GROUND = {
  ground: "#77726a",
  meadow: "#6f8a4c",
  forest: "#55503a",
  snowfield: "#e3e8ee",
  city: "#5b5d61",
  desert: "#d2b07f",
  mountains: "#86827a",
  ocean: "#3c6f8f",
};

export function gbuffer(ctx, arranged, w, h) {
  const { THREE, renderer, plan } = ctx;
  const { placed, rig } = arranged;
  const solid = placed.filter((p) => p.form.glsl || p.form.planet);
  const subjects = solid
    .map((p, k) => {
      const q = `rotY(p - ${v3([p.spot.x, p.spot.y, p.spot.z])}, ${(-p.spot.yaw).toFixed(5)})`;
      if (p.form.planet) {
        const R = p.form.size / 2;
        return `{ vec3 q = ${q}; float e = length(q) - ${R.toFixed(4)}; if (e < d) { d = e; sid = ${k}.0; pid = 0.0; } }`;
      }
      return `{ vec3 q = ${q}; float id; float e = sdfId${k}(q, id); if (e < d) { d = e; sid = ${k}.0; pid = id; } }`;
    })
    .join("\n  ");
  const colors = solid
    .map((p, k) => {
      if (p.form.planet) {
        const R = p.form.size / 2;
        return `if (sid < ${k}.5) { vec3 q = rotY(p - ${v3([p.spot.x, p.spot.y, p.spot.z])}, ${(-p.spot.yaw).toFixed(5)}) / ${R.toFixed(4)}; float e = fbm(q * 1.6); vec3 land = mix(vec3(0.37, 0.54, 0.28), vec3(0.6, 0.5, 0.33), smoothstep(0.0, 0.4, e)); vec3 sea = mix(vec3(0.08, 0.22, 0.4), vec3(0.18, 0.42, 0.55), smoothstep(-0.3, 0.0, e)); vec3 c = e > 0.0 ? land : sea; if (abs(q.y) > 0.86) c = vec3(0.93); return c; }`;
      }
      const chain = p.prims
        .map((prim, i) => {
          const top = rgb(prim.color || p.subject.colors[0] || "#c9c3b8");
          const under = rgb(prim.under || prim.color || p.subject.colors[0] || "#c9c3b8");
          return `if (pid < ${i}.5) return mix(${v3(under)}, ${v3(top)}, smoothstep(-0.4, 0.45, n.y));`;
        })
        .join(" ");
      return `if (sid < ${k}.5) { ${chain} return vec3(0.8); }`;
    })
    .join("\n  ");
  const setting = plan.world.setting;
  const floor = setting !== "void" && setting !== "space";
  const groundColor = rgb(GROUND[setting] || GROUND.ground);
  const shader = `precision highp float;
${GLSL_PRIMS}
${NOISE}
${solid.map((p, k) => (p.form.glsl ? compile(p.prims, k) : "")).join("\n")}
uniform vec3 uCam;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform float uTan;
uniform vec2 uRes;
uniform float uFar;
uniform float uPass;
vec3 rotY(vec3 p, float a) { float c = cos(a); float s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
float map(vec3 p, out float sid, out float pid) {
  float d = 1e5;
  sid = -1.0;
  pid = 0.0;
  ${subjects}
  ${floor ? "if (p.y < d) { d = p.y; sid = 90.0; pid = 0.0; }" : ""}
  return d;
}
float mapD(vec3 p) { float a; float b; return map(p, a, b); }
vec3 albedo(float sid, float pid, vec3 n, vec3 p) {
  if (sid > 89.5) return ${v3(groundColor)};
  ${colors}
  return vec3(0.8);
}
void main() {
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  uv.x *= uRes.x / uRes.y;
  vec3 rd = normalize(uFwd + (uRight * uv.x + uUp * uv.y) * uTan);
  float t = 0.0;
  float sid = -1.0;
  float pid = 0.0;
  bool hit = false;
  for (int i = 0; i < 220; i++) {
    vec3 p = uCam + rd * t;
    float d = map(p, sid, pid);
    if (d < max(0.0004, t * 0.0007)) { hit = true; break; }
    t += d * 0.9;
    if (t > uFar) break;
  }
  if (!hit) { gl_FragColor = vec4(0.0, 0.0, 0.0, -1.0); return; }
  vec3 p = uCam + rd * t;
  float e = max(0.0005, t * 0.0012);
  vec3 n = normalize(vec3(mapD(p + vec3(e, 0, 0)) - mapD(p - vec3(e, 0, 0)), mapD(p + vec3(0, e, 0)) - mapD(p - vec3(0, e, 0)), mapD(p + vec3(0, 0, e)) - mapD(p - vec3(0, 0, e))));
  if (uPass < 0.5) gl_FragColor = vec4(n, t);
  else gl_FragColor = vec4(albedo(sid, pid, n, p), sid);
}`;
  const cam = rig.end.pos.clone();
  const fwd = rig.end.target.clone().sub(cam).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const uniforms = {
    uCam: { value: cam },
    uRight: { value: right },
    uUp: { value: up },
    uFwd: { value: fwd },
    uTan: { value: Math.tan((rig.fov * Math.PI) / 360) },
    uRes: { value: new THREE.Vector2(w, h) },
    uFar: { value: Math.max(arranged.scene.reach * 2, 50) },
    uPass: { value: 0 },
  };
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const material = new THREE.ShaderMaterial({ vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: shader, uniforms });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const read = (pass) => {
    uniforms.uPass.value = pass;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const data = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(target, 0, 0, w, h, data);
    renderer.setRenderTarget(null);
    return data;
  };
  const geo = read(0);
  const col = read(1);
  target.dispose();
  material.dispose();
  mesh.geometry.dispose();
  const n = w * h;
  const out = { w, h, depth: new Float32Array(n), sid: new Int16Array(n), normal: new Float32Array(n * 3), albedo: new Float32Array(n * 3), floor, subjects: solid.length };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = (h - 1 - y) * w + x;
      out.depth[dst] = geo[src + 3];
      out.sid[dst] = geo[src + 3] < 0 ? -1 : Math.round(col[src + 3]);
      out.normal.set([geo[src], geo[src + 1], geo[src + 2]], dst * 3);
      out.albedo.set([col[src], col[src + 1], col[src + 2]], dst * 3);
    }
  const f = arranged.focus.clone().sub(cam);
  const fz = f.dot(fwd);
  out.focus = [(f.dot(right) / (fz * uniforms.uTan.value) / (w / h) + 1) * 0.5 * w, (1 - (f.dot(up) / (fz * uniforms.uTan.value) + 1) * 0.5) * h];
  out.key = [ctx.U.uKeyDir.value.x, ctx.U.uKeyDir.value.y, ctx.U.uKeyDir.value.z];
  out.view = { right: right.toArray(), up: up.toArray(), fwd: fwd.toArray() };
  return out;
}
