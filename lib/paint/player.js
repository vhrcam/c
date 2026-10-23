import { luma, toHex } from "../color.js";
import { noise, random } from "../random.js";
import { H, W, ease } from "./brush.js";
import { LOGO_BOX, drawC } from "./logo.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function posterize(ctx, width, height, levels = 10) {
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const step = 255 / (levels - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * step;
      d[i] = Math.round((d[i] + t) / step) * step;
      d[i + 1] = Math.round((d[i + 1] + t) / step) * step;
      d[i + 2] = Math.round((d[i + 2] + t) / step) * step;
      d[i + 3] = d[i + 3] > 110 ? 255 : 0;
    }
  }
  ctx.putImageData(image, 0, 0);
}

const surface = (w, h) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

function edgeMask(width, height, seed) {
  const r = random(seed);
  const n = noise(seed);
  const low = surface(120, 80);
  const c = low.getContext("2d");
  c.setTransform(120 / W, 0, 0, 80 / H, 0, 0);
  const inset = [50, 38];
  let walk = 0;
  const edge = (x, y, nx, ny) => {
    walk += 0.09;
    const d = 6 + (n(walk, 3) - 0.5) * 26 + r.gauss() * 2;
    return [x + nx * d, y + ny * d];
  };
  const pts = [];
  for (let x = inset[0]; x < W - inset[0]; x += 20) pts.push(edge(x, inset[1], 0, 1));
  for (let y = inset[1]; y < H - inset[1]; y += 20) pts.push(edge(W - inset[0], y, -1, 0));
  for (let x = W - inset[0]; x > inset[0]; x -= 20) pts.push(edge(x, H - inset[1], 0, -1));
  for (let y = H - inset[1]; y > inset[1]; y -= 20) pts.push(edge(inset[0], y, 1, 0));
  c.fillStyle = "#fff";
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.fill();
  const out = surface(width, height);
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = "high";
  o.drawImage(low, 0, 0, width, height);
  return out;
}

export class Player {
  constructor(view, { onState, width } = {}) {
    this.view = view;
    this.onState = onState;
    this.width = width;
    this.speed = 1;
    this.t = 0;
    this.playing = false;
    this.raf = 0;
    this.loop = this.loop.bind(this);
  }

  load(painting, { from = 0, fade = false, show = false } = {}) {
    const old = fade && this.frame ? surface(this.frame.width, this.frame.height) : null;
    if (old) old.getContext("2d").drawImage(this.frame, 0, 0);
    this.strokes?.forEach((s) => (s.cache = null));
    this.painting = painting;
    this.strokes = painting.strokes.map((s) => ({ ...s, cache: null }));
    this.sign = { ...painting.sign, ink: null };
    this.end = painting.end;
    if (from > 0) this.compress(from);
    this.fade = old ? { image: old, until: 0.45 } : null;
    this.setup(true);
    this.t = show ? this.end : 0;
    this.playing = !show;
    this.emit();
    if (show) this.render();
    else this.kick();
  }

  compress(from) {
    const tail = this.strokes.slice(from);
    const first = Math.min(...tail.map((s) => s.t0), this.sign.t0);
    const last = Math.max(...tail.map((s) => s.t0 + s.dur), this.sign.t0 + this.sign.dur);
    const k = Math.min(1, 6 / Math.max(0.1, last - first));
    this.strokes.forEach((s, i) => {
      if (i < from) {
        s.t0 = -1;
        s.dur = 0.001;
      } else {
        s.t0 = 0.45 + (s.t0 - first) * k;
        s.dur = Math.max(0.05, s.dur * k);
      }
    });
    this.sign.t0 = 0.45 + (this.sign.t0 - first) * k;
    this.sign.dur = 0.85;
    this.end = this.sign.t0 + this.sign.dur + 0.3;
  }

