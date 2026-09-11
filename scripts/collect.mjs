// 収集: sites/*.yml を順に処理し、シートへ新規追加・last_seen更新・終了判定を行う
import { chromium } from "playwright";
import { openSheet, loadRows, batchUpdateRows } from "../lib/sheet.mjs";
import { isAdkaku } from "../lib/extract.mjs";
import { readBanner } from "../lib/vision.mjs";
import { loadSites, scrapeSite } from "../lib/scrape.mjs";

const ENDED_AFTER_MISSES = Number(process.env.ENDED_AFTER_MISSES || 3);
const ONLY_SITE = process.env.SITE || process.argv[2] || "";   // 指定時はそのサイトだけ（終了判定もそのサイトに限定）
const now = () => new Date().toISOString();

const sheet = await openSheet();
const rows = await loadRows(sheet);
const byId = new Map(rows.map((r) => [r.get("id"), r]));
const browser = await chromium.launch();
const seenIds = new Set();
const sites = loadSites(ONLY_SITE);
const failedSites = new Set();
const updates = new Map();   // rowNumber → {col: value}
const newRows = [];
const setRow = (row, cols) => updates.set(row.rowNumber, { ...(updates.get(row.rowNumber) ?? {}), ...cols });

for (const site of sites) {
  try {
    const { results, shot } = await scrapeSite(browser, site);
    for (const r of results) {
      seenIds.add(r.id);
      const row = byId.get(r.id);
      if (row) {
        const cols = { last_seen_at: now(), misses: "0" };
        if (r.stock_left !== "") cols.stock_left = r.stock_left;
        setRow(row, cols);
      } else {
        if (site.vision && r._image) {
          const v = await readBanner(r._image, site.vision.unit);
          if (v) { r.name ||= v.name ?? ""; r.guarantee_text ||= v.guarantee_text ?? ""; r.guarantee_value ??= v.guarantee_value; }
        }
        delete r._image;
        // 完売（stock_left=0）は候補にしない
        const soldOut = String(r.stock_left).replace(/,/g, "") === "0";
        newRows.push({ ...r, evidence: shot, status: isAdkaku(r) && !soldOut ? "new" : "skip",
          first_seen_at: now(), last_seen_at: now(), misses: "0" });
        console.log(`  + ${r.id} ${r.name} price=${r.price} guarantee=${r.guarantee_value}`);
      }
    }
  } catch (e) {
    failedSites.add(site.site_id);
    console.error(String(e));
  }
}
await browser.close();

// 終了判定: 連続で見つからない有効レコードを ended に（今回処理したサイトの行のみ）
// 収集に失敗したサイトは未検出扱いにしない
const processed = new Set(sites.map((s) => s.site_id).filter((id) => !failedSites.has(id)));
for (const row of rows) {
  const st = row.get("status");
  if (!processed.has(row.get("site_id"))) continue;
  if (seenIds.has(row.get("id")) || ["ended", "rejected", "skip"].includes(st)) continue;
  const misses = Number(row.get("misses") || 0) + 1;
  const cols = { misses: String(misses) };
  if (misses >= ENDED_AFTER_MISSES) cols.status = "ended";
  setRow(row, cols);
}

// 書き込みは新規追加1回・更新1回にまとめる
if (newRows.length) await sheet.addRows(newRows);
await batchUpdateRows(sheet, updates);
console.log(`added=${newRows.length} updated=${updates.size}`);
if (failedSites.size) process.exit(1);
