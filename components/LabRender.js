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
      const [{ paint }, P] = await Promise.all([import("@/lib/art/directions"), import("@/lib/art/plan")]);
      window.cLab = {
        series: async (raw, n, seed = 1009, force = []) => {
          const out = [];
          let plan = P.normalizePlan({ ...raw, seed });
          for (let k = 0; k < n; k++) {
            if (k) plan = P.variant ? P.variant(plan, k) : P.normalizePlan({ ...plan, seed: seed + k * 7919, avoid: out.map((o) => o.meta.direction).slice(-2) });
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
