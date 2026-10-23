import { mix, rgba } from "../color.js";
import { box, curve, mask, sprite } from "./brush.js";

const SKINS = ["#f2d4be", "#e3b597", "#c99069", "#a66a4a", "#7c4b33", "#5b3727"];
const HAIRS = ["#1d1714", "#3a291e", "#5e412c", "#8a6040", "#c7a066", "#7a3a22"];
const TOPS = ["#b5352d", "#25375c", "#e8dbbd", "#2e8584", "#c8a13f", "#f1eee6", "#4170ad", "#e290ab", "#6c4b98"];
const BOTTOMS = ["#25375c", "#201e1c", "#6e4a2f", "#4b4f57", "#2f3440"];
const DRESSES = ["#b5352d", "#f1eee6", "#4170ad", "#e6c34a", "#e290ab", "#2e8584"];

const cap = (pts, w, c, dim = 0) => ({ k: "cap", pts, w, c, dim });
const poly = (pts, c, dim = 0) => ({ k: "poly", pts, c, dim });
const dot = (x, y, r, c, dim = 0) => ({ k: "dot", x, y, r, c, dim });

function headBack(f, hx, y) {
  const parts = [dot(hx, y, 0.066, "skin")];
  if (f.hairLength === "long") parts.push(poly([[hx - 0.072, y - 0.03], [hx, y - 0.078], [hx + 0.072, y - 0.03], [hx + 0.082, y + 0.07], [hx + 0.076, y + 0.2], [hx + 0.03, y + 0.225], [hx - 0.03, y + 0.225], [hx - 0.076, y + 0.2], [hx - 0.082, y + 0.07]], "hair"));
  else parts.push(dot(hx, y - 0.006, 0.07, "hair"));
  if (f.hairLength === "bun") parts.push(dot(hx, y - 0.08, 0.032, "hair"));
  return parts;
}

function headSide(f, y) {
  const parts = [dot(0.004, y, 0.064, "skin"), dot(0.064, y - 0.004, 0.013, "skin"), dot(0.036, y + 0.042, 0.022, "skin")];
  if (f.hairLength === "long") parts.push(poly([[-0.078, y - 0.02], [-0.03, y - 0.07], [0.035, y - 0.068], [0.066, y - 0.03], [0.02, y - 0.035], [-0.03, y + 0.02], [-0.045, y + 0.12], [-0.068, y + 0.215], [-0.1, y + 0.2], [-0.088, y + 0.08]], "hair"));
  else parts.push(poly([[-0.07, y + 0.035], [-0.074, y - 0.03], [-0.03, y - 0.072], [0.04, y - 0.066], [0.068, y - 0.03], [0.03, y - 0.026], [0, y], [-0.025, y + 0.045]], "hair"));
  if (f.hairLength === "bun") parts.push(dot(-0.07, y - 0.04, 0.032, "hair"));
  return parts;
}

function back(f, o = {}) {
  const hx = o.headX || 0;
  const leg = f.dress ? "skin" : "bottom";
  const armL = o.armL || [[-0.118, -0.785], [-0.142, -0.63], [-0.148, -0.47]];
  const armR = o.armR || [[0.118, -0.785], [0.142, -0.63], [0.148, -0.47]];
  const body = [
    cap([[-0.052, -0.5], [-0.055, -0.26], [-0.057, -0.03]], 0.07, leg),
    cap([[0.052, -0.5], [0.055, -0.26], [0.057, -0.03]], 0.07, leg),
    cap([[-0.057, -0.022], [-0.057, -0.004]], 0.056, "shoe"),
    cap([[0.057, -0.022], [0.057, -0.004]], 0.056, "shoe"),
    cap(armL, 0.05, "top"),
    cap(armR, 0.05, "top"),
    dot(...armL[2], 0.024, "skin"),
    dot(...armR[2], 0.024, "skin"),
    poly([[-0.108, -0.822], [0.108, -0.822], [0.128, -0.77], [0.094, -0.6], [0.1, -0.5], [-0.1, -0.5], [-0.094, -0.6], [-0.128, -0.77]], "top"),
    f.dress ? poly([[-0.09, -0.62], [0.09, -0.62], [0.17, -0.25], [0.11, -0.235], [0, -0.228], [-0.11, -0.235], [-0.17, -0.25]], "dress") : poly([[-0.096, -0.53], [0.096, -0.53], [0.1, -0.43], [-0.1, -0.43]], "bottom"),
    cap([[hx * 0.5, -0.862], [0, -0.8]], 0.046, "skin"),
    ...headBack(f, hx, -0.925),
  ];
  return { body, front: [], spine: [[hx, -0.925], [0, -0.8], [0, -0.5]] };
}

