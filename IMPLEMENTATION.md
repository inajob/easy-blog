# easy-blog 実装手順

GitHub Actions + OpenCode によるレビューブログ半自動生成環境の実装・セットアップ手順。

- **モデル**: `opencode/big-pickle`（OpenCode Zen 無料枠・全ワークフロー共通）
- **配信先**: GitHub Pages ユーザーページ `https://inajob.github.io/easy-blog/`
- **GitHub 連携**: OpenCode GitHub App は使わず、runner の `GITHUB_TOKEN`（`use_github_token: true`）で運用
  - 運用ルール: **1 ランで作業を完結させ、次のランは人間のアクション（Issue・`/brushup` コメント）で開始する**。
    Bot の commit/コメントではワークフローが再起動しない（GITHUB_TOKEN の仕様）が、人間トリガーは常に動くため全ループが成立する
  - **git 認証はワークフロー側で明示設定する**（`use_github_token` モードでは基盤が push 認証を設定しないため、
    checkout 直後の `Configure git auth` ステップで `AUTHORIZATION` ヘッダと commit identity を補う）
  - **エージェントに bash を許可しない**（article-writer / prompt-polisher）。agent が自前で `git`/`gh` を実行すると
    基盤の `switched` 検知により push/PR がスキップされ、PR が作られずコメントだけが返る事故になる

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
- [x] `write-article.yml` — `issues[opened]` + `label=article` → 記事 PR 作成（`use_github_token`）
- [x] `polish-prompt.yml` — `issues[opened]` + `label=prompt` → プロンプト改善 PR（`use_github_token`）
- [x] `brush-up.yml` — `issue_comment[created]`、`/brushup` コメント（Bot 除外）→ 既存 PR を修正（`use_github_token`）
- [x] `deploy.yml` — `push: [main]` → Pages v2 デプロイ

> トリガーは `issues[opened]` のみ。**ラベルは Issue 作成時に付与する**こと
> （`opened`+`labeled` の両方を指定すると作成時に 2 回発火するため）。
> もし後からラベルを付けた場合に自動実行させたければ `labeled` を追加し、
> `concurrency`（Issue 番号キー + cancel-in-progress）で単一実行に絞ること。

### 4. GitHub 側セットアップ（手動）
- [ ] Repo Settings → Secrets and variables → Actions → `OPENCODE_API_KEY`（Zen キー）を登録
- [ ] Repo Settings → **Actions → General → Workflow permissions** →「**Allow GitHub Actions to create and approve pull requests**」をチェック
      （オフだと `GITHUB_TOKEN` での PR 作成が `GitHub Actions is not permitted to create or approve pull requests` で失敗する）
- [ ] Repo Settings → Pages → Source: **GitHub Actions** に設定
- [ ] `main` ブランチに push（リポジトリ初期化 & 上記作成物を commit）

> 非モード時の補足: 真の自動再トリガー（Bot 同士の多段自動化）が将来必要になったら、PAT を secret として
> `GITHUB_TOKEN` に渡すか、OpenCode GitHub App を導入すれば対応できる。

### 5. 動作テスト
- [ ] `label=article` の Issue（種URL + 推しポイント）を発行 → 記事 PR が自動生成される
- [ ] PR に `/brushup 指摘` とコメント → 修正 commit が入る
- [ ] merge → Pages に配信される
- [ ] `label=prompt` の Issue でプロンプト改良ループが動く