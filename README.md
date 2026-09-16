# easy-blog

GitHub Actions + OpenCode による **レビューブログの半自動生成環境**です。
気になるページの URL を Issue に投稿すると、AI が記事を執筆して Pull Request で出してくれます。人間はレビューしてコメントで修正を依頼し、マージすれば GitHub Pages に公開されます。

## 特徴

- **Issue から記事生成**: `label=article` の Issue に種ページの URL（と任意の推しポイント）を書くだけで記事が執筆される
- **PR レビュー中心の運用**: 生成された記事は必ず Pull Request になり、人間が確認・修正依頼・マージを行う
- **OGP 画像 + YouTube 埋め込みの自動付与**: 元ページの OGP 画像を 1200x630 にリサイズしキャプションを重ねて表示、YouTube 動画は記事内に埋め込む
- **「プロンプト自体も改善する」ループ**: `label=prompt` の Issue からシステムプロンプトを改良し、その変更も PR でレビューできる
- **Astro + GitHub Pages**: 生成物は Astro で SSG し、GitHub Pages（`actions/deploy-pages`）で配信

## クイックスタート

### 1. README を自分用に書き換える

このリポジトリを **Fork / Clone** して以下を調整します。

- `astro.config.mjs` の `site` / `base` を自分の Pages URL に合わせる
  - 例: `https://<user>.github.io/` の `/easy-blog/` 配下なら `site: "https://<user>.github.io"`, `base: "/easy-blog/"`
- 発行先の URL が決まったら `.github/workflows/deploy.yml` はそのまま動きます

### 2. GitHub 側のセットアップ

リポジトリ設定で 3 つ行います。

1. **`OPENCODE_API_KEY` シークレットを登録** — Settings → Secrets and variables → Actions
   - OpenCode Zen の API キー（無料枠あり）。モデルは `opencode/big-pickle`
2. **「Allow GitHub Actions to create and approve pull requests」を有効化** — Settings → Actions → General → Workflow permissions
   - オフのままだと PR 自動作成が `GitHub Actions is not permitted...` で失敗します
3. **Pages のソースを「GitHub Actions」に設定** — Settings → Pages
   - これで `push: [main]` 時に自動デプロイされます

`main` に push すれば初期デプロイが走ります。

## 使い方

### 記事を書いてもらう

1. **`label=article`** を付けて Issue を作成する
2. Issue 本文に **種ページの URL**（必須）と、気になる点などの**推しポイント**（任意）を書く
   ```markdown
   https://example.com/interesting-page

   このページの◯◯のアイデアが良かったです
   ```
3. 数分待つと **記事執筆の Pull Request** が自動生成される

> 💡 **ラベルは Issue 作成時に付けてください**（`opened` で発火するため、後付けだと自動実行されません）。

### 記事の内容に質問する

PR のコメントに `/qa` で始まる質問を書くと、**回答コメントだけ**を返します（記事は変更されません）。

```
/qa 第2段落で言っていることを簡単に説明して
```

### 修正を依頼する（ブラッシュアップ）

PR のコメントに `/brushup`（または `/bs`）で始まる指示を書くと、**記事ファイルを実際に編集**して PR に反映します。

```
/brushup 第2段落の表現が分かりにくいので直して
```

### 記事を再生成する

同じ Issue のコメントに `/rerun` と書くと、記事を最初から書き直します。その Issue の既存 PR は自動的にクローズされます。

### 公開する

PR をマージすると `push: [main]` が走って GitHub Pages に反映されます。

## システムプロンプトの改善ループ

AI に「システムプロンプト自体を改善させる」こともできます。

1. **`label=prompt`** の Issue を開き、改善したい点を書く
2. 参考にしたい**既存 PR の URL** を本文に書くと、その PR のコメント・レビューやり取りを読み込んで改善の参考にする
3. システムプロンプトの改善 PR が生成されるので、レビューしてマージ

対象ファイル: `.opencode/agents/article-writer.md`（記事執筆）、`.opencode/agents/prompt-polisher.md`（プロンプト改善）、`AGENTS.md` など

## 仕組み

```
Issue（label=article） ──▶ 記事執筆 PR ──▶ /qa 質問 ──▶ 回答コメント
        │                        │             /brushup ──▶ 記事編集
        ├─ /rerun で再生成        │
        │                        ▼
label=prompt の Issue ──▶ システムプロンプト改善 PR ──▶ マージ ──▶ GitHub Pages 公開
```

### ワークフロー一覧（`.github/workflows/`）

| ワークフロー | トリガー | 動作 |
|---|---|---|
| `write-article.yml` | `article` ラベル Issue の作成 / `/rerun` | OGP 取得 → キャプション付与 → OpenCode で記事執筆 → PR 作成 → メタ（image/youtube）追記 |
| `brush-up.yml` | PR への `/brushup`（`/bs`）コメント | コメント本文の指示で記事ファイルを編集 |
| `qa-reply.yml` | PR への `/qa` コメント | 質問に回答コメントを返す（記事は変更しない） |
| `polish-prompt.yml` | `prompt` ラベル Issue の作成 / `/rerun` | システムプロンプトを改善して PR |
| `deploy.yml` | `push: [main]` | Astro でビルドして GitHub Pages へデプロイ |

### エージェント（`.opencode/agents/`）

| エージェント | 役割 | 権限 |
|---|---|---|
| `article-writer.md` | 3 段落・プレーンテキストの記事を執筆・ブラッシュアップするライター | read / edit / webfetch 等（bash なし） |
| `article-qa.md` | 記事についての質問に答えるガイド | read / webfetch 等（edit / bash なし） |
| `prompt-polisher.md` | システムプロンプトを最小差分で改善 | read / edit（bash なし） |

### OGP / YouTube パイプライン（`scripts/`）

1. `scripts/fetch-ogp.mjs` — 種ページの `og:image` を取得し、YouTube 埋め込み URL を抽出（`ogp-context/info.json` に保存）
2. `scripts/caption-ogp.mjs` + `tools/ogp-caption`（Go バイナリ）— 画像を 1200x630 にリサイズし、キャプション（og:title）を縁取り付きで重ねる
3. `scripts/apply-meta.mjs` — 記事の frontmatter に `image:` と `youtube:` を機械的に追記（SSG 側が表示）

LLM は画像や埋め込みを知らずに記事本文だけを書き、メタ情報は後処理で自動付与されるため、生成物が安定します。

## ローカルの開発

```bash
npm install
npm run dev     # ローカルでブログをプレビュー (http://localhost:4321)
npm run check   # 型・スキーマ検証
npm run build   # 静的サイトを dist/ に生成
```

記事は `src/content/posts/YYYY-MM-DD-<slug>.md` にあります。手書きの記事もこの形式なら同じスキーマで表示されます。

## 関連ドキュメント

- [`AGENTS.md`](./AGENTS.md) — この仕組み自体の説明（GitHub Actions / OpenCode の運用ルール）
- [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) — 実装手順・セットアップの詳細・動作テストリスト

## 前提 / 注意

- GitHub Actions + OpenCode を利用するため **Actions の利用（課金枠）と `OPENCODE_API_KEY` が必要**
- 記事の質は基盤のモデルに依存します。記事は必ず人間がレビューしてから公開してください
- 並行して `article` と `prompt` ラベルの Issue は動かせますが、コンテンツ生成系は同じ Issue 番号に対して 1 実行に直列化されます（`concurrency`）