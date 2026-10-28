const VERTEX = `#version 300 es
layout(location = 0) in vec2 p;
out vec2 v_uv;
void main() {
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export function context(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
  if (!gl) throw new Error("This browser can't run WebGL2");
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("This browser can't render to float textures");
  gl.getExtension("OES_texture_float_linear");
  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return gl;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    const lines = source.split("\n").map((l, i) => `${i + 1}: ${l}`);
    const at = Number(log.match(/0:(\d+)/)?.[1] || 0);
    throw new Error(`${log}\n${lines.slice(Math.max(0, at - 4), at + 2).join("\n")}`);
  }
  return shader;
}

export function program(gl, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

export function texture(gl, w, h, filter = gl.LINEAR, bytes = false) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (bytes) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function target(gl, w, h, count = 1, bytes = false) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const textures = Array.from({ length: count }, (_, i) => {
    const t = texture(gl, w, h, gl.LINEAR, bytes);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
    return t;
  });
  gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, textures, w, h };
}

export function run(gl, prog, uniforms, out, rect) {
  gl.useProgram(prog);
  let unit = 0;
  for (const [name, value] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(prog, name);
    if (loc === null) continue;
    if (value instanceof WebGLTexture || value?.volume) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(value.volume ? gl.TEXTURE_3D : gl.TEXTURE_2D, value.volume || value);
      gl.uniform1i(loc, unit++);
    } else if (typeof value === "number") gl.uniform1f(loc, value);
    else if (value.length === 2) gl.uniform2fv(loc, value);
    else if (value.length === 3) gl.uniform3fv(loc, value);
    else if (value.length === 4) gl.uniform4fv(loc, value);
    else if (value.length === 9) gl.uniformMatrix3fv(loc, false, value);
    else gl.uniform3fv(loc, value);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
  const w = out ? out.w : gl.drawingBufferWidth;
  const h = out ? out.h : gl.drawingBufferHeight;
  gl.viewport(0, 0, w, h);
  if (rect) {
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(...rect);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.disable(gl.SCISSOR_TEST);
}

export function upload(gl, w, h, data) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, w, h, 0, gl.RG, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
