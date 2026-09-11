# ロゴ素材の出所

各事業者を識別する目的（指名的使用）で、各社の公開ページから取得したロゴを表示用サイズに縮小して使用している。
差し替え・削除の依頼があった場合は、`site/public/logos/` のファイルを消し、`site/src/lib/oripa.ts` の `SITE_LOGOS` から該当行を外せば、自動で頭文字マークにフォールバックする。

| ファイル | 取得元 | 取得日 |
|---|---|---|
| dokkan-toreca.webp | https://dokkan-toreca.com/logo.png | 2026-09-12 |
| dopa.webp | https://dopa-game.jp/dopa_v2_logo.png | 2026-09-12 |
| ex-toreca.webp | https://oripa.ex-toreca.com/img/fav_png/icon.png | 2026-09-12 |

いずれも表示サイズに合わせて縮小し、WebPへ再エンコードしたもの。加筆・改変はしていない。
