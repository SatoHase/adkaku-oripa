// サイト定義（sites/*.yml）に従って一覧ページから候補を抽出する。シートには触らない。
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { mapApiItem, fill, toYen } from "./extract.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// 商材マスタ（categories.yml）
export function loadCategories() {
  if (!fs.existsSync("categories.yml")) return [];
  return (YAML.parse(fs.readFileSync("categories.yml", "utf8")) ?? []).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

// サイトの一覧ページ（SITE_LISTING）。listings が無い旧定義は list_urls / list_url を商材なしで扱う
export function siteListings(site) {
  // adkaku: true は事業者自身の「アド確定」一覧（site.adkaku_listing を参照）
  if (site.listings?.length) return site.listings.map((l) => ({ category: l.category ?? "", url: l.url, adkaku: !!l.adkaku }));
  return (site.list_urls ?? [site.list_url]).filter(Boolean).map((url) => ({ category: "", url }));
}

export function loadSites(only) {
  return fs.readdirSync("sites")
    .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
    .map((f) => ({ site_id: path.basename(f, ".yml"), ...YAML.parse(fs.readFileSync(path.join("sites", f), "utf8")) }))
    .filter((s) => (only ? s.site_id === only : s.enabled));
}

// 「もっと見る」ボタン型の一覧。ボタンが消えるか件数が増えなくなるまで押す
async function loadAll(page, site) {
  const lm = site.load_more;
  if (!lm?.selector) return;
  const count = () => page.$$eval(site.dom.item_selector, (els) => els.length);
  for (let i = 0; i < (lm.max_clicks ?? 20); i++) {
    const btn = await page.$(lm.selector);
    if (!btn || !(await btn.isVisible())) break;
    const before = await count();
    await btn.click();
    await page.waitForFunction(({ sel, n }) => document.querySelectorAll(sel).length > n,
      { sel: site.dom.item_selector, n: before }, { timeout: 15000 }).catch(() => {});
    if ((await count()) <= before) break;
  }
}

async function extractDom(page, dom) {
  return page.$$eval(dom.item_selector, (els, dom) => els.map((el) => {
    const out = {};
    for (const [k, spec] of Object.entries(dom.fields)) {
      let v;
      if (spec.text) {
        // text: true → 要素全体の表示テキスト（空白正規化）に regex を当てる
        v = el.innerText.replace(/\s+/g, " ").trim();
      } else {
        const node = spec.selector ? el.querySelector(spec.selector) : el;
        v = node ? (spec.attr ? node.getAttribute(spec.attr) : node.textContent.trim()) : null;
      }
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
  const listings = siteListings(site);
  let items = [];   // 各要素に _category（取得元一覧ページの商材）を付ける
  const waitMs = site.wait_ms ?? 5000;
  for (const { category, url: u, adkaku } of listings) {
    captured.length = 0;
    // networkidle はSPAのポーリングで永久に満たされないことがあるため使わない
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (site.dom?.item_selector) {
      await page.waitForSelector(site.dom.item_selector, { timeout: waitMs * 3 }).catch(() => {});
    }
    await page.waitForTimeout(waitMs);
    let got = [];
    if (site.api?.url_pattern) {
      for (const body of captured) {
        const arr = site.api.items_path.split(".").reduce((o, k) => o?.[k], body);
        if (Array.isArray(arr)) got.push(...arr.map((r) => mapApiItem(r, site.api.fields)));
      }
    } else if (site.dom?.item_selector) {
      await loadAll(page, site);
      got = await extractDom(page, site.dom);
    }
    console.log(`[${site.site_id}] ${category || "-"} ${site.api?.url_pattern ? "api" : "dom"}: ${got.length} items`);
    items.push(...got.map((it) => ({ ...it, _category: category, _adkaku: adkaku })));
  }

  fs.mkdirSync(evidenceDir, { recursive: true });
  const shot = `${evidenceDir}/${site.site_id}-${Date.now()}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  await page.close();

  if (!items.length) throw new Error(`[${site.site_id}] 0 items — 抽出定義の見直しが必要（スクショ: ${shot}）`);

  // dom.fields.exclude が一致したもの（販売開始前・売り切れ等）は今回は見なかった扱いにする。
  // 候補外として skipped に記録すると、販売開始後に再判定されなくなるため
  items = items.filter((it) => !it.exclude);

  // 事業者の「アド確定」一覧があるサイト：商材一覧とアド確定一覧の両方に載っているものだけを返す。
  // アド確定でないものは候補外として skipped に記録しない（後からアド確定に載った時に拾えるように）
  const adkakuIds = new Set(items.filter((it) => it._adkaku).map((it) => it.id));
  if (listings.some((l) => l.adkaku)) items = items.filter((it) => !it._adkaku && it._category && adkakuIds.has(it.id));

  const base = listings[0].url;
  const results = [];
  const seen = new Set();   // 同じオリパが複数の一覧に出た場合は最初に見つかった商材を採用
  for (const it of items) {
    if (!it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    // 事業者表記「アド確定」＝使用した額以上が排出される → 最低保証は1口価格と同額として扱う
    if (site.adkaku_listing && adkakuIds.has(it.id) && !it.guarantee_text) {
      it.guarantee_text = site.adkaku_listing.guarantee_text;
      it.guarantee_value = it.price;
    }
    const url = it.detail_url?.startsWith("http") ? it.detail_url : new URL(it.detail_url ?? "", base).href;
    results.push({
      id: `${site.site_id}:${it.id}`,
      site_id: site.site_id,
      category_id: it._category ?? "",
      name: it.name ?? "",
      new_user_only: it.new_user_only ?? null,
      login_bonus: it.login_bonus ?? null,
      url,
      price: toYen(it.price),
      guarantee_text: it.guarantee_text ?? "",
      guarantee_value: toYen(it.guarantee_value ?? it.guarantee_text),
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
