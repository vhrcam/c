"use client";

import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from "react";
import { build, firstChange } from "@/lib/paint/build";
import { Player } from "@/lib/paint/player";

function Button({ label, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-8 min-w-8 place-items-center rounded-full px-2 text-[13px] text-ink/75 transition-colors hover:bg-ink/[0.07] hover:text-ink">
      {children}
    </button>
  );
}

const icon = { width: 15, height: 15, viewBox: "0 0 16 16", fill: "currentColor" };
const line = { ...icon, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };

export default function Painting({ job, label, onDone, ref }) {
  const stage = useRef(null);
  const view = useRef(null);
  const player = useRef(null);
  const last = useRef(null);
  const sleep = useRef(0);
  const [state, setState] = useState({ playing: false, done: false, speed: 1 });
  const [fullscreen, setFullscreen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [awake, setAwake] = useState(true);
  const full = fullscreen || focus;
  const finished = useEffectEvent((painting) => onDone?.(painting.scene));

  useEffect(() => {
    let reported = null;
    const p = new Player(view.current, {
      onState: (s) => {
        setState(s);
        if (s.done && reported !== p.painting) {
          reported = p.painting;
          finished(p.painting);
        }
      },
    });
    player.current = p;
    const observer = new ResizeObserver(() => p.resize());
    observer.observe(view.current);
    const change = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", change);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", change);
      clearTimeout(sleep.current);
      p.stop();
    };
  }, []);

  useEffect(() => {
    if (!job) return;
    const next = build(job.scene);
    const prev = last.current;
    last.current = next;
    if (job.how === "show") player.current.load(next, { show: true });
    else if (job.how === "play" || !prev) player.current.load(next);
    else {
      const from = firstChange(prev, next);
      if (from >= 0) player.current.load(next, { from, fade: true });
    }
  }, [job]);

  const wake = () => {
    setAwake(true);
    clearTimeout(sleep.current);
    sleep.current = setTimeout(() => setAwake(false), 2000);
  };

  const toggleFull = () => {
    if (fullscreen) return document.exitFullscreen?.();
    if (focus) return setFocus(false);
    const el = stage.current;
    wake();
    if (document.fullscreenEnabled && el.requestFullscreen) el.requestFullscreen().catch(() => setFocus(true));
    else setFocus(true);
  };

  const key = useEffectEvent((e) => {
    if (!job || e.target.closest?.("input, textarea, [role=dialog]")) return;
    if (e.key === "f" || e.key === "F") toggleFull();
    else if (e.key === " ") {
      e.preventDefault();
      player.current.toggle();
    } else if (e.key === "Escape" && focus) setFocus(false);
    if (full) wake();
  });

  useEffect(() => {
    const onKey = (e) => key(e);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useImperativeHandle(ref, () => ({ replay: () => player.current.replay() }), []);

  const painting = job && !state.done;
  const rounded = job?.scene.style === "storybook";
  const shown = full ? awake : painting;
  const hover = !full && job && !painting;

  return (
    <div
      ref={stage}
      onPointerMove={full ? wake : undefined}
      onPointerDown={full ? wake : undefined}
      className={`group ${full ? `fixed inset-0 z-50 flex items-center justify-center bg-paper ${awake ? "" : "cursor-none"}` : "relative"}`}
    >
      <div className="relative" style={full ? { width: "min(calc(100vw - 48px), calc((100dvh - 48px) * 1.5))" } : undefined}>
        <canvas ref={view} role="img" aria-label={label} className={`block w-full ${rounded ? "rounded-[10px]" : ""}`} style={{ aspectRatio: "3 / 2" }} />
      </div>
      <div
        className={`absolute flex items-center gap-0.5 rounded-full bg-paper/85 p-1 shadow-[0_1px_8px_rgba(26,25,22,0.12)] backdrop-blur transition-opacity duration-300 ${full ? "bottom-6 left-1/2 -translate-x-1/2" : "bottom-3 right-3"} ${shown ? "opacity-100" : hover ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {state.done ? (
          <Button label="Paint again" onClick={() => player.current.replay()}>
            <svg {...line}>
              <path d="M3 8a5 5 0 1 0 1.6-3.7" />
              <path d="M3 2.5v2.8h2.8" />
            </svg>
          </Button>
        ) : (
          <>
            <Button label={state.playing ? "Pause" : "Play"} onClick={() => player.current.toggle()}>
              {state.playing ? (
                <svg {...icon}>
                  <rect x="3.5" y="3" width="3" height="10" rx="1" />
                  <rect x="9.5" y="3" width="3" height="10" rx="1" />
                </svg>
              ) : (
                <svg {...icon}>
                  <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
                </svg>
              )}
            </Button>
            <Button label="Change speed" onClick={() => player.current.setSpeed(state.speed === 1 ? 2 : 1)}>
              <span className="tabular-nums">{state.speed}×</span>
            </Button>
            <Button label="Skip to the end" onClick={() => player.current.skip()}>
              <svg {...icon}>
                <path d="M2.5 3.3v9.4a.5.5 0 0 0 .8.4L9 8.4a.5.5 0 0 0 0-.8L3.3 2.9a.5.5 0 0 0-.8.4Z" />
                <rect x="11" y="3" width="2.4" height="10" rx="1" />
              </svg>
            </Button>
          </>
        )}
        <Button label={full ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFull}>
          {full ? (
            <svg {...line}>
              <path d="M6 2.5V6H2.5M10 2.5V6h3.5M6 13.5V10H2.5M10 13.5V10h3.5" />
            </svg>
          ) : (
            <svg {...line}>
              <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}
