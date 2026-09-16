# easy-blog 実装手順

GitHub Actions + OpenCode によるレビューブログ半自動生成環境の実装・セットアップ手順。

- **モデル**: `opencode/big-pickle`（OpenCode Zen 無料枠・全ワークフロー共通）
- **配信先**: GitHub Pages ユーザーページ `https://inajob.github.io/easy-blog/`

## 手順

### 1. ブログ基盤の作成
- [x] `package.json`（astro 導入、`dev/build/preview/check` スクリプト）
- [x] `astro.config.mjs` — `site: 'https://inajob.github.io'`, `base: '/easy-blog/'`
- [x] `public/favicon.svg`, `src/styles/global.css`
- [x] `src/content.config.ts` — posts スキーマ（`title/description/pubDate/tags/url`）
- [x] `src/layouts/BaseLayout.astro`
- [x] `src/pages/index.astro`（一覧）, `src/pages/posts/[...slug].astro`（詳細）
- [x] サンプル記事 1 本 → `npm run build` と `npm run check` で動作確認

### 2. OpenCode 設定・システムプロンプト
- [x] `opencode.json` — 既定モデル `opencode/big-pickle`、permissions
- [x] `.opencode/agents/article-writer.md` — 執筆規約（元URLから事実・推しポイント反映・捏造禁止・構成）
- [x] `.opencode/agents/prompt-polisher.md` — 差分ベースでの改善・理由付け・過剰改変防止

### 3. GitHub Actions ワークフロー（4本）
- [x] `write-article.yml` — `issues[opened,edited,labeled,unlabeled]` + `label=article` → 記事 PR 作成
- [x] `polish-prompt.yml` — 同トリガー + `label=prompt` → プロンプト改善 PR
- [x] `brush-up.yml` — `issue_comment[created]`、`/brushup` コメント（Bot 除外）→ 既存 PR を修正
- [x] `deploy.yml` — `push: [main]` → Pages v2 デプロイ

### 4. GitHub 側セットアップ（手動）
- [ ] [github.com/apps/opencode-agent](https://github.com/apps/opencode-agent) を easy-blog リポジトリに導入
- [ ] Repo Settings → Secrets and variables → Actions → `OPENCODE_API_KEY`（Zen キー）を登録
- [ ] Repo Settings → Pages → Source: **GitHub Actions** に設定
- [ ] `main` ブランチに push（リポジトリ初期化 & 上記作成物を commit）

### 5. 動作テスト
- [ ] `label=article` の Issue（種URL + 推しポイント）を発行 → 記事 PR が自動生成される
- [ ] PR に `/brushup 指摘` とコメント → 修正 commit が入る
- [ ] merge → Pages に配信される
- [ ] `label=prompt` の Issue でプロンプト改良ループが動く