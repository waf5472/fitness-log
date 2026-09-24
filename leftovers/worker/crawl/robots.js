// Minimal robots.txt: is `path` allowed for our user-agent token? Longest
// matching rule wins (Google's interpretation); a group for our token
// overrides the `*` group entirely. Anything we cannot parse is treated as
// allowed, matching every mainstream crawler.

export function robotsAllows(robotsTxt, path, uaToken = "leftovers-crawler") {
  const groups = parseGroups(robotsTxt || "");
  const mine = groups.find((g) => g.agents.some((a) => a === uaToken.toLowerCase()));
  const star = groups.find((g) => g.agents.includes("*"));
  const rules = (mine || star || { rules: [] }).rules;
  let best = null;
  for (const r of rules) {
    if (!r.pattern) continue; // "Disallow:" (empty) allows everything
    if (matches(r.pattern, path) && (!best || r.pattern.length > best.pattern.length)) best = r;
  }
  return !best || best.allow;
}

function parseGroups(text) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      cur.rules.push({ allow: key === "allow", pattern: val });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function matches(pattern, path) {
  // robots patterns: * wildcard, $ end anchor, otherwise prefix match.
  const esc = pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp("^" + (esc.endsWith("$") ? esc.slice(0, -1) + "$" : esc));
  return re.test(path);
}
