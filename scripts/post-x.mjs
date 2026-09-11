// published のうち未投稿を X に投稿し posted にする（1オリパ1投稿）
import { TwitterApi } from "twitter-api-v2";
import { openSheet, loadRows } from "../lib/sheet.mjs";
const client = new TwitterApi({
  appKey: process.env.X_API_KEY, appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN, accessSecret: process.env.X_ACCESS_SECRET,
});
const sheet = await openSheet();
const rows = await loadRows(sheet);
const limit = Number(process.env.MAX_POSTS_PER_RUN || 5);
let n = 0;
for (const r of rows) {
  if (r.get("status") !== "published" || r.get("posted_at")) continue;
  if (n >= limit) break;
  const text = `【アド確】${r.get("name")}｜${r.get("price")}円/口｜最低保証 ${r.get("guarantee_text")}\n${r.get("post_url")}\n#PR`;
  try {
    await client.v2.tweet(text);
    r.set("status", "posted"); r.set("posted_at", new Date().toISOString());
    await r.save(); n++;
    console.log(`posted ${r.get("id")}`);
  } catch (e) {
    console.error(`post failed ${r.get("id")}: ${e.message}`);
  }
}
