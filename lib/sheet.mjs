import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

export const COLUMNS = [
  "id","site_id","name","url","price","guarantee_text","guarantee_value",
  "stock_total","stock_left","starts_at","ends_at","affiliate_url","evidence",
  "status","reject_reason","first_seen_at","last_seen_at","post_url","posted_at","misses",
];

export async function openSheet() {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["oripa"];
  if (!sheet) throw new Error('sheet "oripa" not found');
  await sheet.loadHeaderRow();
  return sheet;
}

export async function loadRows(sheet) {
  return sheet.getRows();
}

// 複数行のセル更新を1回のAPI呼び出しにまとめる（Sheets APIの書き込み制限: 60回/分 対策）
// updates: Map<rowNumber, { [column]: value }>
export async function batchUpdateRows(sheet, updates) {
  if (!updates.size) return;
  const headers = sheet.headerValues;
  const rowNums = [...updates.keys()];
  const minRow = Math.min(...rowNums), maxRow = Math.max(...rowNums);
  await sheet.loadCells({ startRowIndex: minRow - 1, endRowIndex: maxRow, startColumnIndex: 0, endColumnIndex: headers.length });
  for (const [rowNum, cols] of updates) {
    for (const [col, val] of Object.entries(cols)) {
      const ci = headers.indexOf(col);
      if (ci < 0) continue; // ヘッダーに無い列は無視
      sheet.getCell(rowNum - 1, ci).value = val;
    }
  }
  await sheet.saveUpdatedCells();
}
