#!/usr/bin/env node
/** One-off: count all skills on clawdhub.com via /api/v1/skills pagination */

async function countSkills() {
  let total = 0;
  let cursor = null;
  let page = 0;
  const seen = new Set();

  while (true) {
    const url =
      "https://clawdhub.com/api/v1/skills?limit=100" +
      (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    const res = await fetch(url);
    if (!res.ok) {
      console.error("HTTP", res.status, res.statusText);
      break;
    }
    const data = await res.json();
    const items = data.items || [];
    for (const it of items) if (it.slug) seen.add(it.slug);
    const n = items.length;
    total += n;
    page += 1;
    console.log("page", page, "items", n, "cumulative total", total, "unique slugs", seen.size);
    cursor = data.nextCursor || null;
    if (!cursor || n === 0) break;
  }

  console.log("\nFINAL TOTAL ITEMS (sum of page sizes):", total);
  console.log("FINAL UNIQUE SLUGS:", seen.size);
  return { total, unique: seen.size };
}

countSkills().catch((e) => {
  console.error(e);
  process.exit(1);
});
