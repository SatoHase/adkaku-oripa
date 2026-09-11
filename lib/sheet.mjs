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
