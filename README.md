# adkaku-oripa

アド確ネットオリパ情報の収集 → 承認 → サイト掲載 → X投稿 を自動化する。

## 構成
- `sites/*.yml` — 収集対象サイトの定義（1サイト1ファイル）。追加は定義ファイル追加のみ
- `scripts/collect.mjs` — Playwrightで収集しシートへ書き込み（Actions: 30分おき）
- `scripts/export-data.mjs` — シート → `site/src/data/oripa.json`、approved → published
- `scripts/post-x.mjs` — published → X投稿 → posted
- `gas/Code.gs` — 承認メール送信・承認/不可受付・GitHubへdispatch
- `site/` — Astro静的サイト（Cloudflare Pages）

## サイト（`site/`）

```
site/src/lib/oripa.ts          oripa.json の読み込み・整形（アド額/アド率/残口数/サイト表示名/バッジ/色相）
site/src/components/           OripaCard.astro（2カラムの商品カード）
                               DetailModal.astro（「詳細をみる」の共通モーダル）
                               PrNote.astro（PR表記。文言はここに集約）
                               OripaThumb.astro（カテゴリ別サムネ。自作イラスト＋数値帯）
site/src/layouts/Base.astro    PR表記（既定は本文冒頭。prNote={false} で位置を変えられる）・ヘッダー・フッター・OGP
site/src/pages/
  index.astro                  ファーストビュー＋開催中一覧（サイトタイル・チップ・ボトムシート絞り込み・20件ずつ追加読み込み）＋ 終了一覧（トグル）
  oripa/[id].astro             詳細（数値・送客ボタン・下部固定CTA・同サイトの他オリパ）
  about.astro                  アド確とは・判定基準
  disclaimer.astro             免責事項
  404.astro / robots.txt.ts / sitemap.xml.ts
site/src/styles/global.css     デザイントークン（--primary #1E3EE0 / 送客ボタンは --cta オレンジ）
site/public/                   favicon.svg / apple-touch-icon.png / og.png / hero-*.webp / logos/ / _headers
```

- UI方針は `docs/ui-spec-affiliate.md`（アフィリエイトメディア型。参考: cardchusen.com）
- 依存は `astro` のみ。CSSフレームワークもJSフレームワークも使わない（1ページ ≒ 9.5KB gzip）
- 絞り込み・並び替え・追加読み込み（初期20件＋「もっと見る」で20件ずつ）は静的HTML＋素のJS（`<dialog>` のボトムシート）。選択状態は localStorage に保存
- サイトタイルには各事業者の公開ロゴを表示（`SITE_LOGOS`）。未登録の `site_id` は頭文字マークにフォールバック。出所は `docs/logo-sources.md`
- 一覧カードのオレンジボタンは事業者への直接送客（`rel="sponsored nofollow noopener"`）。終了オリパには出さない
- PR表記は各ページ冒頭の一行とフッターで担保する（CTAの文言には入れない）。冒頭表記はステマ規制対応なので消さないこと
- 事業者のバナー画像は使わないため、カードのビジュアルは `OripaThumb.astro` の自作イラスト（トレカのSVG）で代替している。オリパ名から判定したカテゴリ（ポケカ/ワンピ/遊戯王など）で色とジャンルアイコンを変える。判定は名前の正規表現なので `site_id` には依存しない。IPの意匠（モンスターボール等）は使わず、一般的な題材（稲妻・錨・ピラミッド・星・クリスタル・五角形）に置き換えている。置き換え表は `docs/ui-spec-affiliate.md` §12
- `site_id` はハードコードしない。表示名は `siteLabel()` のマップ、未知のIDはフォールバック表記になるのでサイト追加時にフロントの修正は不要
- `site/src/data/oripa.json` は `.gitignore` 対象。無い／空のときは開発用に `oripa.sample.json` を表示する（本番ビルドでは空なら0件表示）
- 確認時刻はビルド時に絶対時刻で出し、配信後にクライアント側で「N分前」に置き換える（静的配信でも鮮度が出る）

ローカル: `cd site && npm install && npm run dev` → http://localhost:4321
push前に `cd site && npm run build` を必ず通すこと。

## セットアップ手順
### 1. Google（シート・サービスアカウント）
1. Google Cloud Console でプロジェクト作成 → 「Google Sheets API」を有効化
2. IAM → サービスアカウント作成 → キー（JSON）作成してダウンロード
3. スプレッドシートを、そのサービスアカウントのメールアドレスに「編集者」で共有
4. シート名 `oripa`、1行目に以下のヘッダー:
   `id site_id name url price guarantee_text guarantee_value stock_total stock_left starts_at ends_at affiliate_url evidence status reject_reason first_seen_at last_seen_at post_url posted_at misses`

### 2. GAS
1. シートの 拡張機能 → Apps Script に `gas/Code.gs` を貼る
2. プロジェクトの設定 → スクリプトプロパティ: `SECRET` `GITHUB_TOKEN` `GITHUB_REPO` `NOTIFY_TO`
3. デプロイ → ウェブアプリ（実行ユーザー: 自分／アクセス: 全員）
4. トリガー → `notifyNew` を時間主導型・10分おき

### 3. GitHub Secrets / Variables
Settings → Secrets and variables → Actions
- Secrets: `GOOGLE_SERVICE_ACCOUNT_JSON`（JSONファイルの中身）, `SHEET_ID`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`（バナー画像から保証額を読む用）
- Variables: `SITE_BASE_URL`（例 https://adkaku-oripa.pages.dev）
- GAS用PAT: Fine-grained token、対象リポジトリのみ、Contents: Read and write

### 4. Cloudflare Pages
Workers & Pages → Create → Pages → プロジェクト名 `adkaku-oripa`（直接アップロード）。API Token は「Cloudflare Pages: Edit」権限で作成。

### 5. サイト定義の検証
`sites/dokkan-toreca.yml` は検証済み（DOM抽出＋バナー画像判定）。DOPA・エクストレカは同様に構造確認のうえ `enabled: true` にする。
ローカル検証: `npm i && npx playwright install chromium && GOOGLE_SERVICE_ACCOUNT_JSON=... SHEET_ID=... npm run collect`

## 動作確認の手順（初回）

1. Actions → collect → Run workflow を `site=dokkan-toreca`, `dry_run=true` で実行。ログの `[dokkan-toreca] N items` と表を確認（欠損があれば sites/dokkan-toreca.yml のセレクタを修正）
2. 同じく `dry_run=false` で実行 → シートに行が増える（status: new / skip）。vision で name・guarantee が埋まっているか確認
3. 10分以内に承認メールが届く（GASトリガー）→「承認」→ 確認画面で確定 → status: approved
4. Actions で publish が自動起動 → Cloudflare Pages に反映 → X に投稿 → status: posted、post_url が入る
5. 以降は定期実行に任せる（起動は10分おき、実際の収集間隔は Variables `COLLECT_INTERVAL_MIN`、既定50分）。`npm run collect -- <site_id>` / `SITE=<site_id>` で1サイトだけ処理できる

`npm run dry-run -- <site_id>` はシート・vision・X に触れずに抽出だけ試す（サイト追加時の確認用）。

## ステータス遷移
`new`（アド確候補）→ `notified`（メール送信済）→ `approved` → `published` → `posted` → `ended`
`skip`（候補外）／`rejected`（不可）は再通知しない。
