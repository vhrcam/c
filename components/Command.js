"use client";

import { Fragment, useEffect, useState } from "react";

const STOP = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "and", "with", "my", "our", "your", "from", "into", "is", "are", "was", "for", "by", "it", "its", "this", "that", "little", "big", "old", "far", "distant"]);
const HOURS = { dawn: ["dawn", "sunrise", "morning"], day: ["day", "noon", "afternoon"], golden: ["golden", "afternoon", "evening"], dusk: ["dusk", "sunset", "evening", "twilight"], night: ["night", "midnight", "dark"] };
const SKIES = { rain: ["rain", "raining", "rainy"], snow: ["snow", "snowy", "snowing", "winter"], fog: ["fog", "foggy", "mist", "misty"], storm: ["storm", "stormed", "stormy", "thunder"], wind: ["wind", "windy", "breeze"], cloud: ["cloud", "cloudy", "overcast"] };
const norm = (w) => (w || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(?<=...)s$/, "");
const like = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));

// which of the person's own words the director turned into something in the picture
export function understand(words, plan) {
  const keys = words.map(norm);
  const subjects = new Map();
  const extras = new Set();
  if (plan?.v !== 2) return { subjects, extras };
  const find = (tokens) => {
    for (const t of tokens) {
      const i = keys.findIndex((k, at) => k && like(k, t) && !subjects.has(at));
      if (i >= 0) return i;
    }
    return -1;
  };
  for (const f of plan.forms) {
    const own = f.name.split(/[\s_-]+/).reverse().map(norm).filter((t) => t && !STOP.has(t));
    const at = find(own);
    if (at < 0) continue;
    if (f.role === "setting") extras.add(at);
    else subjects.set(at, f.name);
  }
  const terms = [...(HOURS[plan.time] || []), ...(SKIES[plan.weather] || [])];
  keys.forEach((k, i) => terms.includes(k) && !subjects.has(i) && extras.add(i));
  return { subjects, extras };
}

export default function Command({ text, plan }) {
  const [tick, setTick] = useState(0);
  const words = text.split(/\s+/).filter(Boolean);
  const read = plan ? understand(words, plan) : null;

  useEffect(() => {
    if (plan) return;
    const id = setInterval(() => setTick((t) => t + 1), 170);
    return () => clearInterval(id);
  }, [plan]);

  return (
    <p className="relative max-w-[min(640px,86vw)] text-balance text-center font-mono text-[15px] leading-[2.2] sm:text-[18px]" style={{ viewTransitionName: "prompt" }}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            className={`transition-colors duration-500 ${
              read?.subjects.has(i) ? "text-fg underline decoration-fg/35 decoration-1 underline-offset-[7px]" : read?.extras.has(i) ? "text-fg/70" : read?.subjects.size ? "text-fg/25" : read ? "text-fg/40" : tick % (words.length + 6) === i ? "text-fg" : "text-fg/40"
            }`}
          >
            {w}
          </span>{" "}
        </Fragment>
      ))}
      <span aria-hidden data-state={read ? "on" : "think"} className="mark-cursor inline-block h-[1.05em] w-[0.55em] translate-y-[0.2em] bg-fg" style={{ viewTransitionName: "cursor" }} />
    </p>
  );
}
