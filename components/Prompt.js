"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Mark from "./Mark";

const START = "describe anything";

// mostly real scenes with a few strange ones mixed in; every hint fits on one line in the input on a 360px-wide phone
const HINTS = [
  "a fox crossing a snowy road",
  "a horse grazing by an old barn",
  "a cat asleep in a sunny window",
  "an old dog dozing by the fireplace",
  "a heron standing in the shallows",
  "a bear catching salmon in a river",
  "deer in a meadow at first light",
  "a whale breaching off the coast",
  "geese flying over a cornfield",
  "a moose in a misty marsh",
  "cows lying down before the rain",
  "an owl on a fence post at night",
  "puppies tumbling in tall grass",
  "kids cannonballing into a lake",
  "a man fishing from a stone bridge",
  "two friends on a rooftop at sunset",
  "my grandma's garden after rain",
  "a street musician at night",
  "a couple dancing in the kitchen",
  "my dad grilling in the backyard",
  "a girl reading under a big oak",
  "fishermen mending nets at dawn",
  "a farmer on a tractor at harvest",
  "skaters on a frozen pond",
  "a kid flying a kite at the beach",
  "me and my dog on a long hike",
  "a baker opening up before sunrise",
  "an old couple on a park bench",
  "a surfer waiting for a wave",
  "my first apartment at night",
  "a lighthouse in a storm",
  "a city street in the rain at night",
  "a cabin under the northern lights",
  "a campfire under the stars",
  "a diner on an empty highway",
  "a night train in the mountains",
  "a small boat on a glassy lake",
  "a thunderstorm over the prairie",
  "lanterns floating on a river",
  "a ferris wheel at dusk",
  "snow falling on a quiet village",
  "waves crashing on a rocky shore",
  "a porch light on a summer night",
  "fog spilling over hills like milk",

  "a whale drifting over the rooftops",
  "a crow stealing the moon",
  "a fox reading by candlelight",
  "a city built on a turtle's back",
  "an astronaut mowing the lawn",
  "two moons over a fishing village",
  "a kid fishing for stars off a pier",
  "a door standing alone on a beach",
  "a giraffe peeking into a treehouse",
  "a polar bear in a hot spring",
  "a raccoon asleep in a rowboat",
  "a wolf howling at a streetlamp",
  "a flamingo standing in the snow",
];

const shuffle = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const MODES = ["2d"];

const grow = (el) => {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

export default function Prompt({ intro, draft, works, onWorks, onGenerate, onWarm }) {
  const [text, setText] = useState(draft);
  const [mode, setMode] = useState("2d");
  const [hint, setHint] = useState(START);
  const input = useRef(null);
  const filled = useRef(Boolean(draft));
  const ready = text.trim().length > 0;

  useLayoutEffect(() => grow(input.current), []);

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("c.mode");
    } catch {}
    const timer = setTimeout(() => MODES.includes(saved) && setMode(saved));
    const focus = matchMedia("(pointer: fine)").matches && setTimeout(() => input.current?.focus({ preventScroll: true }), intro ? 1250 : 0);
    return () => {
      clearTimeout(timer);
      clearTimeout(focus);
    };
  }, [intro]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // after the resting line, every hint once in a random order, then a new order, never the same one twice running
    let line = START;
    let n = line.length;
    let bag = [];
    let adding = false;
    let timer;
    const tick = () => {
      if (filled.current) return (timer = setTimeout(tick, 600));
      n += adding ? 1 : -1;
      setHint(line.slice(0, n));
      if (adding && n < line.length) return (timer = setTimeout(tick, 32 + Math.random() * 48));
      if (adding) {
        adding = false;
        return (timer = setTimeout(tick, 2600));
      }
      if (n > 0) return (timer = setTimeout(tick, 14));
      if (!bag.length) bag = shuffle(HINTS.filter((h) => h !== line));
      line = bag.pop();
      adding = true;
      timer = setTimeout(tick, 420);
    };
    timer = setTimeout(tick, intro ? 5200 : 4200);
    return () => clearTimeout(timer);
  }, [intro]);

  const submit = () => {
    if (!ready) return input.current?.focus();
    try {
      localStorage.setItem("c.mode", mode);
    } catch {}
    onGenerate({ text: text.trim(), mode });
  };

  const enter = intro ? "rise [animation-delay:1100ms]" : "";
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 pb-[14vh] pt-24">
      {works > 0 && (
        <button type="button" onClick={onWorks} className={`absolute right-5 top-[max(env(safe-area-inset-top),18px)] font-mono text-[12px] text-fg/45 transition-colors hover:text-fg sm:right-7 sm:top-6 ${enter}`}>
          gallery <span className="text-fg/25">{works}</span>
        </button>
      )}
      <span className="block w-[76px] sm:w-[96px]" style={{ viewTransitionName: "mark" }}>
        <Mark intro={intro} cursorName="cursor" />
      </span>
      <div className={`mt-14 w-full max-w-[600px] sm:mt-16 ${enter}`}>
        <div className="relative" style={{ viewTransitionName: "prompt" }}>
          <textarea
            ref={input}
            rows={1}
            value={text}
            maxLength={600}
            spellCheck={false}
            aria-label="Describe anything"
            onFocus={onWarm}
            onChange={(e) => {
              setText(e.target.value);
              filled.current = Boolean(e.target.value);
              grow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="block w-full resize-none bg-transparent pb-3 text-[20px] font-light leading-snug text-fg caret-fg outline-none sm:text-[24px]"
          />
          {!text && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 truncate text-[20px] font-light leading-snug text-fg/30 sm:text-[24px]">
              {hint}
            </span>
          )}
        </div>
        <div className="h-px bg-fg/15" />
        <div className="mt-4 flex items-center justify-end">
          <div role="radiogroup" aria-label="Mode" className="mr-auto flex rounded-full border border-fg/12 p-[3px] font-mono text-[11px]">
            {MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 transition-colors ${mode === m ? "bg-fg text-bg" : "text-fg/45 hover:text-fg"}`}>
                {m}
              </button>
            ))}
            <span role="radio" aria-checked="false" aria-disabled="true" title="3D is coming soon" className="cursor-default rounded-full px-3 py-1 text-fg/25">
              3d <span className="text-fg/20">soon</span>
            </span>
          </div>
          <button type="button" onClick={submit} aria-disabled={!ready} className={`flex items-center gap-2 font-mono text-[12px] transition-colors ${ready ? "text-fg" : "text-fg/25"}`}>
            generate <span className="text-fg/40">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