function side(f, o = {}) {
  const leg = f.dress ? "skin" : "bottom";
  const far = o.farLeg || [[-0.008, -0.5], [0.004, -0.26], [-0.006, -0.03]];
  const near = o.nearLeg || [[0.008, -0.5], [0.016, -0.26], [0.01, -0.03]];
  const arm = o.nearArm || [[0, -0.79], [0.02, -0.63], [0.03, -0.47]];
  const body = [
    cap(far, 0.06, leg, 1),
    cap([[far[2][0], -0.012], [far[2][0] + 0.048, -0.012]], 0.034, "shoe", 1),
    ...(o.farArm ? [cap(o.farArm, 0.04, "top", 1), dot(...o.farArm[2], 0.02, "skin", 1)] : []),
    cap(near, 0.064, leg),
    cap([[near[2][0], -0.012], [near[2][0] + 0.06, -0.012]], 0.036, "shoe"),
    poly([[-0.054, -0.818], [0.036, -0.818], [0.064, -0.745], [0.05, -0.62], [0.047, -0.5], [-0.06, -0.5], [-0.05, -0.6], [-0.064, -0.72]], "top"),
    f.dress ? poly([[-0.056, -0.62], [0.05, -0.62], [0.128, -0.25], [0.01, -0.232], [-0.118, -0.25]], "dress") : poly([[-0.06, -0.53], [0.05, -0.53], [0.052, -0.43], [-0.062, -0.43]], "bottom"),
    cap([[0.002, -0.866], [-0.006, -0.8]], 0.042, "skin"),
    ...headSide(f, -0.925),
  ];
  return { body, front: [cap(arm, 0.043, "top"), dot(...arm[2], 0.021, "skin")], spine: [[0.004, -0.925], [0, -0.8], [0, -0.5]] };
}

function seated(f, o = {}) {
  const hx = o.headX || 0;
  const armL = o.armL || [[-0.104, -0.37], [-0.13, -0.22], [-0.142, -0.06]];
  const armR = o.armR || [[0.104, -0.37], [0.13, -0.22], [0.142, -0.06]];
  const body = [
    poly([[-0.13, 0], [0.13, 0], [0.12, -0.1], [-0.12, -0.1]], f.dress ? "dress" : "bottom"),
    cap(armL, 0.044, "top"),
    dot(...armL[2], 0.022, "skin"),
    ...(o.hug ? [] : [cap(armR, 0.044, "top"), dot(...armR[2], 0.022, "skin")]),
    poly([[-0.1, -0.392], [0.1, -0.392], [0.114, -0.34], [0.09, -0.17], [0.11, -0.07], [-0.11, -0.07], [-0.09, -0.17], [-0.114, -0.34]], "top"),
    cap([[hx * 0.5, -0.436], [0, -0.375]], 0.046, "skin"),
    ...headBack(f, hx, o.headY || -0.5),
  ];
  return { body, front: o.hug ? [cap(o.hug, 0.044, "top"), dot(...o.hug[2], 0.022, "skin")] : [], spine: [[hx, -0.5], [0, -0.38], [0, -0.05]] };
}

const WALK = [
  { nearLeg: [[0.008, -0.5], [0.07, -0.27], [0.115, -0.03]], farLeg: [[-0.008, -0.5], [-0.045, -0.27], [-0.1, -0.045]], nearArm: [[0, -0.79], [-0.035, -0.64], [-0.075, -0.5]], farArm: [[0, -0.79], [0.04, -0.64], [0.085, -0.52]] },
  { nearLeg: [[0.008, -0.5], [-0.04, -0.27], [-0.095, -0.045]], farLeg: [[-0.008, -0.5], [0.06, -0.27], [0.11, -0.03]], nearArm: [[0, -0.79], [0.04, -0.64], [0.085, -0.52]], farArm: [[0, -0.79], [-0.03, -0.64], [-0.07, -0.5]] },
];

