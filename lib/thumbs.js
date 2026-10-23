import { build } from "./paint/build";
import { renderFinal } from "./paint/player";

export function thumb(scene, width = 320) {
  return renderFinal(build(scene), width, { paper: true }).toDataURL("image/jpeg", 0.86);
}
