// 収集: sites/*.yml を順に処理し、シートへ新規追加・last_seen更新・終了判定を行う
import { chromium } from "playwright";
import { openSheet, loadRows, batchUpdateRows, openOrCreateSheet, SKIPPED_SHEET, SKIPPED_COLUMNS } from "../lib/sheet.mjs";
import { isAdkaku, isNewUserOnly, buildName } from "../lib/extract.mjs";
import { readBanner } from "../lib/vision.mjs";
import { loadSites, scrapeSite } from "../lib/scrape.mjs";

const ENDED_AFTER_MISSES = Number(process.env.ENDED_AFTER_MISSES || 3);
const ONLY_SITE = process.env.SITE || process.argv[2] || "";   // 指定時はそのサイトだけ（終了判定もそのサイトに限定）
const now = () => new Date().toISOString();

const sheet = await openSheet();
const rows = await loadRows(sheet);
const byId = new Map(rows.map((r) => [r.get("id"), r]));
// 候補外は oripa に残さず skipped シートに id を記録（再収集・再判定を防ぐ）
const skippedSheet = await openOrCreateSheet(SKIPPED_SHEET, SKIPPED_COLUMNS);
const skippedIds = new Set((await loadRows(skippedSheet)).map((r) => r.get("id")));
const newSkipped = [];
const browser = await chromium.launch();
const seenIds = new Set();
const sites = loadSites(ONLY_SITE);
const failedSites = new Set();
const updates = new Map();   // rowNumber → {col: value}
const newRows = [];
const setRow = (row, cols) => updates.set(row.rowNumber, { ...(updates.get(row.rowNumber) ?? {}), ...cols });

for (const site of sites) {
  try {
    const { results } = await scrapeSite(browser, site);
    for (const r of results) {
      seenIds.add(r.id);
      if (skippedIds.has(r.id)) continue;   // 判定済みの候補外
      const row = byId.get(r.id);
      if (row) {
        const cols = { last_seen_at: now(), misses: "0" };
        if (r.stock_left !== "") cols.stock_left = r.stock_left;
        // 列追加前の既存行を埋める（category_id / new_user_only / name）
        if (!row.get("category_id") && r.category_id) cols.category_id = r.category_id;
        // アフィリンクの雛形が後から設定・変更された場合に追従する
        if (r.affiliate_url && row.get("affiliate_url") !== r.affiliate_url) cols.affiliate_url = r.affiliate_url;
        if (!row.get("new_user_only")) {
          const newUser = isNewUserOnly({ ...r, name: row.get("name"), guarantee_text: row.get("guarantee_text") });
          cols.new_user_only = newUser ? "TRUE" : "FALSE";
          cols.name = buildName(newUser, site.name ?? site.site_id);
        }
        setRow(row, cols);
      } else {
        if (site.vision && r._image) {
          const v = await readBanner(r._image, site.vision.unit);
          if (v) { r.name ||= v.name ?? ""; r.guarantee_text ||= v.guarantee_text ?? ""; r.guarantee_value ??= v.guarantee_value; }
        }
        delete r._image;
        // name = （新規登録限定 or ゲリラ）＋サイト名。判定は一覧のタグ or 読み取った文言
        const newUser = isNewUserOnly(r);
        r.new_user_only = newUser ? "TRUE" : "FALSE";
        r.name = buildName(newUser, site.name ?? site.site_id);
        // 完売（stock_left=0）は候補にしない
        const soldOut = String(r.stock_left).replace(/,/g, "") === "0";
        if (isAdkaku(r) && !soldOut) {
          newRows.push({ ...r, status: "new", first_seen_at: now(), last_seen_at: now(), misses: "0" });
          console.log(`  + ${r.id} ${r.name} price=${r.price} guarantee=${r.guarantee_value}`);
        } else {
          const reason = soldOut ? "sold_out" : r.guarantee_value == null ? "no_guarantee" : r.guarantee_value < r.price ? "below_price" : "conditional";
          console.log(`  - ${r.id} ${reason}`);
          newSkipped.push({ id: r.id, site_id: r.site_id, category_id: r.category_id, name: r.name, price: r.price,
            guarantee_value: r.guarantee_value ?? "", first_seen_at: now() });
        }
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
  if (seenIds.has(row.get("id")) || st === "ended") continue;
  const misses = Number(row.get("misses") || 0) + 1;
  const cols = { misses: String(misses) };
  if (misses >= ENDED_AFTER_MISSES) cols.status = "ended";
  setRow(row, cols);
}

// 書き込みは新規追加1回・更新1回にまとめる
if (newRows.length) await sheet.addRows(newRows);
if (newSkipped.length) await skippedSheet.addRows(newSkipped);
await batchUpdateRows(sheet, updates);
console.log(`added=${newRows.length} skipped=${newSkipped.length} updated=${updates.size}`);

if (failedSites.size) process.exit(1);
