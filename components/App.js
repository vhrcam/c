"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { luma } from "@/lib/color";
import { list, remove, save } from "@/lib/gallery";
import { decode, encode } from "@/lib/share";
import { morph } from "./morph";
import Notice from "./Notice";
import Prompt from "./Prompt";
import Stage from "./Stage";
import Works from "./Works";

const engine = () => import("@/lib/engine");
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

async function interpret(text, mode) {
  const res = await fetch("/api/interpret", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, mode }), signal: AbortSignal.timeout(65000) });
  if (!res.ok) throw new Error(`Interpret request failed: ${res.status}`);
  return res.json();
}

export default function App() {
  const [view, setView] = useState("home");
  const [run, setRun] = useState(null);
  const [tone, setTone] = useState("");
  const [draft, setDraft] = useState("");
  const [intro, setIntro] = useState(true);
  const [shelf, setShelf] = useState({ open: false, items: [] });
  const [count, setCount] = useState(0);
  const [note, setNote] = useState("");
  const ticket = useRef(0);
  const noteTimer = useRef(0);

  const say = (message) => {
    setNote(message);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 2600);
  };

  const play = (plan) => {
    const id = ++ticket.current;
    setIntro(false);
    setTone("");
    morph(() => {
      setView("stage");
      setRun({ id, text: plan.text, mode: plan.mode, plan });
    });
  };

  const generate = async ({ text, mode }) => {
    const id = ++ticket.current;
    const start = performance.now();
    setIntro(false);
    setDraft(text);
    setTone("");
    morph(() => {
      setView("stage");
      setRun({ id, text, mode, start, plan: null });
    });
    try {
      const [{ plan, source }, { normalizePlan }] = await Promise.all([interpret(text, mode), engine()]);
      if (id === ticket.current) setRun({ id, text, mode, start, took: performance.now() - start, source, plan: normalizePlan({ ...plan, text: plan?.text || text, mode }) });
    } catch {
      if (id === ticket.current) setRun({ id, text, mode, start, plan: null, failed: true });
    }
  };

  const regenerate = () => setRun({ ...run, id: ++ticket.current, plan: { ...run.plan, seed: newSeed() } });

  const switchMode = () => {
    const mode = run.plan.mode === "3d" ? "2d" : "3d";
    setRun({ ...run, id: ++ticket.current, mode, plan: { ...run.plan, mode } });
  };

  const home = (keepText = false) => {
    ticket.current++;
    if (!keepText) setDraft("");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    morph(() => {
      setView("home");
      setRun(null);
      setTone("");
    });
  };

  const share = async (plan) => {
    const url = `${location.origin}${location.pathname}#a=${await encode(plan)}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) return await navigator.share({ title: `c · ${plan.title}`, url });
      await navigator.clipboard.writeText(url);
      say("Link copied. Whoever opens it watches it build");
    } catch (e) {
      if (e?.name !== "AbortError") say("Couldn’t copy the link");
    }
  };

  const keep = (plan, image) => {
    say(save(plan, image) ? "Saved to your gallery" : "Your browser is out of space for more works");
    setCount(list().length);
  };

  const openWorks = () => setShelf({ open: true, items: list() });
  const closeWorks = () => setShelf((s) => ({ ...s, open: false }));

  const openWork = (item) => {
    closeWorks();
    play(item.plan);
  };

  const drop = (id) => {
    remove(id);
    const items = list();
    setShelf({ open: true, items });
    setCount(items.length);
  };

  const boot = useEffectEvent(async () => {
    setCount(list().length);
    const code = location.hash.startsWith("#a=") ? location.hash.slice(3) : "";
    if (!code) return;
    const plan = await decode(code);
    if (plan) return play(plan);
    history.replaceState(null, "", location.pathname + location.search);
    say("That link didn’t open");
  });

  useEffect(() => {
    const timer = setTimeout(boot);
    return () => clearTimeout(timer);
  }, []);

  const stage = view === "stage" && run;
  const style = stage && tone ? { "--bg": tone, "--fg": luma(tone) >= 0.42 ? "#1a1916" : "#ece7dd" } : undefined;
  return (
    <main style={style} className="min-h-dvh bg-bg text-fg">
      {stage ? (
        <Stage
          key={run.id}
          run={run}
          onTone={setTone}
          onHome={() => home()}
          onEdit={() => home(true)}
          onRetry={() => generate({ text: run.text, mode: run.mode })}
          onRegenerate={regenerate}
          onSwitch={switchMode}
          onSave={keep}
          onShare={share}
        />
      ) : (
        <Prompt intro={intro} draft={draft} works={count} onWorks={openWorks} onGenerate={generate} onWarm={engine} />
      )}
      <Works open={shelf.open} items={shelf.items} onClose={closeWorks} onOpen={openWork} onRemove={drop} />
      <Notice message={note} />
    </main>
  );
}
