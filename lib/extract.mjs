export function getPath(obj, path) {
  if (path == null) return undefined;
  return String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function fill(template, item) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => item[k] ?? "");
}

// "1,000円" / "¥1000" / "1000" → 1000
export function toYen(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function mapApiItem(raw, fields) {
  const item = {};
  for (const [k, p] of Object.entries(fields)) {
    if (typeof p === "string" && p.includes("{")) continue; // templates: second pass
    item[k] = getPath(raw, p);
  }
  for (const [k, p] of Object.entries(fields)) {
    if (typeof p === "string" && p.includes("{")) item[k] = fill(p, item);
  }
  return item;
}

// 確率付き・条件付きの表記は「保証」ではない（例: 1/2の確率で〜、○%の確率で〜、○○発生で〜、○○が出たら〜）
const CONDITIONAL_PATTERNS = [
  /確率/, /\d+\s*分の\s*\d+/, /\d+\s*\/\s*\d+/, /[0-9０-９]+\s*[%％]/,
  /発生で/, /出たら/, /出れば/, /当たれば/, /引けば/, /揃えば/, /なら/, /場合/, /時に/, /抽選/, /チャンス/,
];
export function isUnconditional(text) {
  if (!text) return false;
  return !CONDITIONAL_PATTERNS.some((re) => re.test(String(text)));
}

// 判定：無条件の最低保証額 >= 1口価格。保証額は原文から抜けた数値のみを信じる。
export function isAdkaku(item) {
  return item.guarantee_value != null && item.price != null
    && item.guarantee_value >= item.price
    && isUnconditional(item.guarantee_text);
}

// 新規登録限定かどうか。サイト定義の new_user_only 抽出が一致していれば true、
// 無ければ name / guarantee_text（vision の読取結果を含む）に文言があるかで判定
const NEW_USER_PATTERNS = [/新規限定/, /新規登録/, /初回限定/, /WELCOME/i];
export function isNewUserOnly(item) {
  if (item.new_user_only) return true;
  const text = [item.name, item.guarantee_text].filter(Boolean).join(" ");
  return NEW_USER_PATTERNS.some((re) => re.test(text));
}

// ログインボーナス系（1日1回・毎日引ける等）。サイト定義の login_bonus 抽出が一致していれば true
const LOGIN_BONUS_PATTERNS = [/ログインボーナス/, /ログボ/, /1日1回/, /１日１回/, /毎日1回/, /毎日引け/, /デイリー/i];
export function isLoginBonus(item) {
  if (item.login_bonus) return true;
  const text = [item.name, item.guarantee_text].filter(Boolean).join(" ");
  return LOGIN_BONUS_PATTERNS.some((re) => re.test(text));
}

// 特典種別: new_user（新規登録限定）/ login_bonus（ログボ）/ limited（期間限定＝ゲリラ）
export function bonusType(item) {
  if (isNewUserOnly(item)) return "new_user";
  if (isLoginBonus(item)) return "login_bonus";
  return "limited";
}
export const BONUS_LABEL = { new_user: "新規登録限定", login_bonus: "ログボ", limited: "ゲリラ" };

// ORIPA.name = 特典種別ラベル＋サイト名（例: ゲリラ どっかんトレカ / 新規登録限定 オリくじ / ログボ オリスタ）
export function buildName(type, siteName) {
  const label = typeof type === "boolean" ? (type ? "新規登録限定" : "ゲリラ") : (BONUS_LABEL[type] ?? "ゲリラ");
  return `${label} ${siteName ?? ""}`.trim();
}
