const footprint = (form) => Math.max(Math.abs(form.box.min[0]), Math.abs(form.box.max[0]), Math.abs(form.box.min[2]), Math.abs(form.box.max[2]), 0.05);

export function layout(plan, forms) {
  const spots = forms.map(() => null);
  const byId = new Map(plan.subjects.map((s, i) => [s.id, i]));
  const place = (i, x, z, yaw = 0, y = 0) => {
    spots[i] = { x, y, z, yaw };
  };
  const humans = plan.subjects.map((s, i) => (s.form === "human" ? i : -1)).filter((i) => i >= 0);
  const pair = plan.relations.find((r) => ["facing", "holding", "with"].includes(r.rel) && plan.subjects[byId.get(r.a)]?.form === "human" && plan.subjects[byId.get(r.b)]?.form === "human");
  const close = humans.length >= 2 && (pair || ["kiss", "embrace", "hold"].includes(plan.subjects[humans[0]].pose));

  const anchorRel = plan.relations.find((r) => r.rel === "under" || r.rel === "beside" || r.rel === "near");
  const anchor = anchorRel ? byId.get(anchorRel.b) : null;
  if (anchor !== null && anchor !== undefined && plan.subjects[anchor].form !== "human") {
    place(anchor, 0, 0, 0);
  }

  const center = () => {
    if (anchor === null || anchor === undefined || !spots[anchor]) return [0, 0];
    const f = forms[anchor];
    const reach = anchorRel.rel === "under" ? Math.max(f.box.max[0], 0.5) + Math.min(0.7, f.size * 0.12) : footprint(f) + 0.6;
    return [spots[anchor].x + reach, spots[anchor].z + (anchorRel.rel === "under" ? 0.15 : 0)];
  };

  if (close) {
    const [cx, cz] = center();
    const [a, b] = pair ? [byId.get(pair.a), byId.get(pair.b)] : humans;
    const gap = ["kiss", "embrace"].includes(plan.subjects[a].pose) ? 0.17 : 0.3;
    place(a, cx, cz - gap, -Math.PI / 2);
    place(b, cx, cz + gap, Math.PI / 2);
    humans.filter((i) => i !== a && i !== b).forEach((i, k) => place(i, cx + 0.7 * (k + 1), cz + 0.9, 0));
  }

  let cursor = 0;
  forms.forEach((form, i) => {
    if (spots[i]) return;
    const rel = plan.relations.find((r) => byId.get(r.a) === i && spots[byId.get(r.b)]);
    if (rel) {
      const j = byId.get(rel.b);
      const s = spots[j];
      const fj = forms[j];
      const gap = footprint(form) + footprint(fj);
      if (rel.rel === "on") return place(i, s.x, s.z, 0, s.y + fj.box.max[1]);
      if (rel.rel === "above") return place(i, s.x, s.z, 0, s.y + fj.box.max[1] + form.size * 0.3);
      if (rel.rel === "under") return place(i, s.x + Math.max(fj.box.max[0] * 0.9, 0.2), s.z + 0.1, 0);
      if (rel.rel === "behind") return place(i, s.x - gap * 1.2, s.z - gap * 0.4, 0);
      if (rel.rel === "front") return place(i, s.x + gap * 1.2, s.z + gap * 0.3, 0);
      if (rel.rel === "far") return place(i, s.x - gap * 4, s.z - gap * 3, 0);
      if (rel.rel === "inside") return place(i, s.x, s.z, 0, s.y + fj.box.max[1] * 0.3);
      if (rel.rel === "facing") return place(i, s.x + gap * 1.1, s.z, Math.PI);
      return place(i, s.x, s.z + gap * 1.15, 0);
    }
    const r = footprint(form);
    if (!spots.some(Boolean)) {
      place(i, 0, 0, 0);
      cursor = r;
    } else {
      place(i, 0, cursor + 0.4 + r, 0);
      cursor += 0.4 + r * 2;
    }
  });
  return spots;
}