function arrange(kit) {
  const { scene, L } = kit;
  const fs = scene.people;
  const n = fs.length;
  const { x: cx, y, h } = L.stand;
  const at = (f, rig, dx, dir = 1, lean = 0, dy = 0) => ({ f, rig, x: cx + dx * h, y: y + dy * h, h: h * f.height, dir, lean });
  if (n === 1) {
    const [a] = fs;
    if (scene.pose === "sit") return [at(a, seated(a), 0)];
    if (scene.pose === "walk") return [at(a, side(a, WALK[0]), 0, L.side)];
    return [at(a, back(a), 0)];
  }
  if (n === 2) {
    const [a, b] = fs;
    if (scene.pose === "kiss") return [at(a, side(a, { nearArm: [[0, -0.79], [0.075, -0.665], [0.14, -0.6]] }), -0.104, 1, 0.045), at(b, side(b, { nearArm: [[0, -0.79], [0.06, -0.845], [0.112, -0.875]] }), 0.104, -1, 0.045)];
    if (scene.pose === "hug") return [at(a, side(a, { nearArm: [[0, -0.78], [0.09, -0.72], [0.17, -0.68]] }), -0.072, 1, 0.03), at(b, side(b, { nearArm: [[0, -0.76], [0.09, -0.7], [0.17, -0.66]] }), 0.072, -1, 0.03)];
    if (scene.pose === "sit") return [at(a, seated(a, { hug: [[0.104, -0.37], [0.17, -0.37], [0.23, -0.31]] }), -0.115), at(b, seated(b, { headX: -0.03, headY: -0.485 }), 0.115)];
    if (scene.pose === "walk") return [at(b, side(b, WALK[1]), 0.07 * L.side, L.side, 0, -0.012), at(a, side(a, WALK[0]), -0.05 * L.side, L.side)];
    if (scene.pose === "stand") return [at(a, back(a), -0.16), at(b, back(b), 0.16)];
    return [at(a, back(a, { armR: [[0.118, -0.785], [0.142, -0.64], [0.135, -0.5]], headX: 0.006 }), -0.135), at(b, back(b, { armL: [[-0.118, -0.785], [-0.142, -0.64], [-0.135, -0.5]], headX: -0.006 }), 0.135)];
  }
  const gap = 0.27;
  return fs.map((f, i) => {
    if (scene.pose === "sit") return at(f, seated(f), (i - (n - 1) / 2) * gap);
    const reach = (other) => {
      const low = -0.5 * Math.min(f.height, other.height);
      const k = gap / 2 / f.height;
      return [k, low / f.height];
    };
    const o = {};
    if (scene.pose === "hold" && i > 0) {
      const [k, yy] = reach(fs[i - 1]);
      o.armL = [[-0.118, -0.785], [-0.134, (yy - 0.79) / 2], [-k, yy]];
    }
    if (scene.pose === "hold" && i < n - 1) {
      const [k, yy] = reach(fs[i + 1]);
      o.armR = [[0.118, -0.785], [0.134, (yy - 0.79) / 2], [k, yy]];
    }
    return at(f, back(f, o), (i - (n - 1) / 2) * gap);
  });
}

function colorsFor(f, r) {
  const top = f.top || r.pick(f.dress ? DRESSES : TOPS);
  return { skin: f.skin || r.pick(SKINS), hair: f.hair || r.pick(HAIRS), top, dress: top, bottom: f.bottom || r.pick(BOTTOMS), shoe: "#2a2522" };
}

function place(fig) {
  const c = Math.cos(fig.lean);
  const s = Math.sin(fig.lean);
  return ([x, y]) => [fig.x + (x * c - y * s) * fig.h * fig.dir, fig.y + (x * s + y * c) * fig.h];
}

