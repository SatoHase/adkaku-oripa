// シートの published/posted/ended を site/src/data/oripa.json に書き出す（Astroビルド用）
import fs from "node:fs";
import { openSheet, loadRows, COLUMNS } from "../lib/sheet.mjs";
const sheet = await openSheet();
const rows = await loadRows(sheet);
const show = new Set(["approved", "published", "posted", "ended"]);
const HIDE = new Set(["misses"]);
const data = rows.filter((r) => show.has(r.get("status")))
  .map((r) => Object.fromEntries(COLUMNS.filter((c) => !HIDE.has(c)).map((c) => [c, r.get(c) ?? ""])));
fs.mkdirSync("site/src/data", { recursive: true });
fs.writeFileSync("site/src/data/oripa.json", JSON.stringify(data, null, 2));
// approved → published へ更新し post_url を書き戻す
const base = process.env.SITE_BASE_URL?.replace(/\/$/, "") ?? "";
for (const r of rows) {
  if (r.get("status") !== "approved") continue;
  r.set("status", "published");
  r.set("post_url", `${base}/oripa/${encodeURIComponent(r.get("id"))}/`);
  await r.save();
}
console.log(`exported ${data.length} records`);