  setup(fresh = false) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const max = document.fullscreenElement ? 3840 : 2600;
    const vw = this.width || Math.min(max, Math.round((this.view.clientWidth || 1000) * dpr));
    const vh = Math.round((vw * H) / W);
    const resized = this.view.width !== vw || this.view.height !== vh;
    if (resized) {
      this.view.width = vw;
      this.view.height = vh;
    }
    const fw = this.painting.pixel ? Math.round(W / this.painting.pixel) : vw;
    if (!this.frame || this.frame.width !== fw || fresh || resized) {
      if (!this.frame || this.frame.width !== fw) {
        this.frame = surface(fw, (fw * H) / W);
        this.frame.getContext("2d", { willReadFrequently: Boolean(this.painting.pixel) });
        this.baked = surface(fw, (fw * H) / W);
      }
      this.baked.getContext("2d").clearRect(0, 0, this.baked.width, this.baked.height);
      this.k = 0;
      this.strokes.forEach((s) => (s.cache = null));
      this.edges = this.painting.soft ? edgeMask(this.frame.width, this.frame.height, this.painting.scene.seed) : null;
    }
    this.scale = this.frame.width / W;
  }

  resize() {
    if (!this.painting || !this.view.clientWidth) return;
    this.setup();
    this.render();
    if (this.playing) this.kick();
  }

  emit() {
    this.onState?.({ playing: this.playing, done: this.t >= this.end, speed: this.speed, t: this.t, end: this.end });
  }

  kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  loop(now) {
    this.raf = 0;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.playing) this.t = Math.min(this.end, this.t + dt * this.speed);
    this.render();
    this.ahead(now);
    if (this.playing && this.t >= this.end) {
      this.playing = false;
      this.emit();
    } else if (this.playing) this.raf = requestAnimationFrame(this.loop);
  }

  play() {
    if (this.t >= this.end) return this.replay();
    this.playing = true;
    this.emit();
    this.kick();
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  setSpeed(speed) {
    this.speed = speed;
    this.emit();
  }

  skip() {
    const target = this.t < this.sign.t0 - 0.3 ? this.sign.t0 - 0.3 : this.end;
    this.t = target;
    this.playing = target < this.end;
    this.render();
    this.emit();
    if (this.playing) this.kick();
  }

  replay() {
    this.load(this.painting);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playing = false;
  }

  prepare(st) {
    if (st.cache && st.cache.scale === this.scale) return st.cache;
    const s = this.scale;
    const [x, y, w, h] = st.area;
    const ox = Math.floor(x * s);
    const oy = Math.floor(y * s);
    const image = surface(w * s + 2, h * s + 2);
    const c = image.getContext("2d");
    c.setTransform(s, 0, 0, s, -ox, -oy);
    st.paint(c);
    st.cache = { scale: s, image, ox, oy };
    return st.cache;
  }

  masked(st, sp, p) {
    const s = this.scale;
    const [x, y, w, h] = st.area;
    const f = st.feather || 7;
    const mw = Math.max(2, Math.ceil(w / f));
    const mh = Math.max(2, Math.ceil(h / f));
    sp.mask ??= surface(mw, mh);
    sp.temp ??= surface(sp.image.width, sp.image.height);
    const m = sp.mask.getContext("2d");
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, mw, mh);
    m.setTransform(mw / w, 0, 0, mh / h, (-x * mw) / w, (-y * mh) / h);
    m.fillStyle = "#fff";
    m.strokeStyle = "#fff";
    st.reveal(m, p, st.area);
    if (p > 0.9) {
      m.globalAlpha = (p - 0.9) / 0.1;
      m.fillRect(x - 10, y - 10, w + 20, h + 20);
      m.globalAlpha = 1;
    }
    const t = sp.temp.getContext("2d");
    t.globalCompositeOperation = "copy";
    t.drawImage(sp.image, 0, 0);
    t.globalCompositeOperation = "destination-in";
    t.imageSmoothingEnabled = true;
    t.drawImage(sp.mask, x * s - sp.ox, y * s - sp.oy, w * s, h * s);
    t.globalCompositeOperation = "source-over";
    return sp.temp;
  }

  paint(ctx, st, p) {
    if (st.type === "vector") {
      ctx.save();
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      st.draw(ctx, p);
      ctx.restore();
      return;
    }
    const sp = this.prepare(st);
    const image = p >= 1 ? sp.image : this.masked(st, sp, p);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = st.blend || "source-over";
    ctx.globalAlpha = st.alpha ?? 1;
    ctx.drawImage(image, sp.ox, sp.oy);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  ahead(now) {
    const budget = now + 7;
    for (let i = this.k; i < this.strokes.length && performance.now() < budget; i++) {
      const st = this.strokes[i];
      if (st.t0 > this.t + 3) break;
      if (st.type === "sprite" && !st.cache) this.prepare(st);
    }
  }

  render() {
    const { t, strokes } = this;
    const b = this.baked.getContext("2d");
    while (this.k < strokes.length && strokes[this.k].t0 + strokes[this.k].dur <= t) {
      this.paint(b, strokes[this.k], 1);
      strokes[this.k].cache = null;
      this.k++;
    }
    const f = this.frame.getContext("2d");
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = "copy";
    f.drawImage(this.baked, 0, 0);
    f.globalCompositeOperation = "source-over";
    for (let i = this.k; i < strokes.length; i++) {
      const st = strokes[i];
      if (t > st.t0) this.paint(f, st, Math.min(1, (t - st.t0) / st.dur));
    }
    f.setTransform(1, 0, 0, 1, 0, 0);
    if (this.fade && t < this.fade.until) {
      f.globalAlpha = 1 - t / this.fade.until;
      f.drawImage(this.fade.image, 0, 0, this.frame.width, this.frame.height);
      f.globalAlpha = 1;
    }
    if (this.edges) {
      f.globalCompositeOperation = "destination-in";
      f.drawImage(this.edges, 0, 0);
      f.globalCompositeOperation = "source-over";
    }
    if (this.painting.pixel) posterize(f, this.frame.width, this.frame.height);
    const v = this.view.getContext("2d");
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.clearRect(0, 0, this.view.width, this.view.height);
    v.imageSmoothingEnabled = !this.painting.pixel;
    v.drawImage(this.frame, 0, 0, this.view.width, this.view.height);
    this.signature(v, t);
  }

  ink() {
    const s = this.scale;
    const { x, y, w } = this.sign;
    const data = this.frame.getContext("2d").getImageData(Math.floor(x * s), Math.floor(y * s), Math.max(1, Math.ceil(w * s)), Math.max(1, Math.ceil(w * 0.6 * s))).data;
    const paper = [229, 225, 216];
    let sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) sum[c] += data[i + c] * a + paper[c] * (1 - a);
    }
    const n = data.length / 4;
    return luma(toHex(sum.map((v) => v / n))) > 0.48 ? "26,25,22" : "243,238,228";
  }

  signature(v, t) {
    const sg = this.sign;
    if (t < sg.t0) return;
    sg.ink ??= this.ink();
    const k = v.canvas.width / W;
    const scale = (sg.w / LOGO_BOX.w) * k;
    v.save();
    v.translate(sg.x * k, sg.y * k);
    v.rotate(sg.rot);
    v.scale(scale, scale);
    v.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    drawC(v, ease(Math.min(1, (t - sg.t0) / sg.dur)), { seed: sg.seed, bristles: 16, rgb: sg.ink, alpha: 0.92 });
    v.restore();
  }
}

export function renderFinal(painting, width, { paper = false } = {}) {
  const view = surface(width, (width * H) / W);
  const player = new Player(view, { width });
  player.load(painting, { show: true });
  if (!paper) return view;
  const out = surface(view.width, view.height);
  const o = out.getContext("2d");
  o.fillStyle = "#e5e1d8";
  o.fillRect(0, 0, out.width, out.height);
  const r = random(painting.scene.seed);
  for (let i = 0; i < (out.width * out.height) / 90; i++) {
    o.fillStyle = `rgba(26,24,20,${r() * 0.05})`;
    o.fillRect(r() * out.width, r() * out.height, 1.2, 1.2);
  }
  o.drawImage(view, 0, 0);
  return out;
}
