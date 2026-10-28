"use client";

import { useEffect, useRef, useState } from "react";
import saved from "@/lab/plans.json";
import { SETS } from "@/lib/lab";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MARKS = { good: "text-emerald-300/80", work: "text-amber-300/80" };

async function save(body) {
  const res = await fetch("/api/lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

async function still(host, plan) {
  const { createArtwork } = await import("@/lib/engine");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:480px;height:360px;display:block";
  host.appendChild(canvas);
  let art;
  try {
    art = createArtwork(canvas, plan, { mode: plan.mode });
    art.skip();
    await wait(900);
    const blob = await art.snapshot();
    return URL.createObjectURL(blob);
  } catch {
    return "broken";
  } finally {
    art?.dispose();
    canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  }
}

export default function Lab() {
  const [entries, setEntries] = useState(saved);
  const [thumbs, setThumbs] = useState({});
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const [round, setRound] = useState(0);
  const host = useRef(null);
  const live = useRef(null);

  const prompts = SETS.flatMap((s) => s.prompts);

  useEffect(() => {
    let gone = false;
    (async () => {
      for (const text of prompts) {
        const plan = entries[text]?.plan;
        if (gone) return;
        if (!plan || thumbs[text]?.seed === plan.seed) continue;
        const src = await still(host.current, plan);
        if (!gone) setThumbs((t) => ({ ...t, [text]: { src, seed: plan.seed } }));
      }
    })();
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, round]);

  useEffect(() => {
    const plan = open && entries[open]?.plan;
    if (!plan) return;
    let art;
    let gone = false;
    import("@/lib/engine").then(({ createArtwork }) => {
      if (!gone) art = createArtwork(live.current, plan, { mode: plan.mode });
    });
    return () => {
      gone = true;
      art?.dispose();
    };
  }, [open, entries]);

  const generate = async (list) => {
    for (const text of list) {
      setBusy(text);
      const { plan, source } = await fetch("/api/interpret", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, mode: "3d" }) }).then((r) => r.json());
      const entry = await save({ text, plan: { ...plan, source } });
      setEntries((e) => ({ ...e, [text]: entry }));
    }
    setBusy("");
  };

  const mark = async (text, verdict) => {
    const entry = await save({ text, verdict: entries[text]?.verdict === verdict ? "" : verdict });
    setEntries((e) => ({ ...e, [text]: entry }));
  };

  const rerender = () => {
    setThumbs({});
    setRound((r) => r + 1);
  };

  const missing = prompts.filter((p) => !entries[p]?.plan);
  const good = prompts.filter((p) => entries[p]?.verdict === "good").length;
  const current = open && entries[open];

  return (
    <main className="min-h-dvh px-5 pb-20 pt-6 sm:px-8">
      <div ref={host} aria-hidden className="pointer-events-none fixed -left-[10000px] top-0" />
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-fg/60">
        <h1 className="text-fg/90">c lab</h1>
        <span>
          {good}/{prompts.length} good
        </span>
        {missing.length > 0 && (
          <button type="button" disabled={!!busy} onClick={() => generate(missing)} className="hover:text-fg disabled:opacity-40">
            generate {missing.length} missing
          </button>
        )}
        <button type="button" onClick={rerender} className="hover:text-fg">
          render again
        </button>
        {busy && <span className="text-fg/40">reading “{busy}”…</span>}
      </header>

      {SETS.map((set) => (
        <section key={set.name} className="mt-8">
          <h2 className="font-mono text-[11px] text-fg/40">
            {set.name} <span className="text-fg/25">{set.prompts.filter((p) => entries[p]?.verdict === "good").length}/{set.prompts.length}</span>
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {set.prompts.map((text) => {
              const entry = entries[text];
              const thumb = thumbs[text]?.src;
              return (
                <li key={text}>
                  <button type="button" onClick={() => entry?.plan && setOpen(text)} className="block w-full text-left">
                    <span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-[3px] bg-fg/5 font-mono text-[11px] text-fg/30 ring-1 ring-fg/10">
                      {thumb && thumb !== "broken" ? <img src={thumb} alt="" className="size-full object-cover" /> : thumb === "broken" ? "broke" : entry?.plan ? "rendering" : "no plan"}
                    </span>
                    <span className="mt-2 block truncate text-[13px] text-fg/85">{text}</span>
                  </button>
                  <span className="mt-0.5 flex gap-3 font-mono text-[11px] text-fg/35">
                    {entry?.plan?.source === "words" && <span className="text-rose-300/70">fallback</span>}
                    {entry?.plan?.missing?.length > 0 && <span className="truncate">no {entry.plan.missing.join(", ")}</span>}
                    {entry?.verdict && <span className={MARKS[entry.verdict]}>{entry.verdict === "good" ? "good" : "needs work"}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {current && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex flex-col bg-bg">
          <canvas ref={live} className="min-h-0 w-full flex-1" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 font-mono text-[12px] text-fg/60 sm:px-8">
            <span className="text-fg/90">{open}</span>
            <span className="text-fg/40">{current.plan.read}</span>
            <button type="button" onClick={() => mark(open, "good")} className={current.verdict === "good" ? MARKS.good : "hover:text-fg"}>
              good
            </button>
            <button type="button" onClick={() => mark(open, "work")} className={current.verdict === "work" ? MARKS.work : "hover:text-fg"}>
              needs work
            </button>
            <button type="button" disabled={!!busy} onClick={() => generate([open])} className="hover:text-fg disabled:opacity-40">
              {busy === open ? "reading…" : "new plan"}
            </button>
            <button type="button" onClick={() => setOpen(null)} className="ml-auto hover:text-fg">
              close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
