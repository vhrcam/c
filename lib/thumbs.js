export async function thumb(blob, width = 480) {
  const image = await createImageBitmap(blob);
  const k = Math.min(1, width / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * k);
  canvas.height = Math.round(image.height * k);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

const slug = (text) => (text || "artwork").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "artwork";

export function download(blob, title) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `c-${slug(title)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
