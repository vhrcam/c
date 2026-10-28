"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { download, thumb } from "@/lib/thumbs";
import Command, { understand } from "./Command";
import Dock from "./Dock";
import Mark from "./Mark";
import { morph } from "./morph";
import Readout from "./Readout";

const READ = { id: "read", label: "read" };

function Phases({ phases, current }) {
  return (
    <ol aria-label="Build phases" className="absolute right-[max(env(safe-area-inset-right),20px)] top-[max(env(safe-area-inset-top),18px)] text-right font-mono text-[11px] leading-[1.85] sm:right-7 sm:top-6">
      {[READ, ...phases].map((p, i) => (
        <li key={p.id} className={i === current ? "text-fg" : i < current ? "hidden text-fg/40 sm:block" : "hidden text-fg/15 sm:block"}>
          {p.label}
          <span data-state={i === current ? "blink" : undefined} className={`mark-cursor ml-2 inline-block h-[0.8em] w-[0.45em] align-[-0.05em] ${i === current ? "bg-fg" : ""}`} />
        </li>
      ))}
    </ol>
  );
}

export default function Stage({ run, onTone, onHome, onEdit, onRetry, onRegenerate, onSwitch, onSave, onShare }) {
  const canvas = useRef(null);
  const art = useRef(null);
  const bar = useRef(null);
  const still = useRef(null);
  const sleep = useRef(0);
  const [phases, setPhases] = useState([]);
  const [phase, setPhase] = useState("");
  const [ready, setReady] = useState(Boolean(run.plan) && !run.start);
  const [reference, setReference] = useState(null);
  const [live, setLive] = useState(false);
  const [done, setDone] = useState(false);
  const [broken, setBroken] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement));
  const [awake, setAwake] = useState(true);
  const plan = run.plan;
  const step = phases.findIndex((p) => p.id === phase);
  const tone = useEffectEvent((hex) => onTone(hex));

  useEffect(() => {
    if (!plan?.reference) return;
    let gone = false;
    import("@/lib/engine").then((m) => !gone && m.REFERENCE && setReference(plan.reference));
    return () => {
      gone = true;
    };
  }, [plan]);

  useEffect(() => {
    if (!plan || ready) return;
    const found = understand(run.text.split(/\s+/).filter(Boolean), plan).subjects.size > 0;
    const timer = setTimeout(() => morph(() => setReady(true)), found ? 2400 : 1000);
    return () => clearTimeout(timer);
  }, [plan, ready, run.text]);

  useEffect(() => {
    if (!plan || !ready) return;
    let gone = false;
    let made = null;
    const frame = requestAnimationFrame(() =>
      setTimeout(async () => {
        const { createArtwork } = await import("@/lib/engine");
        if (gone) return;
        try {
          made = createArtwork(canvas.current, plan, { mode: plan.mode, onPhase: (id) => setPhase(id), onDone: () => setDone(true) });
        } catch {
          return setBroken(true);
        }
        art.current = made;
        if ("reference" in made) setReference(made.reference || null);
        setPhases(made.phases);
        setLive(true);
        tone(made.background);
      })
    );
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      made?.dispose();
      art.current = null;
    };
  }, [plan, ready]);

  useEffect(() => {
    if (!plan) return;
    const before = document.title;
    document.title = `${plan.title} · c`;
    return () => {
      document.title = before;
    };
  }, [plan]);

  useEffect(() => {
    if (!live || done) return;
    let frame;
    const tick = () => {
      const a = art.current;
      if (a && bar.current) bar.current.style.transform = `scaleX(${Math.min(1, a.time() / a.duration)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, done]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      still.current = art.current?.snapshot().then((blob) => thumb(blob));
    }, 1200);
    return () => clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    const wake = () => {
      setAwake(true);
      clearTimeout(sleep.current);
      sleep.current = setTimeout(() => setAwake(false), 3200);
    };
    const change = () => setFull(Boolean(document.fullscreenElement));
    sleep.current = setTimeout(() => setAwake(false), 3200);
    addEventListener("pointermove", wake);
    addEventListener("pointerdown", wake);
    addEventListener("keydown", wake);
    document.addEventListener("fullscreenchange", change);
    return () => {
      clearTimeout(sleep.current);
      removeEventListener("pointermove", wake);
      removeEventListener("pointerdown", wake);
      removeEventListener("keydown", wake);
      document.removeEventListener("fullscreenchange", change);
    };
  }, []);

  const toggle = () => {
    if (!art.current) return;
    art.current.toggle();
    setPlaying((p) => !p);
  };

  const skip = () => {
    art.current?.skip();
    setPlaying(true);
  };

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())?.catch?.(() => {});

  const keep = async () => {
    const image = await (still.current || art.current?.snapshot().then((blob) => thumb(blob)));
    if (image) onSave(plan, image);
  };

  const exportPng = async () => {
    const blob = await art.current?.snapshot();
    if (blob) download(blob, plan.title);
  };

  const key = useEffectEvent((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, button, [role=dialog]")) return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    } else if ((e.key === "f" || e.key === "F") && document.fullscreenEnabled) fullscreen();
  });

  useEffect(() => {
    const onKey = (e) => key(e);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const hide = done && !awake;
  const error = run.failed ? "c couldn’t read that just now." : broken ? "This browser couldn’t start the engine." : "";
  return (
    <div className={`fixed inset-0 overflow-hidden ${hide ? "cursor-none" : ""}`}>
      {plan && ready && <canvas ref={canvas} role="img" aria-label={plan.title} className="absolute inset-0 block size-full touch-none" />}
      <span
        aria-hidden
        data-state="think"
        className={`mark-cursor pointer-events-none absolute left-1/2 top-1/2 -ml-[6px] -mt-[17px] h-[34px] w-[12px] bg-fg transition-opacity duration-700 ${ready && !live && !error ? "" : "opacity-0"}`}
        style={{ viewTransitionName: ready && !live && !error ? "cursor" : undefined }}
      />
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 pb-10">
          <Command text={run.text} plan={plan} reference={reference} />
        </div>
      )}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${hide ? "opacity-0" : ""}`} style={{ textShadow: "0 0 14px var(--bg), 0 0 3px var(--bg)" }}>
        <button
          type="button"
          onClick={onHome}
          aria-label="New artwork"
          title="New artwork"
          className="pointer-events-auto absolute left-[max(env(safe-area-inset-left),20px)] top-[max(env(safe-area-inset-top),18px)] block w-[30px] text-fg sm:left-7 sm:top-6"
          style={{ viewTransitionName: "mark" }}
        >
          <Mark cursor={done ? "blink" : "off"} />
        </button>
        {!done && !error && <Phases phases={phases} current={live ? step + 1 : 0} />}
        <div className="absolute inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+76px)] sm:inset-x-auto sm:bottom-7 sm:left-7">
          <Readout run={run} reference={reference} phases={phases} step={step} ready={ready} done={done} error={error} onRetry={run.failed ? onRetry : null} onEdit={onEdit} />
        </div>
        {plan && live && (
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6">
            <Dock
              done={done}
              playing={playing}
              full={full}
              mode={plan.mode}
              onToggle={toggle}
              onSkip={skip}
              onFull={document.fullscreenEnabled ? fullscreen : null}
              onSave={keep}
              onDownload={exportPng}
              onShare={() => onShare(plan)}
              onRegenerate={onRegenerate}
              onSwitch={onSwitch}
              onNew={onHome}
            />
          </div>
        )}
        {live && !done && (
          <div className="absolute inset-x-0 bottom-0 h-px bg-fg/10">
            <div ref={bar} className="h-full origin-left bg-fg/55" style={{ transform: "scaleX(0)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
