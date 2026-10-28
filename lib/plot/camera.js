import { cross, dot, norm, sub } from "./math.js";

export function camera({ eye, look, fov, roll = 0 }, width, height) {
  const fwd = norm(sub(look, eye));
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  if (roll) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    [right, up] = [right.map((v, i) => v * c + up[i] * s), up.map((v, i) => v * c - right[i] * s)];
  }
  const lens = 2 * Math.tan((fov * Math.PI) / 360);
  const project = (p) => {
    const d = sub(p, eye);
    const z = dot(d, fwd);
    const x = dot(d, right) / z / lens;
    const y = dot(d, up) / z / lens;
    return [width / 2 + x * height, height / 2 - y * height, z];
  };
  const ray = (px, py) => {
    const x = ((px - width / 2) / height) * lens;
    const y = ((height / 2 - py) / height) * lens;
    return norm([right[0] * x + up[0] * y + fwd[0], right[1] * x + up[1] * y + fwd[1], right[2] * x + up[2] * y + fwd[2]]);
  };
  return { eye, look, fov, fwd, right, up, lens, width, height, project, ray, matrix: [...right, ...up, ...fwd] };
}
