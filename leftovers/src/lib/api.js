export async function matchRecipes(body) {
  const res = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Match failed (${res.status})`);
  return data;
}

export async function fetchStats() {
  try {
    const res = await fetch("/api/stats");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function admin(path, body) {
  const res = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? "GET" : path === "synonym" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Admin call failed (${res.status})`);
  return data;
}
