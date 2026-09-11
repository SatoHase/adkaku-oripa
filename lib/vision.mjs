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
「最低保証」「最低でも」「アド確定」等の表記のみを保証とみなし、還元率や当選確率は保証に含めないでください。` },
      ]}],
    });
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.warn(`vision failed for ${imageUrl}: ${e.message}`);
    return null;
  }
}
