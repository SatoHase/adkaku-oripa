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

// 判定：保証額 >= 1口価格。保証額は原文から抜けた数値のみを信じる。
export function isAdkaku(item) {
  return item.guarantee_value != null && item.price != null && item.guarantee_value >= item.price;
}
