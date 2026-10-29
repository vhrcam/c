"use client";

import { useEffect, useState } from "react";

function measure(canvas) {
  const t = document.createElement("canvas");
  t.width = 24;
  t.height = 16;
  t.getContext("2d").drawImage(canvas, 0, 0, 24, 16);
  const thumb = Array.from(t.getContext("2d").getImageData(0, 0, 24, 16).data)
    .filter((_, i) => i % 4 !== 3)
    .map((v) => v / 255);
  const g = document.createElement("canvas");
  g.width = 300;
  g.height = 200;
  const gx = g.getContext("2d");
  gx.drawImage(canvas, 0, 0, 300, 200);
  const px = gx.getImageData(0, 0, 300, 200).data;
  let flat = 0;
  for (let ty = 0; ty < 20; ty++)
    for (let tx = 0; tx < 30; tx++) {
      let s = 0;
      let s2 = 0;
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < 10; x++) {
          const i = ((ty * 10 + y) * 300 + tx * 10 + x) * 4;
          const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
          s += l;
          s2 += l * l;
        }
      if (Math.sqrt(Math.max(0, s2 / 100 - (s / 100) ** 2)) < 0.018) flat++;
    }
  return { thumb, empty: flat / 600 };
}

export default function LabRender() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let gone = false;
    (async () => {
      const [{ paint, prepare }, P] = await Promise.all([import("@/lib/art/directions"), import("@/lib/art/plan")]);
      window.cLab = {
        buffer: async (raw, seed = 1009, keep = null) => {
          const plan = P.normalizePlan({ ...raw, seed });
          const S = await prepare(plan, seed);
          if (keep && S.fig) S.fig.items = S.fig.items.filter((_, i) => keep.includes(i));
          const { figureLayer, sceneBuffer } = await import("@/lib/art/scene");
          const cv = sceneBuffer(S, 0.5).canvas;
          const layer = figureLayer(S, 0.5);
          const g = cv.getContext("2d");
          g.setTransform(1, 0, 0, 1, 0, 0);
          if (layer) g.drawImage(layer, 0, 0, cv.width, cv.height);
          return cv.toDataURL("image/png");
        },
        inspect: async (raw, seed = 1009) => {
          const plan = P.normalizePlan({ ...raw, seed });
          const S = await prepare(plan, seed);
          return (S.fig?.items || []).map((it) => {
            const xs = it.pts.map((q) => q[0]);
            const ys = it.pts.map((q) => q[1]);
            return { kind: it.kind, mat: it.mat, color: it.color, z: it.z, person: it.person, w: Math.round(Math.max(...xs) - Math.min(...xs)), h: Math.round(Math.max(...ys) - Math.min(...ys)), n: it.pts.length };
          });
        },
        norm: (raw) => P.normalizePlan(raw),
        // one character shot on plain paper, close or wide, so the people can be judged on their own
        studio: async (raw, seed = 1009, shot = "close") => {
          const plan = P.normalizePlan({ ...raw, seed, conceptIndex: 0, concepts: [{ idea: "", spatial: shot === "close" ? "close" : "scene", framing: shot, construction: "lines", abstraction: 0.2 }] });
          const S = await prepare(plan, seed);
          const { figureLayer } = await import("@/lib/art/scene");
          const cv = document.createElement("canvas");
          cv.width = 1200;
          cv.height = 800;
          const g = cv.getContext("2d");
          g.fillStyle = "#f3eee5";
          g.fillRect(0, 0, 1200, 800);
          const layer = figureLayer(S, 0.8);
          if (layer) g.drawImage(layer, 0, 0);
          return cv.toDataURL("image/png");
        },
        world: async (raw, seed = 1009) => {
          const plan = P.normalizePlan({ ...raw, seed });
          const S = await prepare(plan, seed);
          const r = (v) => Math.round(v);
          return { comp: { layout: S.comp.layout, framing: S.comp.framing, subject: S.comp.subject, feet: r(S.comp.feet ?? -1), body: r(S.comp.body), ppm: r(S.comp.ppm), hz: r(S.world.horizon), focusX: r(S.comp.focusX) }, support: S.world.support, attract: S.world.attract, objects: S.world.objects.filter((o) => o.kind === "thing" || o.kind === "window" || o.kind === "house").map((o) => `${o.kind}:${o.label || ""} x${r(o.x)} y${r(o.y ?? 0)} w${r(o.w ?? 0)} h${r(o.h ?? 0)}${o.front ? " front" : ""}`) };
        },
        words: (text) => P.readWords(text),
        colors: async (raw, seed = 1009) => {
          const plan = P.normalizePlan({ ...raw, seed });
          const S = await prepare(plan, seed);
          const out = {};
          for (const who of [1, 2]) for (const mat of [1, 2, 4, 5, 6, 7, 9]) out[`${who}:${mat}`] = S.fig.fill(mat, who)[0];
          return out;
        },
        series: async (raw, n, seed = 1009, force = []) => {
          const out = [];
          const base = P.normalizePlan({ ...raw, seed });
          for (let k = 0; k < n; k++) {
            const plan = k ? P.variant(base, k) : base;
            const t = performance.now();
            const c = await paint(plan, plan.seed, force.length ? { scale: 0.6, direction: force[k % force.length] } : { scale: 0.6 });
            out.push({ png: c.toDataURL("image/png"), meta: c.meta, ms: Math.round(performance.now() - t), ...measure(c) });
          }
          return out;
        },
      };
      if (!gone) setReady(true);
    })();
    return () => {
      gone = true;
    };
  }, []);

  return <main data-ready={ready} className="p-6 font-mono text-[12px] text-fg/60">{ready ? "ready" : "loading"}</main>;
}
