import { hash, random } from "../random";
import { camera } from "../plot/camera.js";
import { frameShot, pensFor } from "../plot/compose.js";
import { fields } from "../plot/fields.js";
import { gbuffer } from "../plot/gbuffer.js";
import { add, mul, norm, sub } from "../plot/math.js";
import { PALETTES as FIGURE_PALETTES } from "../plot/palettes.js";
import { horizonOf } from "../plot/world.js";
import { people } from "./people";

export async function stage(seed, { shot, pose = "embrace", count = 2, subjects = [], setting = {}, width = 1500, height = 1000, ss = 1.5, place } = {}) {
  const rng = random(seed);
  const scene = people(seed, pose, count, subjects, setting);
  const figPal = rng.pick(FIGURE_PALETTES.filter((p) => p.time !== "night"));
  const { view, shot: framed } = frameShot(scene, rng, width, height, shot);
  const cam = camera(view, width, height);
  const [kx, ky] = cam.project(scene.kiss);
  const below = cam.project(sub(scene.kiss, [0, 1, 0]));
  const ppm = Math.hypot(below[0] - kx, below[1] - ky);
  const T = place ? place({ kx, ky, ppm, kiss: scene.kiss }) : { k: 1, tx: 0, ty: 0, light: [kx, ky - height * 0.05] };
  const light = [(T.light[0] - T.tx) / T.k, (T.light[1] - T.ty) / T.k];
  const keyDir = norm(add(add(mul(cam.fwd, -0.9), mul(cam.right, light[0] < kx ? -0.7 : 0.7)), [0, 0.8, 0]));
  const W = Math.round(width * ss);
  const H = Math.round(height * ss);
  const g = await gbuffer({ nodes: scene.nodes, cam: camera(view, W, H), W, H, key: keyDir, sun: cam.ray(light[0], light[1]), hills: [0, 0.03, 0, 0], bound: [scene.kiss[0], 0.95, 0, 1.6] });
  const F = fields(g, ss);
  const base = pensFor(figPal, rng);
  const deepenTo = (hex, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;
  const deepen = (hex) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55).toString(16).padStart(2, "0")).join("")}`;
  const SKIN = ["#f2d6c3", "#e9bd9c", "#d29c76", "#b07a55", "#8a5a3c", "#64402a", "#4a2e1f"];
  const tones = [0, 1].map((i) => {
    const said = `${subjects[i]?.appearance || ""}`.toLowerCase();
    const k = /\b(dark|black|brown)[- ]skin/.test(said) ? 5 : /\b(pale|fair|light)[- ]skin/.test(said) ? 0 : /\b(tan|olive)/.test(said) ? 3 : Math.floor(random((seed ^ (0x5a17 + i * 131)) >>> 0)() * SKIN.length);
    return [SKIN[k], deepenTo(SKIN[k], 0.72)];
  });
  const pens = {
    ...base,
    fill: (mat, person) => {
      const who = subjects[(person || 1) - 1];
      if (mat === 1) return tones[((person || 1) - 1) % 2];
      if (who?.hairColor && (mat === 2 || mat === 3)) return [who.hairColor, deepen(who.hairColor)];
      if (who?.clothColor && (mat === 4 || mat === 6 || mat === 9)) return [who.clothColor, deepen(who.clothColor)];
      return base.fill(mat, person);
    },
  };
  return { rng, scene, figPal, pens, cam, F, kx, ky, light, horizon: horizonOf(cam), width, height, shot: framed, T, person: (x, y) => F.codeAt(x, y) >> 4, mat: (x, y) => F.codeAt(x, y) & 15 };
}

export async function figure(plan, comp, world, seed) {
  if (!plan.people.count || comp.framing === "none") return null;
  const pose = plan.people.pose;
  const top = pose === "sit" ? 1.02 : pose === "run" ? 1.62 : 1.78;
  const ppmT = comp.body / top;
  const visible = (comp.feet - 1000) / ppmT;
  const shot = visible > 0.95 ? "close" : visible > 0.56 ? "medium" : "wide";
  const sun = world.lights[0] ? [world.lights[0].x, world.lights[0].y] : [comp.lightX, comp.horizon - 200];
  // the memory feeds the cast too, so two memories on one seed never share the same people
  const st = await stage((seed ^ hash(String(plan.text || ""))) >>> 0, {
    shot,
    pose,
    count: plan.people.count,
    subjects: plan.people.subjects,
    // a smile, a laugh or a look at "me" turns them toward us
    setting: { ...plan.setting, faceUs: !plan.people.toward && /\b(at me|to me|toward me|towards me|smil\w*|laugh\w*|grin\w*|goodbye)\b/.test(String(plan.text || "").toLowerCase()) },
    place: ({ kx, ky, ppm, kiss }) => {
      const k = ppmT / ppm;
      return { k, tx: comp.focusX - kx * k, ty: comp.feet - kiss[1] * ppmT - ky * k, light: sun };
    },
  });
  const { F, T } = st;
  const u = (x) => (x - T.tx) / T.k;
  const v = (y) => (y - T.ty) / T.k;
  const ok = (a, b) => a >= 0 && b >= 0 && a < F.w - 1 && b < F.h - 1;
  const at = (fn, d = 0) => (x, y) => {
    const a = u(x);
    const b = v(y);
    return ok(a, b) ? fn(a, b) : d;
  };
  const code = at(F.codeAt, 0);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < F.h; y += 3)
    for (let x = 0; x < F.w; x += 3)
      if (F.codeAt(x, y) >= 16) {
        box[0] = Math.min(box[0], x * T.k + T.tx);
        box[1] = Math.min(box[1], y * T.k + T.ty);
        box[2] = Math.max(box[2], x * T.k + T.tx);
        box[3] = Math.max(box[3], y * T.k + T.ty);
      }
  return {
    st,
    k: T.k,
    box,
    focus: [comp.focusX, comp.feet - st.scene.kiss[1] * ppmT],
    inside: (x, y) => code(x, y) >= 16,
    code,
    mat: (x, y) => code(x, y) & 15,
    person: (x, y) => code(x, y) >> 4,
    light: at(F.light),
    ao: at(F.ao, 1),
    rim: at(F.rim),
    along: (x, y, out) => {
      const a = u(x);
      const b = v(y);
      if (ok(a, b)) return F.along(a, b, out);
      out[0] = 1;
      out[1] = 0;
      return out;
    },
    fill: st.pens.fill,
    map: (pts) => pts.map((p, i) => (i % 2 ? p * T.k + T.ty : p * T.k + T.tx)),
  };
}
