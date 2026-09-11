// サイト定義（sites/*.yml）に従って一覧ページから候補を抽出する。シートには触らない。
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { mapApiItem, fill, toYen } from "./extract.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export function loadSites(only) {
  return fs.readdirSync("sites")
    .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
    .map((f) => ({ site_id: path.basename(f, ".yml"), ...YAML.parse(fs.readFileSync(path.join("sites", f), "utf8")) }))
    .filter((s) => (only ? s.site_id === only : s.enabled));
}

async function extractDom(page, dom) {
  return page.$$eval(dom.item_selector, (els, dom) => els.map((el) => {
    const out = {};
    for (const [k, spec] of Object.entries(dom.fields)) {
      const node = spec.selector ? el.querySelector(spec.selector) : el;
      let v = node ? (spec.attr ? node.getAttribute(spec.attr) : node.textContent.trim()) : null;
      if (v && spec.regex) { const m = v.match(new RegExp(spec.regex)); v = m ? m[1] : null; }
      out[k] = v;
    }
    return out;
  }), dom);
}

// 戻り値: { results: 正規化済み候補[], shot: 一覧スクショのパス }
export async function scrapeSite(browser, site, { evidenceDir = "evidence" } = {}) {
  const page = await browser.newPage({ userAgent: UA, locale: "ja-JP" });
  const captured = [];
  if (site.api?.url_pattern) {
    page.on("response", async (res) => {
      if (!res.url().includes(site.api.url_pattern)) return;
      try { captured.push(await res.json()); } catch {}
    });
  }
  const urls = site.list_urls ?? [site.list_url];
  let items = [];
  const waitMs = site.wait_ms ?? 5000;
  for (const u of urls) {
    // networkidle はSPAのポーリングで永久に満たされないことがあるため使わない
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (site.dom?.item_selector) {
      await page.waitForSelector(site.dom.item_selector, { timeout: waitMs * 3 }).catch(() => {});
    }
    await page.waitForTimeout(waitMs);
    if (site.api?.url_pattern) continue; // API方式は captured に溜まる
    if (site.dom?.item_selector) items.push(...(await extractDom(page, site.dom)));
  }
  if (captured.length) {
    for (const body of captured) {
      const arr = site.api.items_path.split(".").reduce((o, k) => o?.[k], body);
      if (Array.isArray(arr)) items.push(...arr.map((r) => mapApiItem(r, site.api.fields)));
    }
    console.log(`[${site.site_id}] api: ${items.length} items`);
  } else {
    console.log(`[${site.site_id}] dom: ${items.length} items`);
  }

  fs.mkdirSync(evidenceDir, { recursive: true });
  const shot = `${evidenceDir}/${site.site_id}-${Date.now()}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  await page.close();

  if (!items.length) throw new Error(`[${site.site_id}] 0 items — 抽出定義の見直しが必要（スクショ: ${shot}）`);

  const base = urls[0];
  const results = [];
  for (const it of items) {
    if (!it.id) continue;
    const url = it.detail_url?.startsWith("http") ? it.detail_url : new URL(it.detail_url ?? "", base).href;
    results.push({
      id: `${site.site_id}:${it.id}`,
      site_id: site.site_id,
      name: it.name ?? "",
      url,
      price: toYen(it.price),
      guarantee_text: it.guarantee_text ?? "",
      guarantee_value: toYen(it.guarantee_text),
      stock_total: it.stock_total ?? "",
      stock_left: it.stock_left ?? "",
      starts_at: it.starts_at ?? "",
      ends_at: it.ends_at ?? "",
      affiliate_url: site.affiliate_url_template ? fill(site.affiliate_url_template, { url: encodeURIComponent(url) }) : url,
      _image: it[site.vision?.image_field],
    });
  }
  return { results, shot };
}
