import { hash, random } from "../random.js";

// Slice a height field into level lines. Every region of the picture shares one field F, so the whole image is cut
// by one family of planes; a region's tone decides how many of the cuts it keeps and how wide each one is inked.
export function slice(G, F, A, regions, { delta = 0.2, seed = 1, sub = null } = {}) {
  const { nw, gw, gh, rid, gid, RES } = G;
  let cap = 1 << 18;
  let count = 0;
  let level = new Int32Array(cap);
  let ea = new Int32Array(cap);
  let eb = new Int32Array(cap);
  let xy = new Float32Array(cap * 4);
  let wide = new Float32Array(cap);
  let reg = new Uint16Array(cap);
  let part = new Uint8Array(cap);
  const grow = () => {
    cap *= 2;
    const next = (old, Type, k = 1) => {
      const a = new Type(cap * k);
      a.set(old);
      return a;
    };
    level = next(level, Int32Array);
    ea = next(ea, Int32Array);
    eb = next(eb, Int32Array);
    xy = next(xy, Float32Array, 4);
    wide = next(wide, Float32Array);
    reg = next(reg, Uint16Array);
    part = next(part, Uint8Array);
  };
  let minLevel = Infinity;
  let maxLevel = -Infinity;

  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * nw + i;
      let r = rid[k];
      const r1 = rid[k + 1];
      const r2 = rid[k + nw];
      const r3 = rid[k + nw + 1];
      if (r1 !== r || r2 !== r || r3 !== r) {
        // parts of one body share a field, so a cut may run across them; anything else breaks the line
        const g = gid[r];
        if (!g || gid[r1] !== g || gid[r2] !== g || gid[r3] !== g) continue;
        r = Math.max(r, r1, r2, r3);
      }
      const R = regions[r];
      if (!R || !R.on) continue;
      const a = (A[k] + A[k + 1] + A[k + nw] + A[k + nw + 1]) / 4;
      if (a < 0.015) continue;
      const v0 = F[k];
      const v1 = F[k + 1];
      const v2 = F[k + nw + 1];
      const v3 = F[k + nw];
      const lo = Math.min(v0, v1, v2, v3);
      const hi = Math.max(v0, v1, v2, v3);
      if (hi - lo < 1e-7) continue;
      const g = Math.hypot(v1 + v2 - v0 - v3, v3 + v2 - v0 - v1) * 0.5 * RES || 1e-6;
      const space = (delta * (1 << R.j0)) / g;
      let up = 0;
      while (a * space * (1 << up) < R.wlo && up < 7) up++;
      if (a * space * (1 << up) < R.wlo * 0.55) continue;
      const step = 1 << (R.j0 + up);
      const w = Math.min(a * space * (1 << up), R.whi);
      const from = Math.ceil(lo / delta);
      const to = Math.floor(hi / delta);
      for (let n = from; n <= to; n++) {
        if (((n % step) + step) % step) continue;
        const L = n * delta;
        if (L === lo || L === hi) continue;
        const b = (v0 > L ? 1 : 0) | (v1 > L ? 2 : 0) | (v2 > L ? 4 : 0) | (v3 > L ? 8 : 0);
        if (!b || b === 15) continue;
        const top = () => [k * 2, i + (L - v0) / (v1 - v0), j];
        const bottom = () => [(k + nw) * 2, i + (L - v3) / (v2 - v3), j + 1];
        const left = () => [k * 2 + 1, i, j + (L - v0) / (v3 - v0)];
        const right = () => [(k + 1) * 2 + 1, i + 1, j + (L - v1) / (v2 - v1)];
        let pairs;
        switch (b) {
          case 1:
          case 14:
            pairs = [[left(), top()]];
            break;
          case 2:
          case 13:
            pairs = [[top(), right()]];
            break;
          case 3:
          case 12:
            pairs = [[left(), right()]];
            break;
          case 4:
          case 11:
            pairs = [[right(), bottom()]];
            break;
          case 6:
          case 9:
            pairs = [[top(), bottom()]];
            break;
          case 7:
          case 8:
            pairs = [[left(), bottom()]];
            break;
          default: {
            const mid = (v0 + v1 + v2 + v3) / 4 > L;
            pairs = (b === 5) === mid ? [[left(), bottom()], [top(), right()]] : [[left(), top()], [right(), bottom()]];
          }
        }
        for (const [p, q] of pairs) {
          if (count === cap) grow();
          level[count] = n;
          ea[count] = p[0];
          eb[count] = q[0];
          xy[count * 4] = p[1] / RES;
          xy[count * 4 + 1] = p[2] / RES;
          xy[count * 4 + 2] = q[1] / RES;
          xy[count * 4 + 3] = q[2] / RES;
          wide[count] = w;
          reg[count] = r;
          if (sub) part[count] = sub[k];
          count++;
        }
        if (n < minLevel) minLevel = n;
        if (n > maxLevel) maxLevel = n;
      }
    }
  if (!count) return [];

  // gather by level, then walk each level's segments edge to edge into chains
  const levels = maxLevel - minLevel + 1;
  const start = new Int32Array(levels + 1);
  for (let s = 0; s < count; s++) start[level[s] - minLevel + 1]++;
  for (let l = 0; l < levels; l++) start[l + 1] += start[l];
  const order = new Int32Array(count);
  const fillAt = start.slice(0, levels);
  for (let s = 0; s < count; s++) order[fillAt[level[s] - minLevel]++] = s;

  const edges = (G.nw * G.nh + 1) * 2;
  const slotA = new Int32Array(edges).fill(-1);
  const slotB = new Int32Array(edges).fill(-1);
  const stamp = new Int32Array(edges).fill(-1);
  const done = new Uint8Array(count);
  const strokes = [];
  const put = (e, s, l) => {
    if (stamp[e] !== l) {
      stamp[e] = l;
      slotA[e] = s;
      slotB[e] = -1;
    } else slotB[e] = s;
  };
  const other = (e, s, l) => (stamp[e] !== l ? -1 : slotA[e] === s ? slotB[e] : slotA[e]);

  for (let l = 0; l < levels; l++) {
    const a = start[l];
    const b = start[l + 1];
    if (a === b) continue;
    for (let q = a; q < b; q++) {
      put(ea[order[q]], order[q], l);
      put(eb[order[q]], order[q], l);
    }
    for (let q = a; q < b; q++) {
      const first = order[q];
      if (done[first]) continue;
      done[first] = 1;
      // walk forward from the b end, then backward from the a end
      const fwd = [];
      let s = first;
      let e = eb[s];
      for (;;) {
        const nx = other(e, s, l);
        if (nx < 0 || done[nx]) break;
        done[nx] = 1;
        const flip = eb[nx] === e;
        fwd.push(flip ? -nx - 1 : nx);
        e = flip ? ea[nx] : eb[nx];
        s = nx;
      }
      const back = [];
      s = first;
      e = ea[s];
      for (;;) {
        const nx = other(e, s, l);
        if (nx < 0 || done[nx]) break;
        done[nx] = 1;
        const flip = ea[nx] === e;
        back.push(flip ? -nx - 1 : nx);
        e = flip ? eb[nx] : ea[nx];
        s = nx;
      }
      const chain = [...back.reverse(), first, ...fwd];
      emit(chain, l + minLevel);
    }
  }

  function emit(chain, n) {
    // cut the chain where the region changes, then each piece becomes one stroke
    let from = 0;
    const idx = (c) => (c < 0 ? -c - 1 : c);
    for (let c = 1; c <= chain.length; c++) {
      if (c < chain.length && reg[idx(chain[c])] === reg[idx(chain[from])] && part[idx(chain[c])] === part[idx(chain[from])]) continue;
      piece(chain, from, c, n);
      from = c;
    }
  }

  function piece(chain, from, to, n) {
    const head = chain[from] < 0 ? -chain[from] - 1 : chain[from];
    const r = reg[head];
    const R = regions[r];
    const len = to - from;
    const pts = new Float32Array((len + 1) * 2);
    const ws = new Float32Array(len + 1);
    for (let c = from; c < to; c++) {
      const raw = chain[c];
      const s = raw < 0 ? -raw - 1 : raw;
      const o = c - from;
      const rev = raw < 0;
      const x0 = xy[s * 4 + (rev ? 2 : 0)];
      const y0 = xy[s * 4 + (rev ? 3 : 1)];
      const x1 = xy[s * 4 + (rev ? 0 : 2)];
      const y1 = xy[s * 4 + (rev ? 1 : 3)];
      if (!o) {
        pts[0] = x0;
        pts[1] = y0;
        ws[0] = wide[s];
      }
      pts[(o + 1) * 2] = x1;
      pts[(o + 1) * 2 + 1] = y1;
      ws[o + 1] = wide[s];
      if (o) ws[o] = (ws[o] + wide[s]) / 2;
    }
    dash(pts, ws, R, r, n, part[head]);
  }

  function dash(pts, ws, R, r, n, sb) {
    const total = pts.length / 2;
    const rand = random(hash(`${seed}:${r}:${n}:${sb}`));
    const ink = (x, y) => R.ink(n, x, y, rand, sb);
    if (!R.rest) return push(pts, ws, 0, total, R, r, ink);
    const runOn = () => R.run * (0.35 + rand() * 1.6);
    const runOff = () => R.rest * (0.3 + rand() * 1.5);
    let on = rand() < R.run / (R.run + R.rest);
    let run = (on ? runOn() : runOff()) * rand();
    let acc = 0;
    let begin = 0;
    for (let i = 1; i < total; i++) {
      acc += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
      if (acc < run && i < total - 1) continue;
      if (on) push(pts, ws, begin, i + 1, R, r, ink);
      on = !on;
      begin = i;
      acc = 0;
      run = on ? runOn() : runOff();
    }
  }

  function push(pts, ws, from, to, R, r, ink) {
    if (to - from < 2) return;
    let p = pts.subarray(from * 2, to * 2);
    let w = ws.subarray(from, to);
    let len = 0;
    for (let i = 1; i < to - from; i++) len += Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
    if (len < (R.min ?? 0.5)) return;
    const half = (to - from) >> 1;
    const mx = p[half * 2];
    const my = p[half * 2 + 1];
    if (p[0] > p[p.length - 2]) {
      const rp = new Float32Array(p.length);
      const rw = new Float32Array(w.length);
      for (let i = 0; i < w.length; i++) {
        rp[i * 2] = p[(w.length - 1 - i) * 2];
        rp[i * 2 + 1] = p[(w.length - 1 - i) * 2 + 1];
        rw[i] = w[w.length - 1 - i];
      }
      p = rp;
      w = rw;
    }
    // ease the width along the line so strokes swell and taper instead of stepping
    const sw = new Float32Array(w.length);
    let lo = Infinity;
    let hi = 0;
    for (let i = 0; i < w.length; i++) {
      let sum = 0;
      let cnt = 0;
      for (let q = Math.max(0, i - 3); q <= Math.min(w.length - 1, i + 3); q++) {
        sum += w[q];
        cnt++;
      }
      sw[i] = sum / cnt;
      if (sw[i] < lo) lo = sw[i];
      if (sw[i] > hi) hi = sw[i];
    }
    const even = hi - lo < hi * 0.18;
    const [tp, tw] = thin(p, sw, 0.022);
    strokes.push({ p: tp, w: even ? (lo + hi) / 2 : tw, ink: ink(mx, my), r, len, kind: "slice" });
  }

  return strokes;
}

