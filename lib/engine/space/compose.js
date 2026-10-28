import { landscape, shape, sun, water } from "./scenery";
import { layout } from "./layout";
import { lighting } from "./lights";
import { ocean } from "./ocean";
import { seed } from "./seed";
import { sky } from "./sky";
import { buildForm, subjectSystems } from "./subject";
import { forest, trees } from "./trees";
import { weather } from "./weather";
import { random } from "../../random";

function camera(ctx, scene, placed) {
  const { THREE, plan } = ctx;
  const { view } = plan;
  const up = new THREE.Vector3(0, 1, 0);
  const center = plan.world.setting === "space" ? new THREE.Vector3(scene.cx, scene.cy, scene.cz) : new THREE.Vector3(scene.cx, scene.height * 0.45, scene.cz);
  const fov = view.kind === "first-person" ? 58 : view.kind === "wide" ? 46 : 34;
  const fit = (scene.radius / Math.sin((fov * Math.PI) / 360)) * 1.0;
  let az = (52 * Math.PI) / 180;
  let elev = 0.3;
  let dist = fit;
  let target = center.clone();
  if (ctx.flat && placed.length === 1 && plan.world.setting === "void") dist = fit * 0.68;
  const hero = placed[0];
  let heroFrame = false;
  if (hero && placed.length > 1 && view.kind !== "aerial" && view.kind !== "wide") {
    const hb = hero.form.box;
    const heroR = Math.max(0.1, Math.hypot(...hb.max.map((v, i) => (v - hb.min[i]) / 2)));
    if (scene.radius > heroR * 3) {
      target = new THREE.Vector3(...hb.min.map((v, i) => (v + hb.max[i]) / 2)).applyMatrix4(hero.matrix);
      dist = (heroR / Math.sin((fov * Math.PI) / 360)) * 2.1;
      elev = Math.min(elev, 0.12);
      heroFrame = true;
    }
  }
  if (view.kind === "close") dist = heroFrame ? dist * 0.85 : fit * (ctx.flat ? 1.02 : 0.82);
  else if (view.kind === "wide") dist = fit * 2.1;
  else if (view.kind === "low") elev = -0.04;
  else if (view.kind === "aerial") elev = 1.3;
  if (["golden", "dusk", "dawn"].includes(plan.world.time) && view.kind !== "aerial" && plan.world.setting !== "space") elev = Math.min(elev, 0.15);
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
    pos = base.clone().addScaledVector(out, -reach * 0.35).add(new THREE.Vector3(0, h * 1.04, 0));
    if (view.look === "down") target = base.clone().addScaledVector(out, h * 1.35).setY(0);
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

export function arrange(ctx, build) {
  const { THREE, plan } = ctx;
  const built = plan.subjects.map((s, i) => [s, buildForm(ctx, s, i)]).filter(([, f]) => f);
  const forms = built.map(([, f]) => f);
  const spots = layout({ ...plan, subjects: built.map(([s]) => s) }, forms);
  const systems = [];
  const placed = forms.map((form, i) => {
    const spot = spots[i];
    const group = new THREE.Group();
    group.position.set(spot.x, spot.y, spot.z);
    group.rotation.y = spot.yaw;
    group.updateMatrixWorld(true);
    if (build) {
      const language = plan.systems.find((s) => s.subject === form.subject.id)?.language || "swarm";
      const built = subjectSystems(ctx, form, language);
      for (const s of built.systems) group.add(s.object);
      systems.push({ object: group, update: (T, dt, cam) => built.systems.forEach((s) => s.update?.(T, dt, cam)) });
    }
    return { form, group, spot, subject: form.subject, prims: form.prims, box: form.box, matrix: group.matrixWorld.clone() };
  });

  const box = new THREE.Box3();
  for (const p of placed) box.union(new THREE.Box3(new THREE.Vector3(...p.form.box.min), new THREE.Vector3(...p.form.box.max)).applyMatrix4(p.matrix));
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const scene = {
    cx: sphere.center.x,
    cy: sphere.center.y,
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
  scene.camDist = rig.end.pos.distanceTo(rig.end.target);
  return { systems, placed, scene, rig, focus };
}

export function compose(ctx) {
  const { THREE, plan } = ctx;
  const { systems, placed, scene, rig, focus } = arrange(ctx, true);

  const setting = plan.world.setting;
  let terrainShape = null;
  if (setting !== "void" && setting !== "space") {
    terrainShape = shape(ctx, scene);
    systems.push(landscape(ctx, scene, terrainShape));
    if (terrainShape.coast) systems.push(water(ctx, scene, terrainShape.R));
    if (setting === "ocean") systems.push(ocean(ctx, scene, new THREE.Vector3(scene.cx, 0, scene.cz)));
    rig.fog[1] = Math.max(rig.fog[1], terrainShape.R * 0.9);
  }
  if (setting === "forest" || setting === "snowfield" || setting === "meadow") {
    const list = forest(ctx, scene, random((plan.seed ^ 0x1b873593) >>> 0));
    if (setting !== "forest") list.splice(setting === "meadow" ? 5 : 9);
    systems.push(trees(ctx, list, { leafSize: 0.08 }));
  }
  if (setting !== "void" || ctx.pal.night) systems.push(sky(ctx, scene));
  systems.push(lighting(ctx, scene, placed));
  const disc = sun(ctx, scene);
  if (disc) systems.push(disc);
  if (setting !== "void" || plan.particles.length) systems.push(weather(ctx, scene));
  systems.unshift(seed(ctx, focus, scene.radius));
  return { systems, rig, focus };
}
