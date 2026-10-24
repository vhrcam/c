function regions(w, h, inside, same) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const dist = new Float32Array(n);
  const comp = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  const list = [];
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (seen[i] || !inside(i)) continue;
      const id = list.length;
      let head = 0;
      let tail = 0;
      let max = 0;
      queue[tail++] = i;
      seen[i] = 1;
      comp[i] = id;
      while (head < tail) {
        const j = queue[head++];
        const jx = j % w;
        const jy = (j - jx) / w;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = jx + dx;
            const ny = jy + dy;
            if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const k = ny * w + nx;
            if (seen[k] || !inside(k) || !same(j, k)) continue;
            seen[k] = 1;
            comp[k] = id;
            dist[k] = dist[j] + (dx && dy ? 1.414 : 1);
            if (dist[k] > max) max = dist[k];
            queue[tail++] = k;
          }
        }
      }
      list.push({ seed: i, max, size: tail });
    }
  }
  return { dist, comp, list };
}

const ORDER = { 2: 0, 3: 0.04, 1: 0.2, 4: 0.36, 6: 0.38, 5: 0.5 };

export function arrivals(mask, w, h) {
  const n = w * h;
  const line = new Uint8Array(n);
  const mat = new Uint8Array(n);
  const cover = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    line[i] = mask[i * 4] > 90 ? 1 : 0;
    mat[i] = Math.round((mask[i * 4 + 1] / 255) * 16);
    cover[i] = mask[i * 4 + 2] > 127 ? 1 : 0;
  }
  const out = new Float32Array(n * 2).fill(2);

  const L = regions(w, h, (i) => line[i] === 1, () => true);
  const longest = Math.max(1, ...L.list.map((c) => c.max));
  const big = L.list.filter((c) => c.size > 12);
  big.forEach((c, i) => {
    c.start = (i / Math.max(1, big.length - 1)) * 0.6;
    c.span = 0.36 * Math.sqrt(c.max / longest) + 0.04;
  });
  for (let i = 0; i < n; i++) {
    if (!line[i]) continue;
    const c = L.list[L.comp[i]];
    out[i * 2] = c.start === undefined ? 0.95 : Math.min(1, c.start + (L.dist[i] / Math.max(1, c.max)) * c.span);
  }

  const F = regions(w, h, (i) => cover[i] === 1, (a, b) => mat[a] === mat[b]);
  for (let i = 0; i < n; i++) {
    if (!cover[i]) continue;
    const c = F.list[F.comp[i]];
    const start = ORDER[mat[c.seed]] ?? 0.5;
    out[i * 2 + 1] = Math.min(1, start + (F.dist[i] / Math.max(1, c.max)) * 0.48);
  }
  return out;
}
