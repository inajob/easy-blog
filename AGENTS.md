GitHub Actions + OpenCodeによるレビューブログの半自動生成環境

- Issueに種となるページのURLと場合によっては推しポイントを記載しておく
- `article` ラベル付きの Issue を開くと OpenAI が自動で記事を執筆しPRする
- Issue への `/rerun` コメントで同じ Issue から記事生成を再実行できる（同じ Issue の既存 PR は自動クローズされ、最新のタグで再生成される）
- PRに人間がコメントする。`/brushup`（または `/bs`）で始まるコメントしたタイミングでOpenCodeがその指摘を読み込みPRをブラッシュアップする
- PR への `/qa` コメント（質問）にはファイル変更なしで回答コメントだけを返す（article-qa エージェント）
- Astroを使ったブログ生成が同梱されておりGitHub Pagesで簡単に配信できる
- 記事作成にあたってのシステムプロンプト自体をこの仕組みで改良する仕組み（`prompt` ラベル付きの Issue から実施できる）

## ワークフローの仕組み

- `.github/workflows/write-article.yml`: `article` ラベル付き Issue で記事生成（OGP取得→キャプション→OpenCode→メタ付与）
- `.github/workflows/brush-up.yml`: PR への `/brushup` コメントで記事修正
- `.github/workflows/qa-reply.yml`: PR への `/qa` コメント（質問）に回答コメントを返す
- `.github/workflows/polish-prompt.yml`: `prompt` ラベル付き Issue でシステムプロンプト自体を改良

## トリガー条件

- コメントイベントでは **人間のコメントのみ** を対象にする（`github.event.comment.user.type == 'User'`）
- 注意: アクション `@latest` では `prompt:` 入力を指定するとコメント本文は無視されプロンプトがそのまま使われる
  - 各ワークフローは `prompt:` にコメント本文（`${{ github.event.comment.body }}`）を埋め込んで使用する
  - `write-article` / `polish-prompt`: 固定のプロンプトを使う（`/rerun` コメントは「再実行スイッチ」としてのみ機能）
  - `brush-up`: 修正指示を明示したプロンプトにコメント本文を埋め込み、記事ファイルの編集を必須にする
    （`mentions` 指定ではなく `prompt:` 埋め込み方式にしたことで、「コメントを読むだけで修正しない」ことを防止している）
  - `qa-reply`: 回答用プロンプトなしで `mentions: /qa` を使い、コメント本文（質問）を article-qa エージェントに渡して回答コメントを得る。
    エージェントは `edit`/bash 権限を持たないため、ファイル変更や PR ブランチへの push は発生せず、記事へは影響しない