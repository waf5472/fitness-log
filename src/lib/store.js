// One interface, two backends.
//
//   LocalStore  browser localStorage. What every visitor gets. Seeded with
//               three months of plausible data so the trends have something to
//               draw on the first visit.
//   CloudStore  the Worker's D1 routes, behind Cloudflare Access. What the
//               owner gets: the real corpus, queried server-side.
//
// The UI never branches on which one is active — it just awaits the same six
// methods. Everything above this file is storage-agnostic.

import { DEFAULT_PROFILE, todayISO, shiftDate, summarizeDay } from "./goals.js";
import { computeMeal } from "./nutrition.js";
import { computeExercise } from "./exercise.js";

const LS_ENTRIES = "fitlog:entries";
const LS_PROFILE = "fitlog:profile";
const LS_TEMPLATES = "fitlog:templates";
const LS_SEEDED = "fitlog:seeded";

/** Ask the Worker whether this browser is the authenticated owner. */
export async function detectMode() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return { mode: "local", email: null };
    const data = await res.json();
    return { mode: data.authenticated ? "cloud" : "local", email: data.email };
  } catch {
    // Offline, or `vite dev` with no Worker behind it. Local is the safe default.
    return { mode: "local", email: null };
  }
}

export function createStore(mode) {
  return mode === "cloud" ? new CloudStore() : new LocalStore();
}

class LocalStore {
  constructor() {
    this.mode = "local";
    if (!localStorage.getItem(LS_SEEDED)) {
      this.#write(LS_ENTRIES, buildDemoEntries());
      localStorage.setItem(LS_SEEDED, "1");
    }
  }

