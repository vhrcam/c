"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { luma } from "@/lib/color";
import { list, remove, save } from "@/lib/gallery";
import { decode, encode } from "@/lib/share";
import { morph } from "./morph";
import Notice from "./Notice";
import Prompt, { MODES } from "./Prompt";
import Stage from "./Stage";
import Works from "./Works";

const engine = () => import("@/lib/engine");
const draw = () => import("@/lib/draw");
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// ask the director to block out the words; earlier holds how previous takes were staged so a new one differs.
// The answer streams: notes while it thinks and names things (onNote), then the score.
async function direct(text, earlier = [], onNote) {
  const res = await fetch("/api/art", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, earlier }), signal: AbortSignal.timeout(130000) });
  if (!res.ok || !res.body) throw new Error(`Art request failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (message.note) onNote?.(message.note);
      else if (message.plan) result = message;
    }
    if (done) break;
  }
  if (!result) throw new Error("The director sent no score");
  return { source: result.source, plan: { ...result.plan, mode: "2d" } };
}

// what has been heard from the director so far
const heard = (notes = { forms: [] }, note) => (note.reset ? { forms: [] } : note.form ? { ...notes, forms: [...notes.forms, note.form] } : { ...notes, ...note });

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

  const hear = (id) => (note) => setRun((r) => (r?.id === id && !r.plan ? { ...r, notes: heard(r.notes, note) } : r));

  const play = (plan) => {
    const id = ++ticket.current;
    const mode = MODES.includes(plan.mode) ? plan.mode : MODES[0];
    setIntro(false);
    setTone("");
    morph(() => {
      setView("stage");
      setRun({ id, text: plan.text, mode, plan: { ...plan, mode } });
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
      setRun((r) => (r?.id === id ? r : { id, text, mode, start, plan: null }));
    });
    try {
      if (mode === "2d") {
        const { plan, source } = await direct(text, [], hear(id));
        if (id === ticket.current) setRun({ id, text, mode, start, took: performance.now() - start, source, plan });
        return;
      }
      const [{ plan, source }, { normalizePlan }] = await Promise.all([interpret(text, mode), engine()]);
      if (id === ticket.current) setRun({ id, text, mode, start, took: performance.now() - start, source, plan: normalizePlan({ ...plan, text: plan?.text || text, mode }) });
    } catch {
      if (id === ticket.current) setRun({ id, text, mode, start, plan: null, failed: true });
    }
  };

  // a new take: the director stages the same words again, differently; if it can't be reached, c recuts the last staging
  const regenerate = async () => {
    const id = ++ticket.current;
    const last = run.plan;
    if (last.v !== 2) return setRun({ ...run, id, plan: { ...last, seed: newSeed() } });
    const takes = [...(run.takes || []), last.layout || last.reading].filter(Boolean);
    const start = performance.now();
    setTone("");
    morph(() => setRun({ id, text: run.text, mode: run.mode, start, plan: null, takes }));
    try {
      const { plan, source } = last.text ? await direct(last.text, takes, hear(id)) : { plan: null };
      if (id !== ticket.current) return;
      const fresh = plan && (source === "ai" || run.source !== "ai");
      setRun({ id, text: run.text, mode: run.mode, start, took: performance.now() - start, takes, source: fresh ? source : run.source, plan: fresh ? plan : { ...last, seed: newSeed() } });
    } catch {
      if (id === ticket.current) setRun({ id, text: run.text, mode: run.mode, start, took: performance.now() - start, takes, source: run.source, plan: { ...last, seed: newSeed() } });
    }
  };

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
          onSwitch={MODES.length > 1 ? switchMode : null}
          onSave={keep}
          onShare={share}
        />
      ) : (
        <Prompt intro={intro} draft={draft} works={count} onWorks={openWorks} onGenerate={generate} onWarm={draw} />
      )}
      <Works open={shelf.open} items={shelf.items} onClose={closeWorks} onOpen={openWork} onRemove={drop} />
      <Notice message={note} />
    </main>
  );
}
