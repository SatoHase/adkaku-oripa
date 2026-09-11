// バナー画像から オリパ名・最低保証 を読む（Claude vision）。新規レコードのみ呼ぶ。
import Anthropic from "@anthropic-ai/sdk";
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export async function readBanner(imageUrl, unit = "円") {
  if (!client) { console.warn("ANTHROPIC_API_KEY 未設定: vision skip"); return null; }
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: `このオリパのバナー画像から次をJSONのみで返してください。
{"name": オリパ名（画像内の商品名・キャッチ）, "guarantee_text": 最低保証の表記原文（例 "最低保証10,300PT"。無ければnull）, "guarantee_value": 最低保証の数値（${unit}単位、整数。無ければnull）}
保証とみなすのは「最低保証」「最低でも」「アド確定」「ハズレでも○PT」のように、1口を引けば無条件で必ず得られる最低額の表記のみです。
次は保証ではないので guarantee_text / guarantee_value を null にしてください：
- 「1/Nの確率で」「○%の確率で」など確率付きの表記
- 「○○発生で」「○○が出たら」など条件付きの表記
- 「○PT以上確定」でも前に条件や確率が付いているもの
- 還元率、総還元、当選本数
金額に「以上」が付いていても、無条件の最低額であれば保証として扱ってください。` },
      ]}],
    });
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.warn(`vision failed for ${imageUrl}: ${e.message}`);
    return null;
  }
}
