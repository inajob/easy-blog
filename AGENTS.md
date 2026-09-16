GitHub Actions + OpenCodeによるレビューブログの半自動生成環境

- Issueに種となるページのURLと場合によっては推しポイントを記載しておく
- `article` ラベル付きの Issue を開くと OpenAI が自動で記事を執筆しPRする
- Issue への `/rerun` コメントで同じ Issue から記事生成を再実行できる（同じ Issue の既存 PR は自動クローズされ、最新のタグで再生成される）
- PRに人間がコメントする。`/brushup`（または `/bs`）で始まるコメントしたタイミングでOpenCodeがその指摘を読み込みPRをブラッシュアップする
- Astroを使ったブログ生成が同梱されておりGitHub Pagesで簡単に配信できる
- 記事作成にあたってのシステムプロンプト自体をこの仕組みで改良する仕組み（`prompt` ラベル付きの Issue から実施できる）

## ワークフローの仕組み

- `.github/workflows/write-article.yml`: `article` ラベル付き Issue で記事生成（OGP取得→キャプション→OpenCode→メタ付与）
- `.github/workflows/brush-up.yml`: PR への `/brushup` コメントで記事修正
- `.github/workflows/polish-prompt.yml`: `prompt` ラベル付き Issue でシステムプロンプト自体を改良

## トリガー条件

- コメントイベントでは **人間のコメントのみ** を対象にする（`github.event.comment.user.type == 'User'`）
- 注意: アクション `@latest` では `prompt:` 入力を指定するとコメント本文は無視されプロンプトがそのまま使われる
  - `write-article` / `polish-prompt` は `prompt:` を指定（`/rerun` コメントは「再実行スイッチ」としてのみ機能）
  - `brush-up` は `prompt:` を指定せず `mentions: /brushup,/bs` を使うため、コメント本文（指摘）がそのままモデルへ届く