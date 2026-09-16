// シートの approved/published/ended を site/src/data/oripa.json に書き出す（Astroビルド用）
// あわせて商材マスタ・サイト表示名も JSON にする（フロントは site_id / category_id が増えても直さなくてよい）
import fs from "node:fs";
import { openSheet, loadRows, COLUMNS, batchUpdateRows } from "../lib/sheet.mjs";
import { loadCategories, loadSites } from "../lib/scrape.mjs";

const sheet = await openSheet();
const rows = await loadRows(sheet);
const show = new Set(["approved", "published", "ended"]);
const HIDE = new Set(["misses"]);
const data = rows.filter((r) => show.has(r.get("status")))
  .map((r) => Object.fromEntries(COLUMNS.filter((c) => !HIDE.has(c)).map((c) => [c, r.get(c) ?? ""])));
fs.mkdirSync("site/src/data", { recursive: true });
fs.writeFileSync("site/src/data/oripa.json", JSON.stringify(data, null, 2));
fs.writeFileSync("site/src/data/categories.json", JSON.stringify(loadCategories(), null, 2));
// enabled に関わらず全サイトの表示名（終了済みオリパのサイト名表示にも使う）
const sites = fs.readdirSync("sites").filter((f) => f.endsWith(".yml") && !f.startsWith("_")).map((f) => f.replace(/\.yml$/, ""));
fs.writeFileSync("site/src/data/sites.json", JSON.stringify(
  Object.fromEntries(sites.map((id) => [id, loadSites(id)[0]?.name ?? id])), null, 2));

// approved → published へ更新し post_url を書き戻す
const base = process.env.SITE_BASE_URL?.replace(/\/$/, "") ?? "";
const updates = new Map();
for (const r of rows) {
  if (r.get("status") !== "approved") continue;
  updates.set(r.rowNumber, { status: "published", post_url: `${base}/oripa/${encodeURIComponent(r.get("id"))}/` });
}
await batchUpdateRows(sheet, updates);
console.log(`exported ${data.length} records`);
