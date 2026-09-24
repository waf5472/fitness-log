// One interface, two backends — the same split as fitness-log.
//
//   LocalStore  localStorage. Every visitor. Cookbook, Spicerack and swipe
//               history live in their browser and never touch the Worker.
//   CloudStore  the Worker's /api/db routes behind Cloudflare Access. The
//               owner's tables in D1, so the Cookbook follows them across
//               devices.
//
// The recipe INDEX is server-side for both: /api/match is public, read-only.

import { DEFAULT_SPICERACK } from "../../shared/canonicals.js";

const LS = {
  spicerack: "leftovers:spicerack",
  cookbook: "leftovers:cookbook",
  swipes: "leftovers:swipes",
  prefs: "leftovers:prefs",
};

export async function detectMode() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return { mode: "local", email: null, indexed: false, apiUp: false };
    const data = await res.json();
    return { mode: data.authenticated ? "cloud" : "local", email: data.email, indexed: Boolean(data.indexed), apiUp: true };
  } catch {
    return { mode: "local", email: null, indexed: false, apiUp: false };
  }
}

export function createStore(mode) {
  return mode === "cloud" ? new CloudStore() : new LocalStore();
}

class LocalStore {
  mode = "local";
  #read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  #write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or quota: the session still works, it just won't persist */
    }
  }
  async getSpicerack() {
    return this.#read(LS.spicerack, null) ?? [...DEFAULT_SPICERACK];
  }
  async setSpicerack(ids) {
    this.#write(LS.spicerack, [...new Set(ids)]);
  }
  async listCookbook() {
    return this.#read(LS.cookbook, []);
  }
  async saveToCookbook(card) {
    const all = (await this.listCookbook()).filter((c) => c.id !== card.id);
    all.unshift({ ...card, saved_at: new Date().toISOString(), cooked_count: 0, notes: "" });
    this.#write(LS.cookbook, all);
    await this.addSwipe(card.id, "right");
  }
  async removeFromCookbook(id) {
    this.#write(LS.cookbook, (await this.listCookbook()).filter((c) => c.id !== id));
    const s = await this.getSwipes();
    this.#write(LS.swipes, { ...s, right: s.right.filter((x) => x !== id) });
  }
  async updateCookbook(id, patch) {
    this.#write(LS.cookbook, (await this.listCookbook()).map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async getSwipes() {
    return this.#read(LS.swipes, { left: [], right: [] });
  }
  async addSwipe(id, direction) {
    const s = await this.getSwipes();
    const left = s.left.filter((x) => x !== id);
    const right = s.right.filter((x) => x !== id);
    (direction === "left" ? left : right).push(id);
    this.#write(LS.swipes, { left, right });
  }
  async clearLeftSwipes() {
    const s = await this.getSwipes();
    this.#write(LS.swipes, { ...s, left: [] });
  }
  async getPrefs() {
    return this.#read(LS.prefs, null);
  }
  async setPrefs(p) {
    this.#write(LS.prefs, p);
  }
}

class CloudStore {
  mode = "cloud";
  async #call(path, init) {
    const res = await fetch(`/api/db/${path}`, { headers: { "Content-Type": "application/json" }, ...init });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  async getSpicerack() {
    return (await this.#call("spicerack")).items;
  }
  async setSpicerack(ids) {
    await this.#call("spicerack", { method: "PUT", body: JSON.stringify({ items: ids }) });
  }
  async listCookbook() {
    return (await this.#call("cookbook")).items;
  }
  async saveToCookbook(card) {
    await this.#call("cookbook", { method: "POST", body: JSON.stringify(card) });
  }
  async removeFromCookbook(id) {
    await this.#call(`cookbook?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  async updateCookbook(id, patch) {
    await this.#call("cookbook", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
  }
  async getSwipes() {
    return this.#call("swipes");
  }
  async addSwipe(id, direction) {
    await this.#call("swipes", { method: "POST", body: JSON.stringify({ id, direction }) });
  }
  async clearLeftSwipes() {
    await this.#call("swipes", { method: "DELETE" });
  }
  async getPrefs() {
    return (await this.#call("prefs")).prefs;
  }
  async setPrefs(p) {
    await this.#call("prefs", { method: "PUT", body: JSON.stringify(p) });
  }
}
