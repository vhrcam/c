import { createArt } from "../art/live";
import { createFlat } from "./flat";
import { normalizePlan } from "./plan";
import { W, createSpace } from "./space/world";

export { normalizePlan } from "./plan";

export const DURATION = W.end;

export function createArtwork(canvas, input, { mode, onPhase, onDone } = {}) {
  if (input?.art) return createArt(canvas, input, { onPhase, onDone });
  const plan = normalizePlan({ ...input, mode: mode || input?.mode });
  return plan.mode === "2d" ? createFlat(canvas, plan, { onPhase, onDone }) : createSpace(canvas, plan, { onPhase, onDone });
}
