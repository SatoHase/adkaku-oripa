// oripa.json（ビルド時にワークフローが生成）を画面用に整形するユーティリティ。
// site_id が増えても変更不要な汎用実装にすること。

import sample from "../data/oripa.sample.json";

export type Oripa = {
  id: string;
  site_id: string;
  name: string;
  url: string;
  price: string;
  guarantee_text: string;
  guarantee_value: string;
  stock_total: string;
  stock_left: string;
  starts_at: string;
  ends_at: string;
  affiliate_url: string;
  evidence: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  post_url: string;
  posted_at: string;
  category_id?: string; // collect が付ける商材（categories.yml の category_id）
  new_user_only?: string; // "TRUE" なら新規登録限定
};

export type Category = { key: string; label: string; hue: number; icon: string };

export type OripaView = Oripa & {
  category: Category | null;
  kind: "新規登録限定" | "ゲリラオリパ"; // タグ表示用
  siteName: string;
  displayName: string;
  path: string;
  priceNum: number;
  guaranteeNum: number;
  adGap: number;        // 保証 − 価格（円）
  adRate: number;       // 保証 ÷ 価格（1.03 = 103%）
  stockLeftNum: number | null;
  stockTotalNum: number | null;
  stockRatio: number | null;  // 残 ÷ 総（0〜1）
  isEnded: boolean;
  isLowStock: boolean;
  isNew: boolean;
  badge: "残りわずか" | "NEW" | null;
  hue: number;          // サムネの色相。カテゴリがあればカテゴリ色、無ければ site_id 由来
  intensity: number;    // アド額の大きさ 0〜1（サムネの彩度に使う）
  checkedAt: string;    // ISO（最終確認）
};

// site_id → 表示名。未知の site_id はフォールバックで整形する（定義追加なしで動く）
const SITE_LABELS: Record<string, string> = {
  "dokkan-toreca": "どっかんトレカ",
  orikuji: "オリくじ",
  orista: "オリスタ",
  dopa: "DOPA",
  "ex-toreca": "エクストレカ",
};

// 各事業者を識別する目的で、公開ページのロゴを表示用サイズに縮小して使う（指名的使用）。
// 未登録の site_id は null を返し、頭文字マークにフォールバックする。出所は public/logos/SOURCES.md
const SITE_LOGOS: Record<string, string> = {
  "dokkan-toreca": "/logos/dokkan-toreca.webp",
  orikuji: "/logos/orikuji.webp",
  orista: "/logos/orista.webp",
  dopa: "/logos/dopa.webp",
  "ex-toreca": "/logos/ex-toreca.webp",
};

export function siteLogo(siteId: string): string | null {
  return SITE_LOGOS[siteId] ?? null;
}

