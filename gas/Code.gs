// Google Apps Script: 承認通知 + 承認/不可の受付 + GitHubへdispatch
// スクリプトプロパティ: SECRET（任意の長い文字列）, GITHUB_TOKEN（repo権限のPAT）,
//   GITHUB_REPO（例 SatoHase/adkaku-oripa）, NOTIFY_TO（通知先メール）
// トリガー: notifyNew を時間主導型（10分おき）で登録。ウェブアプリとしてデプロイ（自分として実行／全員アクセス可）
const P = PropertiesService.getScriptProperties();
const SHEET = () => SpreadsheetApp.getActive().getSheetByName("oripa");
const REJECT_REASONS = ["保証表記が不明確", "保証が虚偽の疑い", "非提携サイト", "その他"];

function sign(id, action) {
  const raw = Utilities.computeHmacSha256Signature(`${id}|${action}`, P.getProperty("SECRET"));
  return raw.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}
function rowsAsObjects() {
  const [head, ...data] = SHEET().getDataRange().getValues();
  return data.map((r, i) => ({ _row: i + 2, ...Object.fromEntries(head.map((h, j) => [h, r[j]])) }));
}
function setCell(rowNum, col, val) {
  const head = SHEET().getRange(1, 1, 1, SHEET().getLastColumn()).getValues()[0];
  SHEET().getRange(rowNum, head.indexOf(col) + 1).setValue(val);
}

function notifyNew() {
  const items = rowsAsObjects().filter(r => r.status === "new");
  if (!items.length) return;
  const base = ScriptApp.getService().getUrl();
  const blocks = items.map(r => `
    <div style="border:1px solid #ccc;padding:12px;margin:8px 0">
      <b>${r.name}</b><br>${r.site_id}｜${r.price}円/口｜最低保証: ${r.guarantee_text}（${r.guarantee_value}円）<br>
      <a href="${r.url}">元ページ</a><br>
      <a href="${base}?a=approve&id=${encodeURIComponent(r.id)}&t=${sign(r.id, "approve")}"
         style="display:inline-block;padding:8px 16px;background:#1a7f37;color:#fff;margin-top:8px">承認</a>
      <a href="${base}?a=reject&id=${encodeURIComponent(r.id)}&t=${sign(r.id, "reject")}"
         style="display:inline-block;padding:8px 16px;background:#999;color:#fff;margin-top:8px;margin-left:8px">不可</a>
    </div>`).join("");
  MailApp.sendEmail({ to: P.getProperty("NOTIFY_TO"), subject: `[アド確] 承認待ち ${items.length}件`, htmlBody: blocks });
  items.forEach(r => setCell(r._row, "status", "notified"));
}

function doGet(e) {
  const { a, id, t, confirm, reason } = e.parameter;
  if (!id || sign(id, a) !== t) return HtmlService.createHtmlOutput("無効なリンクです");
  const r = rowsAsObjects().find(x => x.id === id);
  if (!r) return HtmlService.createHtmlOutput("レコードが見つかりません");
  if (!["new", "notified"].includes(r.status)) return HtmlService.createHtmlOutput(`処理済みです（${r.status}）`);
  if (!confirm) {
    const opts = a === "reject" ? `<p>理由: <select name="reason">${REJECT_REASONS.map(x => `<option>${x}</option>`).join("")}</select></p>` : "";
    return HtmlService.createHtmlOutput(`
      <form method="get" action="${ScriptApp.getService().getUrl()}" target="_top"><input type="hidden" name="a" value="${a}"><input type="hidden" name="id" value="${id}">
      <input type="hidden" name="t" value="${t}"><input type="hidden" name="confirm" value="1">
      <h3>${a === "approve" ? "承認" : "不可"}しますか？</h3><p>${r.name}｜${r.price}円｜${r.guarantee_text}</p>${opts}
      <button style="padding:10px 20px">確定</button></form>`);
  }
  if (a === "approve") {
    setCell(r._row, "status", "approved");
    UrlFetchApp.fetch(`https://api.github.com/repos/${P.getProperty("GITHUB_REPO")}/dispatches`, {
      method: "post", contentType: "application/json",
      headers: { Authorization: `Bearer ${P.getProperty("GITHUB_TOKEN")}`, Accept: "application/vnd.github+json" },
      payload: JSON.stringify({ event_type: "approved", client_payload: { id } }),
    });
    return HtmlService.createHtmlOutput("承認しました。出稿・投稿を開始します。");
  }
  setCell(r._row, "status", "rejected");
  setCell(r._row, "reject_reason", reason || "");
  return HtmlService.createHtmlOutput("不可にしました。");
}
