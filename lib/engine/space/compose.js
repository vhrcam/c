import { ground } from "./ground";
import { layout } from "./layout";
import { lighting } from "./lights";
import { seed } from "./seed";
import { sky } from "./sky";
import { buildForm, subjectSystems } from "./subject";
import { weather } from "./weather";

function camera(ctx, scene, placed) {
  const { THREE, plan } = ctx;
  const { view } = plan;
  const up = new THREE.Vector3(0, 1, 0);
  const center = new THREE.Vector3(scene.cx, scene.height * 0.45, scene.cz);
  const fov = view.kind === "wide" || view.kind === "first-person" ? 46 : 34;
  const fit = (scene.radius / Math.sin((fov * Math.PI) / 360)) * 1.0;
  let az = (52 * Math.PI) / 180;
  let elev = 0.3;
  let dist = fit;
  let target = center.clone();
  if (view.kind === "close") dist = fit * 0.82;
  else if (view.kind === "wide") dist = fit * 2.1;
  else if (view.kind === "low") elev = -0.04;
  else if (view.kind === "aerial") elev = 1.3;
  if (placed.some((p) => p.subject.form === "human") && view.kind !== "aerial") elev = Math.min(elev, 0.16);
  const dir = new THREE.Vector3(Math.cos(az), elev, Math.sin(az)).normalize();
  let pos = target.clone().addScaledVector(dir, dist);
  if (view.kind === "low") pos.y = Math.max(0.25, scene.height * 0.12);

  const from = view.kind === "first-person" ? placed.find((p) => p.subject.id === view.from) : null;
  if (from) {
    const b = from.form.box;
    const h = b.max[1];
    const towards = placed.find((p) => p.subject.id === view.at);
    const out = towards ? new THREE.Vector3().setFromMatrixPosition(towards.matrix).sub(new THREE.Vector3().setFromMatrixPosition(from.matrix)).setY(0) : new THREE.Vector3(1, 0, 0.35);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0.35);
    out.normalize();
    const base = new THREE.Vector3().setFromMatrixPosition(from.matrix);
    const reach = Math.max(Math.abs(b.max[0]), Math.abs(b.max[2]), Math.abs(b.min[0]), Math.abs(b.min[2]));
    pos = base.clone().addScaledVector(out, reach * 0.95).add(new THREE.Vector3(0, h * 0.82, 0));
    if (view.look === "down") target = base.clone().addScaledVector(out, h * 0.75).setY(0);
    else if (view.look === "up") target = pos.clone().add(new THREE.Vector3(0, h, 0)).addScaledVector(out, h * 0.3);
    else target = pos.clone().addScaledVector(out, h * 3).setY(h * 0.35);
    dist = pos.distanceTo(target);
    az = Math.atan2(pos.z - target.z, pos.x - target.x);
  }
  const offset = pos.clone().sub(target);
  const start = target.clone().add(offset.clone().applyAxisAngle(up, from ? 0.25 : 0.55).multiplyScalar(from ? 1.08 : 1.2)).add(new THREE.Vector3(0, scene.radius * (from ? 0.1 : 0.4), 0));
  return {
    fov,
    fog: from ? [dist * 0.8, dist * 9] : [dist * 0.9, dist * 5],
    zoom: [scene.radius * 0.15, Math.max(dist * 4, scene.reach * 1.2)],
    swing: from ? -0.15 : -0.45,
    drift: from ? 0.008 : 0.022,
    start: { pos: start, target: target.clone() },
    end: { pos, target },
    dir: offset.clone().normalize(),
  };
}

export function compose(ctx) {
  const { THREE, plan } = ctx;
  const forms = plan.subjects.map((s, i) => buildForm(ctx, s, i));
  const spots = layout(plan, forms);
  const systems = [];
  const placed = forms.map((form, i) => {
    const spot = spots[i];
    const group = new THREE.Group();
    group.position.set(spot.x, spot.y, spot.z);
    group.rotation.y = spot.yaw;
    group.updateMatrixWorld(true);
    const language = plan.systems.find((s) => s.subject === form.subject.id)?.language || "swarm";
    const built = subjectSystems(ctx, form, language);
    for (const s of built.systems) group.add(s.object);
    systems.push({ object: group, update: (T, dt, cam) => built.systems.forEach((s) => s.update?.(T, dt, cam)) });
    return { form, group, subject: form.subject, prims: form.prims, box: form.box, matrix: group.matrixWorld.clone() };
  });

  const box = new THREE.Box3();
  for (const p of placed) box.union(new THREE.Box3(new THREE.Vector3(...p.form.box.min), new THREE.Vector3(...p.form.box.max)).applyMatrix4(p.matrix));
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const scene = {
    cx: sphere.center.x,
    cz: sphere.center.z,
    radius: Math.max(0.15, sphere.radius),
    height: Math.max(0.1, box.max.y),
    reach: Math.max(sphere.radius * 9, 16),
    sky: 1500,
  };
  const hero = placed[0];
  const focus = hero ? new THREE.Vector3(...hero.form.heart).applyMatrix4(hero.matrix) : sphere.center.clone();
  const rig = camera(ctx, scene, placed);
  scene.view = rig.dir;

  const setting = plan.world.setting;
  if (setting !== "void" && setting !== "space") systems.push(ground(ctx, scene));
  if (setting !== "void" || ctx.pal.night) systems.push(sky(ctx, scene));
  systems.push(lighting(ctx, scene, placed));
  if (setting !== "void" || plan.particles.length) systems.push(weather(ctx, scene));
  systems.unshift(seed(ctx, focus, scene.radius));
  return { systems, rig, focus };
}
