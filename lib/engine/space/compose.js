import { seed } from "./seed";
import { buildForm, subjectSystems } from "./subject";

export function compose(ctx) {
  const { THREE, plan } = ctx;
  const systems = [];
  const placed = [];
  plan.subjects.forEach((subject, i) => {
    const form = buildForm(ctx, subject, i);
    const language = plan.systems.find((s) => s.subject === subject.id)?.language || "swarm";
    const built = subjectSystems(ctx, form, language);
    const group = new THREE.Group();
    for (const s of built.systems) group.add(s.object);
    systems.push({ object: group, update: (T, dt) => built.systems.forEach((s) => s.update?.(T, dt)) });
    placed.push({ form, group });
  });

  const box = new THREE.Box3();
  for (const p of placed) box.union(new THREE.Box3(new THREE.Vector3(...p.form.box.min), new THREE.Vector3(...p.form.box.max)).applyMatrix4(p.group.matrixWorld));
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const hero = placed[0];
  const focus = hero ? new THREE.Vector3(...hero.form.heart) : sphere.center.clone();
  systems.unshift(seed(ctx, focus, sphere.radius));

  const fov = 34;
  const dist = (sphere.radius / Math.sin((fov * Math.PI) / 360)) * 0.98;
  const az = (52 * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.cos(az), 0.32, Math.sin(az)).normalize();
  const target = sphere.center.clone();
  const end = target.clone().addScaledVector(dir, dist);
  const start = target.clone().addScaledVector(dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5), dist * 1.18).add(new THREE.Vector3(0, sphere.radius * 0.45, 0));
  const rig = {
    fov,
    fog: [dist * 0.9, dist * 4],
    zoom: [sphere.radius * 0.25, dist * 6],
    swing: -0.5,
    drift: 0.025,
    start: { pos: start, target: focus.clone() },
    end: { pos: end, target },
  };
  return { systems, rig, focus };
}
