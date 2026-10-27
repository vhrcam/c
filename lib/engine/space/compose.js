import { seed } from "./seed";

export function compose(ctx) {
  const { THREE } = ctx;
  const focus = new THREE.Vector3(0, 0.6, 0);
  const systems = [seed(ctx, focus, 1)];
  const rig = {
    fov: 38,
    fog: [6, 40],
    zoom: [0.4, 60],
    swing: -0.6,
    drift: 0.02,
    start: { pos: new THREE.Vector3(5, 3.2, 7), target: focus.clone() },
    end: { pos: new THREE.Vector3(2.6, 1.3, 3.6), target: focus.clone() },
  };
  return { systems, rig, focus };
}
