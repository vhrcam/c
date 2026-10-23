const KEY = "c.gallery";

export function list() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function save(scene, image) {
  const key = JSON.stringify(scene);
  const items = [{ id: Date.now().toString(36), scene, image, at: Date.now() }, ...list().filter((item) => JSON.stringify(item.scene) !== key)].slice(0, 60);
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
