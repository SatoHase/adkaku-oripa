// 抽出の動作確認のみ（シート・vision・Xには触れない）。
// 使い方: npm run dry-run -- dokkan-toreca   / 引数なしで enabled 全サイト
import { chromium } from "playwright";
import { isAdkaku } from "../lib/extract.mjs";
import { loadSites, scrapeSite } from "../lib/scrape.mjs";

const only = process.env.SITE || process.argv[2] || "";
const sites = loadSites(only);
if (!sites.length) { console.error(`site not found: ${only || "(enabled none)"}`); process.exit(1); }

const browser = await chromium.launch();
let failed = 0;
for (const site of sites) {
  try {
    const { results, shot } = await scrapeSite(browser, site);
    const missing = results.filter((r) => r.price == null || !r.url || (!site.vision && r.guarantee_value == null));
    console.log(`[${site.site_id}] ${results.length} items, adkaku(判定可能分)=${results.filter(isAdkaku).length}, 欠損=${missing.length}, shot=${shot}`);
    console.table(results.slice(0, 10).map(({ id, category_id, new_user_only, price, guarantee_value, stock_total, _image }) =>
      ({ id, category_id, new_user_only: !!new_user_only, price, guarantee_value, stock_total, image: _image ? "yes" : "" })));
    if (missing.length) console.warn(`  欠損例: ${JSON.stringify(missing[0])}`);
  } catch (e) { failed++; console.error(String(e)); }
}
await browser.close();
if (failed) process.exit(1);
