const ease = (t) => t * t * (3 - 2 * t);

function grain(paper) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = paper;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function plotter(base, live, pencil, picture, { width = 1500, height = 1000, dpr = 1, margin = [56, 46] } = {}) {
  const { lines, pal } = picture;
  for (const l of lines) {
    const n = l.pts.length / 2;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(l.pts[i * 2] - l.pts[i * 2 - 2], l.pts[i * 2 + 1] - l.pts[i * 2 - 1]);
    l.cum = cum;
    l.total = cum[n - 1] || 0;
    l.end = l.t0 + l.dur;
    if (l.taper && n > 1) {
      l.nx = new Float32Array(n);
      l.ny = new Float32Array(n);
      l.hw = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(n - 1, i + 1);
        const tx = l.pts[b * 2] - l.pts[a * 2];
        const ty = l.pts[b * 2 + 1] - l.pts[a * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        l.nx[i] = -ty / tl;
        l.ny[i] = tx / tl;
        const u = l.total ? cum[i] / l.total : 0.5;
        l.hw[i] = (l.width / 2) * (0.28 + 0.72 * Math.sin(Math.PI * u) ** 0.45);
      }
    }
  }
  const byStart = [...lines].sort((a, b) => a.t0 - b.t0);
  const bctx = base.getContext("2d");
  const lctx = live.getContext("2d");
  const pctx = pencil.getContext("2d");
  const texture = grain(pal.paper);
  let next = 0;
  let active = [];
  let saved = false;

  const setup = (ctx) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const clipFrame = (ctx) => {
    ctx.beginPath();
    ctx.rect(margin[0], margin[1], width - margin[0] * 2, height - margin[1] * 2);
    ctx.clip();
  };

  const path = (ctx, l, upto) => {
    const p = l.pts;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    const n = p.length / 2;
    for (let i = 1; i < n; i++) {
      if (l.cum[i] >= upto) {
        const s = l.cum[i] - l.cum[i - 1] || 1;
        const t = (upto - l.cum[i - 1]) / s;
        ctx.lineTo(p[i * 2 - 2] + (p[i * 2] - p[i * 2 - 2]) * t, p[i * 2 - 1] + (p[i * 2 + 1] - p[i * 2 - 1]) * t);
        break;
      }
      ctx.lineTo(p[i * 2], p[i * 2 + 1]);
    }
  };

  const ribbon = (ctx, l, upto) => {
    const p = l.pts;
    const n = p.length / 2;
    let k = n - 1;
    let ex = p[k * 2];
    let ey = p[k * 2 + 1];
    for (let i = 1; i < n; i++) {
      if (l.cum[i] >= upto) {
        const t = (upto - l.cum[i - 1]) / (l.cum[i] - l.cum[i - 1] || 1);
        k = i - 1;
        ex = p[k * 2] + (p[i * 2] - p[k * 2]) * t;
        ey = p[k * 2 + 1] + (p[i * 2 + 1] - p[k * 2 + 1]) * t;
        break;
      }
    }
    ctx.beginPath();
    ctx.moveTo(p[0] + l.nx[0] * l.hw[0], p[1] + l.ny[0] * l.hw[0]);
    for (let i = 1; i <= k; i++) ctx.lineTo(p[i * 2] + l.nx[i] * l.hw[i], p[i * 2 + 1] + l.ny[i] * l.hw[i]);
    const hk = l.hw[k];
    ctx.lineTo(ex + l.nx[k] * hk, ey + l.ny[k] * hk);
    ctx.lineTo(ex - l.nx[k] * hk, ey - l.ny[k] * hk);
    for (let i = k; i >= 0; i--) ctx.lineTo(p[i * 2] - l.nx[i] * l.hw[i], p[i * 2 + 1] - l.ny[i] * l.hw[i]);
    ctx.closePath();
    ctx.fill();
  };

  const stroke = (ctx, l, frac) => {
    ctx.globalAlpha = l.alpha;
    if (l.taper && l.hw) {
      ctx.fillStyle = l.pen;
      ribbon(ctx, l, l.total * frac);
      return;
    }
    ctx.strokeStyle = l.pen;
    ctx.lineWidth = l.width;
    path(ctx, l, l.total * frac);
    ctx.stroke();
  };

  const reset = () => {
    if (saved) {
      bctx.restore();
      pctx.restore();
    }
    setup(bctx);
    bctx.globalCompositeOperation = "source-over";
    bctx.globalAlpha = 1;
    bctx.fillStyle = bctx.createPattern(texture, "repeat");
    bctx.fillRect(0, 0, width, height);
    bctx.save();
    saved = true;
    clipFrame(bctx);
    bctx.globalCompositeOperation = "multiply";
    setup(lctx);
    lctx.clearRect(0, 0, width, height);
    setup(pctx);
    pctx.clearRect(0, 0, width, height);
    pctx.save();
    clipFrame(pctx);
    next = 0;
    active = [];
  };

  const draw = (t) => {
    while (next < byStart.length && byStart[next].t0 <= t) active.push(byStart[next++]);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, width, height);
    lctx.save();
    clipFrame(lctx);
    const still = [];
    for (const l of active) {
      if (t >= l.end) stroke(l.layer === "construct" ? pctx : bctx, l, 1);
      else {
        stroke(lctx, l, ease(Math.max(0, (t - l.t0) / l.dur)));
        still.push(l);
      }
    }
    active = still;
    lctx.restore();
  };

  const finish = () => {
    while (next < byStart.length) active.push(byStart[next++]);
    for (const l of active) stroke(l.layer === "construct" ? pctx : bctx, l, 1);
    active = [];
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, width, height);
  };

  reset();
  return { draw, reset, finish, end: picture.end };
}