function draw(ctx, fig, parts, color, grow = 0) {
  const T = place(fig);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const part of parts) {
    const c = color(part);
    if (part.k === "cap") {
      ctx.strokeStyle = c;
      ctx.lineWidth = part.w * fig.h + grow * 2;
      ctx.beginPath();
      part.pts.map(T).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    } else if (part.k === "poly") {
      ctx.fillStyle = c;
      curve(ctx, part.pts.map(T));
      ctx.fill();
      if (grow) {
        ctx.strokeStyle = c;
        ctx.lineWidth = grow * 2;
        ctx.stroke();
      }
    } else {
      const [x, y] = T([part.x, part.y]);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, part.r * fig.h + grow, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const drawAll = (ctx, figs, color, grow) => {
  figs.forEach((f) => draw(ctx, f, f.rig.body, color(f), grow));
  figs.forEach((f) => draw(ctx, f, f.rig.front, color(f), grow));
};

export function people(kit) {
  const { scene, pal, L } = kit;
  if (!scene.people.length) return;
  const r = kit.rng("people");
  const figs = arrange(kit).map((fig) => ({ ...fig, colors: colorsFor(fig.f, r) }));
  const deps = kit.deps("people", "pose");
  const outlineColor = pal.mono ? "#24211e" : mix(pal.figure("#2a2420"), pal.shade, 0.3);
  const outlineAlpha = { oil: 0.35, watercolor: 0.7, ink: 0.9, storybook: 0.85, pixel: 0.9 }[scene.style];

  const lines = figs.flatMap((fig) => {
    const T = place(fig);
    const [hx, hy] = fig.rig.spine[0];
    const head = Array.from({ length: 11 }, (_, i) => [hx + Math.cos((i / 10) * Math.PI * 2) * 0.06, hy + Math.sin((i / 10) * Math.PI * 2) * 0.06]);
    return [head, fig.rig.spine, ...[...fig.rig.body, ...fig.rig.front].filter((p) => p.k === "cap" && p.pts.length > 2).map((p) => p.pts)].map((pts) => pts.map(T));
  });
  kit.sketch.push(...lines);

  const all = lines.flat();
  const area = box(all, L.stand.h * 0.22);
  const ground = figs.map((fig) => [fig.x, fig.y]);
  const shadow = (ctx) => {
    for (const [x, y] of ground) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, L.stand.h * 0.32);
      g.addColorStop(0, rgba(pal.shade, 0.45));
      g.addColorStop(1, rgba(pal.shade, 0));
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.16);
      ctx.translate(-x, -y);
      ctx.fillRect(x - L.stand.h * 0.4, y - L.stand.h * 0.4, L.stand.h * 0.8, L.stand.h * 0.8);
      ctx.restore();
    }
  };
  kit.add("shadow", "moment", deps, [sprite(area, shadow, mask.fade(), { blend: "multiply", d: 0.3 })], 0.3);

  const outline = (ctx) => {
    drawAll(ctx, figs, () => () => rgba(outlineColor, outlineAlpha), 2.2);
    ctx.globalCompositeOperation = "destination-out";
    drawAll(ctx, figs, () => () => "#000", 0);
    ctx.globalCompositeOperation = "source-over";
  };
  kit.add("outline", "moment", deps, [sprite(area, outline, mask.path(lines, L.stand.h * 0.2), { feather: 3 })], 1);

  const fill = (ctx) => {
    drawAll(ctx, figs, (fig) => (part) => {
      const cloth = part.c === "top" || part.c === "dress" || part.c === "bottom";
      const base = cloth ? pal.figure(fig.colors[part.c], 0.6, 0.3) : pal.figure(fig.colors[part.c]);
      return part.dim ? mix(base, pal.shade, 0.18) : base;
    }, 0);
  };
  kit.add("people", "moment", deps, [sprite(area, fill, mask.sweep("down", 8, kit.seed("people")), { feather: 4 })], 1.3);

  const toward = L.sun.x < L.cx ? -1 : 1;
  const lift = pal.night ? 2.4 : 3.2;
  const rim = (ctx) => {
    drawAll(ctx, figs, () => () => pal.light, 0);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.translate(-toward * lift, lift * 0.8);
    drawAll(ctx, figs, () => () => "#000", 0);
    ctx.restore();
  };
  kit.add("rim", "light", deps, [sprite(area, rim, mask.sweep(toward > 0 ? "left" : "right", 20, kit.seed("rim")), { blend: pal.mono ? "source-over" : "screen", alpha: pal.rim, feather: 3 })], 0.7);
}
