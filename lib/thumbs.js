import { build } from "./paint/build";
import { renderFinal } from "./paint/player";

export function thumb(scene, width = 320) {
  return renderFinal(build(scene), width, { paper: true }).toDataURL("image/jpeg", 0.86);
}

const slug = (text) => (text || "painting").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "painting";

export async function download(scene) {
  const canvas = renderFinal(build(scene), 2700, { paper: true });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `c-${slug(scene.caption)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
