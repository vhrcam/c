const VERTEX = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}
`;

function pass(ctx, size, fragmentShader, uniforms) {
  const { THREE, renderer } = ctx;
  const target = new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const data = new Float32Array(size * size * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size, size, data);
  renderer.setRenderTarget(prev);
  return {
    target,
    data,
    done: () => {
      target.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}

export function sampleSurface(ctx, glsl, box, count, seed = 1) {
  const { THREE } = ctx;
  const size = Math.max(16, Math.ceil(Math.sqrt(count)));
  const ext = [0, 1, 2].map((k) => box.max[k] - box.min[k]);
  const diag = Math.hypot(...ext);
  const pad = diag * 0.03;
  const lo = box.min.map((v) => v - pad);
  const hi = box.max.map((v) => v + pad);
  const band = diag * 0.012;
  const head = `precision highp float;\nprecision highp int;\n${glsl}\n${HASH}`;

  const first = pass(
    ctx,
    size,
    `${head}
uniform vec3 uMin;
uniform vec3 uMax;
uniform float uBand;
uniform float uSeed;
void main() {
  uvec3 s = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(uSeed));
  vec3 p = vec3(0.0);
  float ok = 0.0;
  for (int i = 0; i < 56; i++) {
    s = pcg3d(s ^ uvec3(uint(i) * 747796405u));
    vec3 q = mix(uMin, uMax, vec3(s) / 4294967295.0);
    if (abs(sdf(q)) < uBand) {
      p = q;
      ok = 1.0;
      break;
    }
  }
  if (ok > 0.5) {
    for (int k = 0; k < 4; k++) p -= sdfNormal(p, uBand * 0.08) * sdf(p);
    if (abs(sdf(p)) > uBand * 0.25) ok = 0.0;
  }
  gl_FragColor = vec4(p, ok);
}`,
    { uMin: { value: new THREE.Vector3(...lo) }, uMax: { value: new THREE.Vector3(...hi) }, uBand: { value: band }, uSeed: { value: seed % 65536 } }
  );

  const second = pass(
    ctx,
    size,
    `${head}
uniform sampler2D uPos;
uniform float uEps;
uniform float uReach;
void main() {
  vec4 P = texelFetch(uPos, ivec2(gl_FragCoord.xy), 0);
  if (P.w < 0.5) { gl_FragColor = vec4(0.0); return; }
  float id;
  sdfId(P.xyz, id);
  vec3 n = sdfNormal(P.xyz, uEps);
  float occ = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = uReach * float(i) / 5.0;
    occ += w * max(0.0, h - sdf(P.xyz + n * h));
    w *= 0.7;
  }
  float ao = clamp(1.0 - occ * 2.2 / uReach, 0.0, 1.0);
  gl_FragColor = vec4(n * (0.5 + ao * 0.49), id);
}`,
    { uPos: { value: first.target.texture }, uEps: { value: band * 0.1 }, uReach: { value: diag * 0.06 } }
  );

  const total = size * size;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const part = new Float32Array(total);
  const ao = new Float32Array(total);
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (first.data[i * 4 + 3] < 0.5) continue;
    pos[n * 3] = first.data[i * 4];
    pos[n * 3 + 1] = first.data[i * 4 + 1];
    pos[n * 3 + 2] = first.data[i * 4 + 2];
    const nx = second.data[i * 4];
    const ny = second.data[i * 4 + 1];
    const nz = second.data[i * 4 + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm[n * 3] = nx / l;
    nrm[n * 3 + 1] = ny / l;
    nrm[n * 3 + 2] = nz / l;
    ao[n] = Math.min(1, Math.max(0, (l - 0.5) / 0.49));
    part[n] = second.data[i * 4 + 3];
    n++;
  }
  first.done();
  second.done();
  return { n, pos: pos.subarray(0, n * 3), nrm: nrm.subarray(0, n * 3), part: part.subarray(0, n), ao: ao.subarray(0, n), diag };
}

export function sampleSlices(ctx, glsl, frames, grid) {
  const { THREE } = ctx;
  const groups = Math.ceil(frames.length / 4);
  const per = Math.ceil(Math.sqrt(groups));
  const size = per * grid;
  const data = new Float32Array(Math.max(1, groups) * 4 * 12);
  frames.forEach((fr, i) => {
    const g = Math.floor(i / 4);
    const c = i % 4;
    data.set([...fr.o, fr.ext, ...fr.u, 0, ...fr.v, 0], (g * 4 + c) * 12);
  });
  const tex = new THREE.DataTexture(data, 12 / 4, groups * 4, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const out = pass(
    ctx,
    size,
    `precision highp float;\n${glsl}
uniform sampler2D uFrames;
uniform float uGrid;
uniform float uPer;
uniform float uGroups;
float at(int row, vec2 cell) {
  vec4 a = texelFetch(uFrames, ivec2(0, row), 0);
  vec4 u = texelFetch(uFrames, ivec2(1, row), 0);
  vec4 v = texelFetch(uFrames, ivec2(2, row), 0);
  vec2 k = (cell / (uGrid - 1.0) - 0.5) * a.w;
  return sdf(a.xyz + u.xyz * k.x + v.xyz * k.y);
}
void main() {
  vec2 px = floor(gl_FragCoord.xy);
  vec2 tile = floor(px / uGrid);
  vec2 cell = px - tile * uGrid;
  float g = tile.y * uPer + tile.x;
  if (g >= uGroups) { gl_FragColor = vec4(1.0); return; }
  int base = int(g) * 4;
  gl_FragColor = vec4(at(base, cell), at(base + 1, cell), at(base + 2, cell), at(base + 3, cell));
}`,
    { uFrames: { value: tex }, uGrid: { value: grid }, uPer: { value: per }, uGroups: { value: groups } }
  );
  const fields = frames.map((_, i) => {
    const g = Math.floor(i / 4);
    const c = i % 4;
    const tx = g % per;
    const ty = Math.floor(g / per);
    const field = new Float32Array(grid * grid);
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) field[y * grid + x] = out.data[((ty * grid + y) * size + tx * grid + x) * 4 + c];
    return field;
  });
  out.done();
  tex.dispose();
  return fields;
}
