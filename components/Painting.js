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

export default function Painting({ job, label, onDone, ref }) {
  const view = useRef(null);
  const player = useRef(null);
  const last = useRef(null);
  const [state, setState] = useState({ playing: false, done: false, speed: 1 });
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
    return () => {
      observer.disconnect();
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

  useImperativeHandle(ref, () => ({ replay: () => player.current.replay() }), []);

  const painting = job && !state.done;
  const rounded = job?.scene.style === "storybook";

  return (
    <div className="group relative">
      <canvas ref={view} role="img" aria-label={label} className={`block w-full ${rounded ? "rounded-[10px]" : ""}`} style={{ aspectRatio: "3 / 2" }} />
      <div
        className={`absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full bg-paper/85 p-1 shadow-[0_1px_8px_rgba(26,25,22,0.12)] backdrop-blur transition-opacity duration-300 ${painting ? "opacity-100" : job ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {state.done ? (
          <Button label="Paint again" onClick={() => player.current.replay()}>
            <svg {...icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8a5 5 0 1 0 1.6-3.7" /><path d="M3 2.5v2.8h2.8" /></svg>
          </Button>
        ) : (
          <>
            <Button label={state.playing ? "Pause" : "Play"} onClick={() => player.current.toggle()}>
              {state.playing ? <svg {...icon}><rect x="3.5" y="3" width="3" height="10" rx="1" /><rect x="9.5" y="3" width="3" height="10" rx="1" /></svg> : <svg {...icon}><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>}
            </Button>
            <Button label="Change speed" onClick={() => player.current.setSpeed(state.speed === 1 ? 2 : 1)}>
              <span className="tabular-nums">{state.speed}×</span>
            </Button>
            <Button label="Skip to the end" onClick={() => player.current.skip()}>
              <svg {...icon}><path d="M2.5 3.3v9.4a.5.5 0 0 0 .8.4L9 8.4a.5.5 0 0 0 0-.8L3.3 2.9a.5.5 0 0 0-.8.4Z" /><rect x="11" y="3" width="2.4" height="10" rx="1" /></svg>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
