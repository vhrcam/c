import { landscape, shape, stageRadius, sun, water } from "./scenery";
import { storm } from "./storm";
import { dress, islet } from "./dressing";
import { growTree, trees } from "./trees";
import { random } from "../../random";
import { natural, nature, planFields } from "./nature";
import { edgeSystem, surfaceSystem } from "./surface";
import { layout } from "./layout";
import { lighting } from "./lights";
import { ocean } from "./ocean";
import { seed } from "./seed";
import { sky } from "./sky";
import { buildForm, subjectSystems } from "./subject";

function camera(ctx, scene, placed) {
  const { THREE, plan } = ctx;
  const { view } = plan;
  const up = new THREE.Vector3(0, 1, 0);
  const center = plan.world.setting === "space" ? new THREE.Vector3(scene.cx, scene.cy, scene.cz) : new THREE.Vector3(scene.cx, scene.height * 0.45, scene.cz);
  const fov = view.kind === "first-person" ? 58 : view.kind === "wide" ? 46 : 34;
  const fit = (scene.radius / Math.sin((fov * Math.PI) / 360)) * 1.0;
  let az = ((52 + ((plan.seed % 997) / 997 - 0.5) * 56) * Math.PI) / 180;
  let elev = 0.3;
  let dist = fit;
  let target = center.clone();
  if (ctx.flat && placed.length === 1 && plan.world.setting === "void") dist = fit * 0.68;
  const staged = scene.stage && plan.world.setting !== "void" && plan.world.setting !== "space";
  if (staged) {
    dist = (scene.stage / Math.sin((fov * Math.PI) / 360)) * 1.0;
    elev = 0.38;
    target = new THREE.Vector3(scene.cx, Math.min(scene.height * 0.45, scene.stage * 0.22), scene.cz);
  }
  const hero = placed[0];
  let heroFrame = false;
  if (!staged && hero && placed.length > 1 && view.kind !== "aerial" && view.kind !== "wide") {
    const hb = hero.form.box;
    const heroR = Math.max(0.1, Math.hypot(...hb.max.map((v, i) => (v - hb.min[i]) / 2)));
    if (scene.radius > heroR * 3) {
      target = new THREE.Vector3(...hb.min.map((v, i) => (v + hb.max[i]) / 2)).applyMatrix4(hero.matrix);
      dist = (heroR / Math.sin((fov * Math.PI) / 360)) * 2.1;
      elev = Math.min(elev, 0.12);
      heroFrame = true;
    }
  }
  if (view.kind === "close") dist = staged ? dist * 0.78 : heroFrame ? dist * 0.85 : fit * (ctx.flat ? 1.02 : 0.82);
  else if (view.kind === "wide") dist = fit * 2.1;
  else if (view.kind === "low") elev = -0.04;
  else if (view.kind === "aerial") elev = 1.3;
  if (["golden", "dusk", "dawn"].includes(plan.world.time) && view.kind !== "aerial" && plan.world.setting !== "space") elev = Math.min(elev, staged ? 0.3 : 0.15);
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
  const foggy = plan.world.weather === "fog";
  return {
    fov,
    maxPolar: staged && !from ? Math.PI * 0.46 : Math.PI,
    fog: foggy ? [dist * 0.35, dist * 2.6] : from ? [dist * 0.8, dist * 9] : [dist * 0.9, dist * 5],
    zoom: staged && !from ? [scene.stage * 0.35, dist * 2.2] : [scene.radius * 0.15, Math.max(dist * 4, scene.reach * 1.2)],
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
  scene.stage = stageRadius(scene);
  scene.reach = scene.stage;
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
  let fields = null;
  if (setting !== "void" && setting !== "space") {
    terrainShape = shape(ctx, scene);
    const urban = setting === "city" || /\b(city|downtown|street|urban|skyline)\b/i.test(plan.text) || placed.some((p) => p.form.extra?.style === "skyscraper");
    fields = natural(plan, urban) && !terrainShape.open ? planFields(ctx, scene, placed) : null;
    if (!terrainShape.open) systems.push(landscape(ctx, scene, terrainShape, fields?.tint));
    if (terrainShape.coast) systems.push(water(ctx, scene, terrainShape.R));
    if (setting === "ocean") systems.push(ocean(ctx, scene, new THREE.Vector3(scene.cx, 0, scene.cz)));
    const energy = plan.world.weather === "storm" ? 1 : Math.max(0.15, plan.world.energy);
    for (const p of placed) {
      const style = p.form.extra?.style;
      if (!["galleon", "boat", "sailboat"].includes(style)) continue;
      if (terrainShape.height(p.spot.x, p.spot.z) > 0) continue;
      const draft = style === "galleon" ? 1.7 : 0.55;
      const amp = 0.025 + energy * 0.05;
      p.group.position.y = -draft;
      systems.push({
        update: (T) => {
          p.group.rotation.z = Math.sin(T * 0.7) * amp;
          p.group.rotation.x = Math.sin(T * 0.53 + 1.3) * amp * 0.6;
          p.group.position.y = -draft + Math.sin(T * 0.9) * 0.3 * energy;
        },
      });
    }
    if (plan.world.weather !== "fog") rig.fog[1] = Math.max(rig.fog[1], terrainShape.R * 0.9);
  }
  if (fields) systems.push(...nature(ctx, scene, terrainShape, placed, fields));
  const dressing = fields ? null : dress(ctx, scene, placed, terrainShape);
  if (dressing?.geometry) {
    systems.push(surfaceSystem(ctx, dressing.geometry, { window: [ctx.W.structure[0] + 1.2, ctx.W.form[0] + 2.5], grain: 300 / Math.max(1, scene.stage), texture: 0.16 }));
    if (dressing.urban) systems.push(edgeSystem(ctx, dressing.geometry, { alpha: ctx.pal.dark ? 0.32 : 0.4, angle: 40, center: [scene.cx, scene.cz], reach: scene.stage, spread: 3.2 }));
  }
  if (dressing?.trees.length) {
    const rand = random((plan.seed ^ 0x4b1d) >>> 0);
    const list = dressing.trees.map((t) => ({ rand, x: t.x, z: t.z, y: t.y || 0, scale: 1, delay: t.delay || 0, tree: growTree(rand, t.conifer ? "conifer" : "broad", t.h) }));
    systems.push(trees(ctx, list, { leafSize: 0.3 * Math.max(0.6, Math.min(2, scene.height / 9)), dense: 2, window: [ctx.W.form[0] + 0.5, ctx.W.detail[1] - 1] }));
  }
  if (terrainShape?.coast) {
    const rock = islet(ctx, scene, placed, terrainShape);
    if (rock) systems.push(surfaceSystem(ctx, rock, { window: [ctx.W.structure[0] + 0.6, ctx.W.form[0] + 1.5], grain: 200 / Math.max(1, scene.stage), texture: 0.3 }));
  }
  if (setting !== "void" || ctx.pal.night) systems.push(sky(ctx, scene));
  systems.push(lighting(ctx, scene, placed));
  const disc = sun(ctx, scene);
  if (disc) systems.push(disc);
  if (plan.world.weather === "storm" && setting !== "space" && setting !== "void") systems.push(storm(ctx, scene));
  systems.unshift(seed(ctx, focus, scene.radius));
  return { systems, rig, focus };
}