// drop points that sit on a straight run (Ramer-Douglas-Peucker), keeping a point too when the width turns there
export function thin(p, w, tolerance) {
  const n = w.length;
  if (n < 3) return [p, w];
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const ax = p[a * 2];
    const ay = p[a * 2 + 1];
    const dx = p[b * 2] - ax;
    const dy = p[b * 2 + 1] - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let worst = -1;
    let far = t2;
    let odd = -1;
    let off = 0.012;
    for (let i = a + 1; i < b; i++) {
      const px = p[i * 2] - ax;
      const py = p[i * 2 + 1] - ay;
      const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
      const ex = px - dx * t;
      const ey = py - dy * t;
      const d = ex * ex + ey * ey;
      if (d > far) {
        far = d;
        worst = i;
      }
      const dw = Math.abs(w[i] - (w[a] + (w[b] - w[a]) * t));
      if (dw > off) {
        off = dw;
        odd = i;
      }
    }
    const cut = worst > 0 ? worst : odd;
    if (cut > 0) {
      keep[cut] = 1;
      stack.push([a, cut], [cut, b]);
    }
  }
  let m = 0;
  for (let i = 0; i < n; i++) m += keep[i];
  const op = new Float32Array(m * 2);
  const ow = new Float32Array(m);
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    op[c * 2] = p[i * 2];
    op[c * 2 + 1] = p[i * 2 + 1];
    ow[c++] = w[i];
  }
  return [op, ow];
}
