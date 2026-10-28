import { compose } from "./compose";
import { plotter } from "./plotter";

export { compose } from "./compose";

const layer = (w, h, dpr) => {
  const c = document.createElement("canvas");
  c.width = w * dpr;
  c.height = h * dpr;
  return c;
};

export function still(spec, seed, scale = 0.5) {
  const picture = compose(spec, seed);
  const { width: w, height: h } = picture;
  const base = layer(w, h, scale);
  const pencil = layer(w, h, scale);
  const live = layer(w, h, scale);
  plotter(base, live, pencil, picture, { width: w, height: h, dpr: scale }).finish();
  const ctx = base.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(pencil, 0, 0);
  base.picture = picture;
  return base;
}

export function mount(host, spec, seed) {
  const picture = compose(spec, seed);
  const { width: w, height: h } = picture;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvases = [layer(w, h, dpr), layer(w, h, dpr), layer(w, h, dpr)];
  const [base, pencil, live] = canvases;
  for (const c of canvases) {
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    host.appendChild(c);
  }
  pencil.style.mixBlendMode = "multiply";
  const plot = plotter(base, live, pencil, picture, { width: w, height: h, dpr });
  const start = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const t = (now - start) / 1000;
    plot.draw(t);
    if (t < picture.end) frame = requestAnimationFrame(tick);
  });
  return () => {
    cancelAnimationFrame(frame);
    for (const c of canvases) c.remove();
  };
}
