export function streamlines(vec, { w, h, sep, test = sep * 0.55, step = sep * 0.3, maxSteps = 600, minLen = sep * 3, inside = () => true, rand, seedGap = sep }) {
  const cell = sep;
  const gw = Math.ceil(w / cell) + 1;
  const grid = new Map();
  const near = (x, y, d) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const b = grid.get((cy + j) * gw + cx + i);
        if (b) for (let k = 0; k < b.length; k += 2) if ((b[k] - x) ** 2 + (b[k + 1] - y) ** 2 < d * d) return true;
      }
    return false;
  };
  const add = (pts) => {
    for (let k = 0; k < pts.length; k += 2) {
      const key = Math.floor(pts[k + 1] / cell) * gw + Math.floor(pts[k] / cell);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(pts[k], pts[k + 1]);
    }
  };
  const trace = (x, y, dir) => {
    const out = [];
    for (let s = 0; s < maxSteps; s++) {
      const a = vec(x, y);
      const la = Math.hypot(a[0], a[1]);
      if (la < 1e-6) break;
      const mx = x + (dir * a[0] / la) * step * 0.5;
      const my = y + (dir * a[1] / la) * step * 0.5;
      const b = vec(mx, my);
      const lb = Math.hypot(b[0], b[1]) || 1;
      x += (dir * b[0] / lb) * step;
      y += (dir * b[1] / lb) * step;
      if (x < 0 || y < 0 || x > w || y > h || !inside(x, y) || near(x, y, test)) break;
      out.push(x, y);
    }
    return out;
  };
  const seeds = [];
  for (let y = seedGap / 2; y < h; y += seedGap) for (let x = seedGap / 2; x < w; x += seedGap) seeds.push([x + (rand() - 0.5) * seedGap, y + (rand() - 0.5) * seedGap]);
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  const lines = [];
  for (const [x, y] of seeds) {
    if (!inside(x, y) || near(x, y, sep)) continue;
    const back = trace(x, y, -1);
    const fwd = trace(x, y, 1);
    const pts = [];
    for (let k = back.length - 2; k >= 0; k -= 2) pts.push(back[k], back[k + 1]);
    pts.push(x, y, ...fwd);
    let len = 0;
    for (let k = 2; k < pts.length; k += 2) len += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    if (len < minLen) continue;
    add(pts);
    lines.push({ pts, len, x, y });
  }
  return lines;
}

export function isolines(F, { w, h, cell, levels }) {
  const gw = Math.ceil(w / cell) + 1;
  const gh = Math.ceil(h / cell) + 1;
  const v = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) v[j * gw + i] = F(i * cell, j * cell);
  const out = [];
  for (const level of levels) {
    const segs = [];
    for (let j = 0; j < gh - 1; j++)
      for (let i = 0; i < gw - 1; i++) {
        const a = v[j * gw + i];
        const b = v[j * gw + i + 1];
        const c = v[(j + 1) * gw + i + 1];
        const d = v[(j + 1) * gw + i];
        const code = (a > level) | ((b > level) << 1) | ((c > level) << 2) | ((d > level) << 3);
        if (code === 0 || code === 15) continue;
        const x = i * cell;
        const y = j * cell;
        const t = (p, q) => (level - p) / (q - p || 1e-9);
        const top = [x + t(a, b) * cell, y];
        const right = [x + cell, y + t(b, c) * cell];
        const bottom = [x + t(d, c) * cell, y + cell];
        const left = [x, y + t(a, d) * cell];
        const E = { 1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]], 5: [[left, top], [right, bottom]], 6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]], 9: [[bottom, top]], 10: [[top, right], [bottom, left]], 11: [[bottom, right]], 12: [[right, left]], 13: [[right, top]], 14: [[top, left]] }[code];
        segs.push(...E);
      }
    for (const pts of join(segs)) out.push({ pts, level });
  }
  return out;
}

function join(segs) {
  const key = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
  const ends = new Map();
  const used = new Uint8Array(segs.length);
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(i);
    }
  });
  const lines = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const chain = [segs[i][0], segs[i][1]];
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? chain[chain.length - 1] : chain[0];
        const nextIdx = (ends.get(key(tip)) || []).find((j) => !used[j]);
        if (nextIdx === undefined) break;
        used[nextIdx] = 1;
        const s = segs[nextIdx];
        const other = key(s[0]) === key(tip) ? s[1] : s[0];
        if (atEnd) chain.push(other);
        else chain.unshift(other);
      }
    }
    lines.push(chain.flat());
  }
  return lines;
}

export function colonize({ roots, attractors, influence, kill, step, iterations = 160 }) {
  const nodes = roots.map((r, k) => ({ root: k, x: r.x, y: r.y, parent: -1, dx: r.dx ?? 0, dy: r.dy ?? -1, weight: 0, kids: 0, depth: 0 }));
  let live = attractors.slice();
  for (let it = 0; it < iterations && live.length; it++) {
    const pull = new Map();
    for (const a of live) {
      let best = -1;
      let bd = influence * influence;
      for (let n = 0; n < nodes.length; n++) {
        const d = (nodes[n].x - a[0]) ** 2 + (nodes[n].y - a[1]) ** 2;
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best < 0) continue;
      const d = Math.sqrt(bd) || 1;
      const p = pull.get(best) || [0, 0];
      p[0] += (a[0] - nodes[best].x) / d;
      p[1] += (a[1] - nodes[best].y) / d;
      pull.set(best, p);
    }
    if (!pull.size) {
      for (const n of nodes.filter((m) => m.kids === 0 && m.depth < 400)) {
        nodes.push({ root: n.root, x: n.x + n.dx * step, y: n.y + n.dy * step, parent: nodes.indexOf(n), dx: n.dx, dy: n.dy, weight: 0, kids: 0, depth: n.depth + 1 });
        n.kids++;
      }
      continue;
    }
    for (const [i, p] of pull) {
      const n = nodes[i];
      const l = Math.hypot(p[0], p[1]) || 1;
      const dx = p[0] / l * 0.8 + n.dx * 0.2;
      const dy = p[1] / l * 0.8 + n.dy * 0.2;
      const m = Math.hypot(dx, dy) || 1;
      nodes.push({ root: n.root, x: n.x + (dx / m) * step, y: n.y + (dy / m) * step, parent: i, dx: dx / m, dy: dy / m, weight: 0, kids: 0, depth: n.depth + 1 });
      n.kids++;
    }
    live = live.filter((a) => !nodes.some((n) => (n.x - a[0]) ** 2 + (n.y - a[1]) ** 2 < kill * kill));
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    nodes[i].weight += 1;
    if (nodes[i].parent >= 0) nodes[nodes[i].parent].weight += nodes[i].weight;
  }
  const kids = nodes.map(() => []);
  nodes.forEach((n, i) => n.parent >= 0 && kids[n.parent].push(i));
  const paths = [];
  const walk = (start) => {
    const pts = [];
    if (nodes[start].parent >= 0) pts.push(nodes[nodes[start].parent].x, nodes[nodes[start].parent].y);
    let i = start;
    for (;;) {
      pts.push(nodes[i].x, nodes[i].y);
      if (kids[i].length !== 1) break;
      i = kids[i][0];
    }
    paths.push({ pts, weight: nodes[start].weight, depth: nodes[start].depth, root: nodes[start].root });
    for (const k of kids[i]) walk(k);
  };
  nodes.forEach((n, i) => n.parent < 0 && walk(i));
  return paths;
}
