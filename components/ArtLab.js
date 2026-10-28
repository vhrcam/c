"use client";

import { useEffect, useState } from "react";

const MEMORIES = [
  "me and her watching the sunset",
  "the lake behind my grandparents' cabin where we spent every summer",
  "racing down the beach at sunrise",
  "walking home together in the rain through the city at night",
];
const SEEDS = [11, 2024, 7, 314];

const plans = new Map();

async function planFor(text) {
  if (!plans.has(text)) plans.set(text, fetch("/api/art", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }).then((r) => r.json()).then((j) => j.plan));
  return plans.get(text);
}

async function render(text, seed, scale) {
  const { normalizePlan } = await import("@/lib/art/plan");
  const { paint } = await import("@/lib/art/directions");
  const plan = normalizePlan(await planFor(text));
  const c = await paint(plan, seed, { scale });
  const m = c.meta;
  return { src: c.toDataURL("image/jpeg", 0.9), meta: `${m.direction} · ${m.framing} · ${m.place} · ${m.time} · ${m.pose}` };
}

export default function ArtLab() {
  const [thumbs, setThumbs] = useState({});
  const [open, setOpen] = useState(null);
  const [big, setBig] = useState(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      for (const text of MEMORIES)
        for (const seed of SEEDS) {
          await new Promise((r) => setTimeout(r, 0));
          if (gone) return;
          const t = performance.now();
          try {
            const out = await render(text, seed, 0.5);
            if (!gone) setThumbs((s) => ({ ...s, [`${text}-${seed}`]: { ...out, ms: Math.round(performance.now() - t) } }));
          } catch (e) {
            if (!gone) setThumbs((s) => ({ ...s, [`${text}-${seed}`]: { error: String(e.message || e) } }));
          }
        }
    })();
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let gone = false;
    render(open.text, open.seed, 1).then((out) => !gone && setBig(out.src));
    return () => {
      gone = true;
      setBig(null);
    };
  }, [open]);

  return (
    <main className="min-h-dvh px-5 pb-20 pt-6 sm:px-8">
      <h1 className="font-mono text-[12px] text-fg/90">c art lab</h1>
      {MEMORIES.map((text) => (
        <section key={text} className="mt-7">
          <h2 className="font-mono text-[11px] text-fg/50">“{text}”</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SEEDS.map((seed) => {
              const t = thumbs[`${text}-${seed}`];
              return (
                <li key={seed}>
                  <button type="button" onClick={() => setOpen({ text, seed })} className="block w-full">
                    <span className="grid aspect-[3/2] place-items-center overflow-hidden rounded-[3px] bg-fg/5 font-mono text-[11px] text-fg/30">{t?.src ? <img src={t.src} alt="" className="size-full object-cover" /> : t?.error ? <span className="err px-2 text-rose-300/80">{t.error}</span> : "painting"}</span>
                  </button>
                  <span className="mt-1 block font-mono text-[10px] leading-snug text-fg/35">{t?.meta && `${seed} · ${t.meta} · ${t.ms} ms`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-bg p-4" onClick={() => setOpen(null)}>
          {big ? <img src={big} alt="" className="max-h-full max-w-full" /> : <span className="font-mono text-[12px] text-fg/40">painting</span>}
        </div>
      )}
    </main>
  );
}
