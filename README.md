# adkaku-oripa

アド確ネットオリパ情報の収集 → 承認 → サイト掲載 → X投稿 を自動化する。

## 構成
- `sites/*.yml` — 収集対象サイトの定義（1サイト1ファイル）。追加は定義ファイル追加のみ
- `scripts/collect.mjs` — Playwrightで収集しシートへ書き込み（Actions: 30分おき）
- `scripts/export-data.mjs` — シート → `site/src/data/oripa.json`、approved → published
- `scripts/post-x.mjs` — published → X投稿 → posted
- `gas/Code.gs` — 承認メール送信・承認/不可受付・GitHubへdispatch
- `site/` — Astro静的サイト（Cloudflare Pages）

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
5. 以降は cron（30分）に任せる。`npm run collect -- <site_id>` / `SITE=<site_id>` で1サイトだけ処理できる

`npm run dry-run -- <site_id>` はシート・vision・X に触れずに抽出だけ試す（サイト追加時の確認用）。

## ステータス遷移
`new`（アド確候補）→ `notified`（メール送信済）→ `approved` → `published` → `posted` → `ended`
`skip`（候補外）／`rejected`（不可）は再通知しない。
