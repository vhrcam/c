const KEY = "c.works";

export function list() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function save(plan, image) {
  const key = JSON.stringify(plan);
  const items = [{ id: Date.now().toString(36), plan, image, at: Date.now() }, ...list().filter((item) => JSON.stringify(item.plan) !== key)].slice(0, 60);
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function remove(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list().filter((item) => item.id !== id)));
  } catch {}
}
