// Crawl targets. Every one of these publishes schema.org/Recipe JSON-LD and an
// XML sitemap (or sitemap index). `cuisine` is the fallback when a recipe page
// does not say; `match` narrows sitemap URLs to recipe pages so we do not
// fetch 4,000 "gift guide" posts to find that out the hard way.
//
// Excluded on purpose: NYT Cooking (paywall), Yummly (defunct), Pinterest
// (aggregator with no recipe data of its own). Anything whose robots.txt says
// no is skipped at crawl time regardless of this list.

export const SOURCES = [
  // General
  { id: "allrecipes", name: "Allrecipes", sitemap: "https://www.allrecipes.com/sitemap.xml", match: /\/recipe\/\d+\//, priority: 3 },
  { id: "bbcgoodfood", name: "BBC Good Food", sitemap: "https://www.bbcgoodfood.com/sitemap.xml", match: /\/recipes\/[^/]+$/, priority: 4 },
  { id: "seriouseats", name: "Serious Eats", sitemap: "https://www.seriouseats.com/sitemap.xml", match: /-recipe-\d+$|\/recipes\//, priority: 5 },
  { id: "simplyrecipes", name: "Simply Recipes", sitemap: "https://www.simplyrecipes.com/sitemap.xml", match: /-recipe-\d+$|\/recipes\//, priority: 4 },
  { id: "food52", name: "Food52", sitemap: "https://food52.com/sitemap.xml", match: /\/recipes\/\d+/, priority: 4 },
  { id: "bonappetit", name: "Bon Appétit", sitemap: "https://www.bonappetit.com/sitemap.xml", match: /\/recipe\//, priority: 5 },
  { id: "epicurious", name: "Epicurious", sitemap: "https://www.epicurious.com/sitemap.xml", match: /\/recipes\/food\/views\//, priority: 4 },
  { id: "foodnetwork", name: "Food Network", sitemap: "https://www.foodnetwork.com/sitemap.xml", match: /\/recipes\/.+-\d+$/, priority: 3 },
  { id: "delish", name: "Delish", sitemap: "https://www.delish.com/sitemap_index.xml", match: /\/recipes\/a\d+\//, priority: 2 },
  { id: "tasteofhome", name: "Taste of Home", sitemap: "https://www.tasteofhome.com/sitemap_index.xml", match: /\/recipes\//, priority: 3 },
  { id: "thekitchn", name: "The Kitchn", sitemap: "https://www.thekitchn.com/sitemap.xml", match: /-recipe-|\/recipe\//, priority: 4 },
  { id: "tasty", name: "Tasty", sitemap: "https://tasty.co/sitemap.xml", match: /\/recipe\//, priority: 2 },
  { id: "jamieoliver", name: "Jamie Oliver", sitemap: "https://www.jamieoliver.com/sitemap.xml", match: /\/recipes\/.+\/.+/, priority: 4 },
  { id: "recipetineats", name: "RecipeTin Eats", sitemap: "https://www.recipetineats.com/sitemap_index.xml", match: /recipetineats\.com\/[^/]+\/$/, priority: 5 },
  // Budget / weeknight
  { id: "budgetbytes", name: "Budget Bytes", sitemap: "https://www.budgetbytes.com/sitemap_index.xml", match: /budgetbytes\.com\/[^/]+\/$/, priority: 5 },
  { id: "damndelicious", name: "Damn Delicious", sitemap: "https://damndelicious.net/sitemap_index.xml", match: /damndelicious\.net\/\d{4}\/\d{2}\/\d{2}\//, priority: 4 },
  { id: "gimmesomeoven", name: "Gimme Some Oven", sitemap: "https://www.gimmesomeoven.com/sitemap_index.xml", match: /gimmesomeoven\.com\/[^/]+\/$/, priority: 4 },
  { id: "pinchofyum", name: "Pinch of Yum", sitemap: "https://pinchofyum.com/sitemap_index.xml", match: /pinchofyum\.com\/[^/]+$/, priority: 4 },
  { id: "skinnytaste", name: "Skinnytaste", sitemap: "https://www.skinnytaste.com/sitemap_index.xml", match: /skinnytaste\.com\/[^/]+\/$/, priority: 4 },
  { id: "cafedelites", name: "Cafe Delites", sitemap: "https://cafedelites.com/sitemap_index.xml", match: /cafedelites\.com\/[^/]+\/$/, priority: 3 },
  // Vegan / vegetarian
  { id: "minimalistbaker", name: "Minimalist Baker", sitemap: "https://minimalistbaker.com/sitemap_index.xml", match: /minimalistbaker\.com\/[^/]+\/$/, priority: 5 },
  { id: "ohsheglows", name: "Oh She Glows", sitemap: "https://ohsheglows.com/sitemap_index.xml", match: /ohsheglows\.com\/\d{4}\//, priority: 4 },
  { id: "noracooks", name: "Nora Cooks", sitemap: "https://www.noracooks.com/sitemap_index.xml", match: /noracooks\.com\/[^/]+\/$/, priority: 4 },
  { id: "cookieandkate", name: "Cookie and Kate", sitemap: "https://cookieandkate.com/sitemap_index.xml", match: /cookieandkate\.com\/[^/]+\/$/, priority: 5 },
  { id: "loveandlemons", name: "Love and Lemons", sitemap: "https://www.loveandlemons.com/sitemap_index.xml", match: /loveandlemons\.com\/[^/]+\/$/, priority: 5 },
  { id: "downshiftology", name: "Downshiftology", sitemap: "https://downshiftology.com/sitemap_index.xml", match: /downshiftology\.com\/recipes\/[^/]+\/$/, priority: 4 },
  // Cuisine specialists
  { id: "justonecookbook", name: "Just One Cookbook", sitemap: "https://www.justonecookbook.com/sitemap_index.xml", match: /justonecookbook\.com\/[^/]+\/$/, cuisine: "asian", priority: 5 },
  { id: "woksoflife", name: "The Woks of Life", sitemap: "https://thewoksoflife.com/sitemap_index.xml", match: /thewoksoflife\.com\/[^/]+\/$/, cuisine: "asian", priority: 5 },
  { id: "maangchi", name: "Maangchi", sitemap: "https://www.maangchi.com/sitemap.xml", match: /\/recipe\//, cuisine: "asian", priority: 4 },
  { id: "rasamalaysia", name: "Rasa Malaysia", sitemap: "https://rasamalaysia.com/sitemap_index.xml", match: /rasamalaysia\.com\/[^/]+\/$/, cuisine: "asian", priority: 3 },
  { id: "hotthaikitchen", name: "Hot Thai Kitchen", sitemap: "https://hot-thai-kitchen.com/sitemap_index.xml", match: /hot-thai-kitchen\.com\/[^/]+\/$/, cuisine: "asian", priority: 4 },
  { id: "giallozafferano", name: "Giallo Zafferano (EN)", sitemap: "https://www.giallozafferano.com/sitemap.xml", match: /\/recipes\//, cuisine: "italian", priority: 4 },
  { id: "smittenkitchen", name: "Smitten Kitchen", sitemap: "https://smittenkitchen.com/sitemap.xml", match: /smittenkitchen\.com\/\d{4}\/\d{2}\//, priority: 5 },
  { id: "halfbakedharvest", name: "Half Baked Harvest", sitemap: "https://www.halfbakedharvest.com/sitemap_index.xml", match: /halfbakedharvest\.com\/[^/]+\/$/, priority: 3 },
  // Baking
  { id: "kingarthur", name: "King Arthur Baking", sitemap: "https://www.kingarthurbaking.com/sitemap.xml", match: /\/recipes\/.+-recipe$/, priority: 4 },
  { id: "sallysbaking", name: "Sally's Baking Addiction", sitemap: "https://sallysbakingaddiction.com/sitemap_index.xml", match: /sallysbakingaddiction\.com\/[^/]+\/$/, priority: 3 },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

/** Which source, if any, owns a URL. */
export function sourceForUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return SOURCES.find((s) => new URL(s.sitemap).hostname.replace(/^www\./, "") === host) || null;
}
