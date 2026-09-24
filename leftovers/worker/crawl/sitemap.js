// Sitemap XML -> list of URLs, no XML library. Sitemaps are machine-written
// and regular enough that a regex is the honest tool; a full parser buys
// nothing here and costs CPU on a Worker with a 10 ms budget.

const LOC = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi;
const LASTMOD = /<lastmod>\s*([^<]+)\s*<\/lastmod>/i;

/**
 * @param {string} xml
 * @returns {{kind: "index"|"urlset"|"unknown", entries: Array<{loc:string, lastmod:string|null}>}}
 */
export function parseSitemap(xml) {
  const text = String(xml || "");
  const kind = /<sitemapindex[\s>]/i.test(text) ? "index" : /<urlset[\s>]/i.test(text) ? "urlset" : "unknown";
  const entries = [];
  // Split on the container tags so each <loc> pairs with its own <lastmod>.
  const blocks = text.split(/<(?:url|sitemap)>/i).slice(1);
  for (const block of blocks) {
    LOC.lastIndex = 0;
    const m = LOC.exec(block);
    if (!m) continue;
    const loc = decodeEntities(m[1].trim());
    const lm = LASTMOD.exec(block);
    entries.push({ loc, lastmod: lm ? lm[1].trim() : null });
  }
  if (!entries.length) {
    // Some generators omit <url> wrappers entirely. Fall back to bare <loc>s.
    LOC.lastIndex = 0;
    let m;
    while ((m = LOC.exec(text))) entries.push({ loc: decodeEntities(m[1].trim()), lastmod: null });
  }
  return { kind, entries };
}

/**
 * Sitemap indexes list child sitemaps for posts, pages, tags, authors,
 * images... Keep the ones likely to hold recipes and skip the rest. When in
 * doubt keep it: a wasted fetch is cheaper than a missed corpus.
 */
export function pickChildSitemaps(entries) {
  const skip = /(?:^|[-_/])(?:category|tag|author|page|attachment|image|video|news|product|local|web-stories|wp-|misc|misc-|static|glossary|contributor|topic)(?:s)?(?:[-_/.]|\d|$)/i;
  return entries.map((e) => e.loc).filter((loc) => !skip.test(loc.split("/").pop() || loc));
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