  #read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  #write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async listEntries(from, to) {
    const all = this.#read(LS_ENTRIES, []);
    if (!from || !to) return all;
    return all.filter((e) => e.date >= from && e.date <= to);
  }

  async addEntry(entry) {
    const all = this.#read(LS_ENTRIES, []);
    const idx = all.findIndex((e) => e.id === entry.id);
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    this.#write(LS_ENTRIES, all);
    return entry;
  }

  async deleteEntry(id) {
    this.#write(
      LS_ENTRIES,
      this.#read(LS_ENTRIES, []).filter((e) => e.id !== id),
    );
  }

  // Small dataset, so rolling up in JS is fine here. CloudStore does the same
  // job in SQL because the owner's corpus grows without bound.
  async summarize(from, to) {
    const rows = await this.listEntries(from, to);
    const byDate = new Map();
    for (const e of rows) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    }
    return [...byDate.entries()]
      .map(([date, dayEntries]) => ({ date, ...summarizeDay(dayEntries) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getProfile() {
    return this.#read(LS_PROFILE, null) || DEFAULT_PROFILE;
  }

  async saveProfile(profile) {
    this.#write(LS_PROFILE, profile);
    return profile;
  }

  async listTemplates() {
    return this.#read(LS_TEMPLATES, []);
  }

  async saveTemplate(template) {
    const all = this.#read(LS_TEMPLATES, []);
    const idx = all.findIndex((t) => t.kind === template.kind && t.name === template.name);
    if (idx >= 0) all[idx] = template;
    else all.push(template);
    this.#write(LS_TEMPLATES, all);
    return template;
  }

  async deleteTemplate(id) {
    this.#write(
      LS_TEMPLATES,
      this.#read(LS_TEMPLATES, []).filter((t) => t.id !== id),
    );
  }

  async exportAll() {
    return {
      exported_at: new Date().toISOString(),
      version: 1,
      entries: this.#read(LS_ENTRIES, []),
      templates: this.#read(LS_TEMPLATES, []),
      profile: this.#read(LS_PROFILE, null),
    };
  }

  async importAll(payload) {
    const incoming = Array.isArray(payload?.entries) ? payload.entries : [];
    const existing = this.#read(LS_ENTRIES, []);
    const byId = new Map(existing.map((e) => [e.id, e]));
    for (const e of incoming) byId.set(e.id, e);
    this.#write(LS_ENTRIES, [...byId.values()]);
    if (payload?.profile) this.#write(LS_PROFILE, payload.profile);
    if (Array.isArray(payload?.templates)) this.#write(LS_TEMPLATES, payload.templates);
    return { imported: incoming.length };
  }
}

class CloudStore {
  constructor() {
    this.mode = "cloud";
  }

  async #req(path, options = {}) {
    const res = await fetch(`/api/db/${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async listEntries(from, to) {
    const qs = from && to ? `?from=${from}&to=${to}` : "";
    const { entries } = await this.#req(`entries${qs}`);
    return entries;
  }

  async addEntry(entry) {
    await this.#req("entries", { method: "POST", body: JSON.stringify(entry) });
    return entry;
  }

  async deleteEntry(id) {
    await this.#req(`entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // Grouped and summed in SQLite. Pulling several years of rows into the
  // browser to add them up would work now and stop working later.
  async summarize(from, to) {
    const { days } = await this.#req(`summary?from=${from}&to=${to}`);
    return days.map((d) => ({
      ...d,
      net: Math.round((d.eaten || 0) - (d.burned || 0)),
    }));
  }

  async getProfile() {
    const { profile } = await this.#req("profile");
    return profile ? { ...DEFAULT_PROFILE, ...profile } : DEFAULT_PROFILE;
  }

  async saveProfile(profile) {
    await this.#req("profile", { method: "PUT", body: JSON.stringify(profile) });
    return profile;
  }

  async listTemplates() {
    const { templates } = await this.#req("templates");
    return templates;
  }

  async saveTemplate(template) {
    await this.#req("templates", { method: "POST", body: JSON.stringify(template) });
    return template;
  }

  async deleteTemplate(id) {
    await this.#req(`templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async exportAll() {
    return this.#req("export");
  }

  async importAll(payload) {
    return this.#req("import", { method: "POST", body: JSON.stringify(payload) });
  }
}

/**
 * Ninety days of believable history, so a first-time visitor lands on a working
 * app instead of four empty charts — and so all three trend windows have data.
 * Deterministic per-day variation rather than random, so the demo looks the
 * same on every reload.
 *
 * The intake is tuned to roughly match the weight trajectory it ships with.
 * That matters more than it sounds: the Trends tab compares the deficit your
 * log predicts against what the scale actually did, and demo data that
 * disagrees with itself would make a working feature look broken.
 */
function buildDemoEntries() {
  const entries = [];
  const today = todayISO();
  const push = (date, record) =>
    entries.push({ id: crypto.randomUUID(), date, created_at: new Date().toISOString(), ...record });

  const breakfasts = [
    { name: "Parfait", slot: "breakfast", ingredients: [
      { name: "raspberries", qty: 6, unit: "oz" },
      { name: "greek yogurt", qty: 1, unit: "cup" },
      { name: "chia seeds", qty: 1, unit: "tsp" },
    ] },
    { name: "Oatmeal", slot: "breakfast", ingredients: [
      { name: "oats", qty: 0.5, unit: "cup" },
      { name: "banana", qty: 1, unit: "each" },
      { name: "almond butter", qty: 1, unit: "tbsp" },
    ] },
    { name: "Eggs and toast", slot: "breakfast", ingredients: [
      { name: "egg", qty: 3, unit: "each" },
      { name: "whole wheat bread", qty: 2, unit: "slice" },
      { name: "butter", qty: 1, unit: "tsp" },
    ] },
  ];

  const dinners = [
    { name: "Stir fry", slot: "dinner", ingredients: [
      { name: "chicken breast", qty: 1, unit: "each" },
      { name: "bell pepper", qty: 1, unit: "each" },
      { name: "onion", qty: 1, unit: "each" },
      { name: "kung pao sauce", qty: 0.25, unit: "cup" },
      { name: "olive oil", qty: 1, unit: "tsp" },
      { name: "white rice", qty: 1, unit: "cup" },
    ] },
    { name: "Salmon and vegetables", slot: "dinner", ingredients: [
      { name: "salmon", qty: 6, unit: "oz" },
      { name: "broccoli", qty: 2, unit: "cup" },
      { name: "sweet potato", qty: 1, unit: "each" },
      { name: "olive oil", qty: 1, unit: "tbsp" },
    ] },
    { name: "Burrito bowl", slot: "dinner", ingredients: [
      { name: "brown rice", qty: 1, unit: "cup" },
      { name: "black beans", qty: 0.75, unit: "cup" },
      { name: "ground turkey", qty: 5, unit: "oz" },
      { name: "salsa", qty: 3, unit: "tbsp" },
      { name: "avocado", qty: 0.5, unit: "each" },
    ] },
  ];

  const lunches = [
    { name: "Chicken salad", slot: "lunch", ingredients: [
      { name: "chicken breast", qty: 5, unit: "oz" },
      { name: "lettuce", qty: 2, unit: "cup" },
      { name: "cucumber", qty: 0.5, unit: "each" },
      { name: "feta", qty: 1, unit: "oz" },
      { name: "salad dressing", qty: 1, unit: "tbsp" },
    ] },
    { name: "Turkey sandwich", slot: "lunch", ingredients: [
      { name: "whole wheat bread", qty: 2, unit: "slice" },
      { name: "deli turkey", qty: 4, unit: "slice" },
      { name: "cheddar cheese", qty: 1, unit: "oz" },
      { name: "mayonnaise", qty: 1, unit: "tbsp" },
    ] },
  ];

  const snacks = [
    { name: "Protein shake", slot: "snack", ingredients: [
      { name: "protein powder", qty: 1.5, unit: "scoop" },
      { name: "whole milk", qty: 1.5, unit: "cup" },
      { name: "banana", qty: 1, unit: "each" },
    ] },
    { name: "Trail mix", slot: "snack", ingredients: [
      { name: "almonds", qty: 1.5, unit: "oz" },
      { name: "raisins", qty: 3, unit: "tbsp" },
      { name: "dark chocolate", qty: 1, unit: "oz" },
    ] },
    { name: "Yogurt and granola", slot: "snack", ingredients: [
      { name: "greek yogurt", qty: 1, unit: "cup" },
      { name: "granola", qty: 0.5, unit: "cup" },
      { name: "blueberries", qty: 0.5, unit: "cup" },
    ] },
    { name: "Apple and almond butter", slot: "snack", ingredients: [
      { name: "apple", qty: 1, unit: "each" },
      { name: "almond butter", qty: 3, unit: "tbsp" },
    ] },
  ];

  const workouts = [
    { activity: "run", distance_mi: 4.2, duration_min: 36, name: "Morning run" },
    { activity: "run", distance_mi: 6.1, duration_min: 53, name: "Long run" },
    { activity: "hike", distance_mi: 6.2, duration_min: 130, elev_ft: 1400, name: "Ridge trail" },
    { activity: "strength", duration_min: 50, name: "Upper body" },
    { activity: "kayak", distance_mi: 4, duration_min: 75, name: "Lake paddle" },
    { activity: "bike", distance_mi: 14, duration_min: 52, name: "River loop" },
    { activity: "run", distance_mi: 3.1, duration_min: 25, name: "Easy 5k" },
    { activity: "strength", duration_min: 45, name: "Lower body" },
  ];

  const DAYS = 90;
  // Ends near 176 lb after ~9 lb of loss, a rate the logged intake actually implies.
  let weight = 185.2;

  for (let i = DAYS - 1; i >= 0; i--) {
    const date = shiftDate(today, -i);

    push(date, { ...computeMeal(breakfasts[i % breakfasts.length]), raw_text: null });
    push(date, { ...computeMeal(lunches[i % lunches.length]), raw_text: null });
    push(date, { ...computeMeal(dinners[i % dinners.length]), raw_text: null });
    push(date, { ...computeMeal(snacks[i % snacks.length]), raw_text: null });
    push(date, { ...computeMeal(snacks[(i + 2) % snacks.length]), raw_text: null });

    // Rest days on a rough 4-on-1-off rhythm.
    if (i % 5 !== 3) {
      const w = workouts[i % workouts.length];
      push(date, { ...computeExercise(w, weight), raw_text: null });
    }

    // A slow cut, with the daily water noise that makes a trend line necessary.
    weight -= 0.1;
    const noise = [0.6, -0.4, 0.9, -0.7, 0.2, -0.9, 0.5][i % 7];
    push(date, {
      kind: "weight",
      name: "Weigh-in",
      weight_lb: Math.round((weight + noise) * 10) / 10,
      raw_text: null,
    });
  }

  return entries;
}