export function siteLabel(siteId: string): string {
  if (!siteId) return "提携サイト";
  return (
    SITE_LABELS[siteId] ??
    siteId
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

// オリパ名からカテゴリを判定する。site_id ではなく名前で見るので、サイトが増えても定義追加は不要。
//
// アイコンは 24x24 のラインアイコン（自作）。各IPの意匠（モンスターボール、麦わら帽子、
// ミレニアムパズル、ドラゴンボール、カード裏面など）は著作物・商標なので使わない。
// 代わりに一般的な題材（航海具・実在の建造物・幾何形状）に置き換えている。
// 「どのIPか」の識別はテキストラベル側が担う。
const ICONS = {
  // 稲妻
  bolt: "M13.5 2.5 6.5 13.8h4.6l-1.6 7.7L17.5 10h-4.6z",
  // 錨（海賊＝ワンピの世界観。麦わら帽子は使わない）
  anchor: "M12 3.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM12 7.8v12.9M7.6 10.6h8.8M4.3 14.4a7.7 7.7 0 0 0 15.4 0",
  // ピラミッド（実在の建造物。ホルスの目や吊り環は付けない）
  pyramid: "M12 3.2 21 20.6H3zM12 3.2v17.4M7 12.6h10",
  // クリスタル
  crystal: "M12 2.8 19.4 9.4 12 21.2 4.6 9.4zM4.6 9.4h14.8M12 2.8 8.4 9.4 12 21.2M12 2.8l3.6 6.6L12 21.2",
  // 星
  star: "M12 3.1l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  // 五角形
  pentagon: "M12 3.2 20.5 9.4l-3.3 10.1H6.8L3.5 9.4z",
} as const;

const CATEGORIES: (Category & { re: RegExp })[] = [
  { key: "pokemon", label: "ポケカ", hue: 45, icon: ICONS.bolt, re: /ポケカ|ポケモン|ＰＴＣＧ|PTCG|pokemon/i },
  { key: "onepiece", label: "ワンピ", hue: 6, icon: ICONS.anchor, re: /ワンピ|ONE\s?PIECE/i },
  { key: "yugioh", label: "遊戯王", hue: 282, icon: ICONS.pyramid, re: /遊戯王|遊戯|YU-?GI-?OH/i },
  { key: "duelmasters", label: "デュエマ", hue: 205, icon: ICONS.crystal, re: /デュエマ|デュエル\s?マスターズ|DUEL\s?MASTERS/i },
  { key: "dragonball", label: "ドラゴンボール", hue: 28, icon: ICONS.star, re: /ドラゴンボール|DRAGON\s?BALL|フュージョンワールド/i },
  { key: "mtg", label: "MTG", hue: 152, icon: ICONS.pentagon, re: /MTG|マジック[：:]?ザ[・\s]?ギャザリング/i },
];

// collect 側の category_id（pokemon / onepiece …）から引く。無ければ名前から推定する
export function categoryByKey(key: string | undefined): Category | null {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? { key: c.key, label: c.label, hue: c.hue, icon: c.icon } : null;
}

export function detectCategory(name: string): Category | null {
  for (const c of CATEGORIES) {
    if (c.re.test(name)) return { key: c.key, label: c.label, hue: c.hue, icon: c.icon };
  }
  return null;
}

// site_id から決定論的に色相を出す。サイトが増えても定義追加が要らないようにするための実装。
export function siteHue(siteId: string): number {
  let h = 0;
  for (let i = 0; i < siteId.length; i++) h = (h * 31 + siteId.charCodeAt(i)) % 360;
  return h;
}

function toNum(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

export function toView(d: Oripa): OripaView {
  const priceNum = toNum(d.price);
  // guarantee_value が空なら表記原文から数値を拾う
  const guaranteeNum = toNum(d.guarantee_value) || toNum((d.guarantee_text.match(/[\d,]+/) ?? [""])[0]);
  const stockLeftNum = toNumOrNull(d.stock_left);
  const stockTotalNum = toNumOrNull(d.stock_total);
  const stockRatio =
    stockLeftNum !== null && stockTotalNum !== null && stockTotalNum > 0
      ? Math.min(1, stockLeftNum / stockTotalNum)
      : null;

  const adGap = guaranteeNum - priceNum;
  const isLowStock = stockRatio !== null ? stockRatio <= 0.15 : false;
  const firstSeen = Date.parse(d.first_seen_at);
  const isNew = Number.isFinite(firstSeen) && NOW - firstSeen <= DAY;
  const isEnded = d.status === "ended";
  const category = categoryByKey(d.category_id) ?? detectCategory(d.name ?? "");
  const kind = /^(true|1)$/i.test(String(d.new_user_only ?? "")) ? "新規登録限定" : "ゲリラオリパ";

  return {
    ...d,
    category,
    kind,
    siteName: siteLabel(d.site_id),
    displayName: d.name?.trim() || "オリパ",
    path: `/oripa/${encodeURIComponent(d.id)}/`,
    priceNum,
    guaranteeNum,
    adGap,
    adRate: priceNum > 0 ? guaranteeNum / priceNum : 0,
    stockLeftNum,
    stockTotalNum,
    stockRatio,
    isEnded,
    isLowStock,
    isNew,
    // バッジは1カードに1つまで。在庫の逼迫を鮮度より優先する。
    badge: isEnded ? null : isLowStock ? "残りわずか" : isNew ? "NEW" : null,
    hue: category ? category.hue : siteHue(d.site_id),
    intensity: Math.max(0, Math.min(1, adGap / 1000)),
    checkedAt: d.last_seen_at || d.first_seen_at || "",
  };
}

// oripa.json は .gitignore 対象（ワークフローが生成）。未生成でもビルドが通るよう glob で読む。
const generated = import.meta.glob<{ default: unknown[] }>("../data/oripa.json", { eager: true });
const raw = (Object.values(generated)[0]?.default ?? []) as Oripa[];

// 本番はワークフローが oripa.json を上書きする。空のときだけ開発用サンプルを使う。
const source: Oripa[] = raw.length ? raw : import.meta.env.DEV ? (sample as Oripa[]) : [];

export const all: OripaView[] = source.map(toView);

export const live: OripaView[] = all
  .filter((d) => !d.isEnded)
  .sort((a, b) => b.adGap - a.adGap || b.adRate - a.adRate);

export const ended: OripaView[] = all
  .filter((d) => d.isEnded)
  .sort((a, b) => (b.checkedAt > a.checkedAt ? 1 : -1));

// 開催中に出現するサイトの一覧（フィルタ用）。件数の多い順。
export function siteFacets(items: OripaView[]) {
  const counts = new Map<string, number>();
  for (const d of items) counts.set(d.site_id, (counts.get(d.site_id) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([site_id, count]) => ({ site_id, label: siteLabel(site_id), count }));
}

export const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
export const num = (n: number) => Math.round(n).toLocaleString("ja-JP");
export const ratePct = (r: number) => `${(r * 100).toFixed(r * 100 >= 100 ? 1 : 0)}%`;

export function jst(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(t);
}
