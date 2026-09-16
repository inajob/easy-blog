#!/usr/bin/env node
// OGP 画像を 1200x630 にリサイズし、記事タイトル（OpenCode が生成した日本語タイトル）
// をキャプションとして付ける。記事執筆後に実行する（記事の frontmatter からタイトルを読む）。
// 使い方:
//   node scripts/caption-ogp.mjs [ビルド済みバイナリのパス]
//   既定: ogp-context/ogp-caption（tools/ogp-caption を go build したもの）
//
// 処理:
//   1. ogp-context/info.json を読む
//   2. 対象記事（今日の日付の最新ファイル）の frontmatter title を読む
//   3. ogp-caption を実行（キャプション = 記事タイトル）
//   4. 出力画像 (ogp-<ts>-og.jpg) を public/post-images/ に保存
//   5. 元画像（ogp-context/raw/）を削除し、info.json の image_path / image_url を更新する

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BINARY = process.argv[2] || 'ogp-context/ogp-caption';
const FONT = 'ogp-context/MPLUS1p-Black.ttf';
const META_FILE = 'ogp-context/info.json';
const POSTS_DIR = 'src/content/posts';
const PUBLIC_DIR = 'public/post-images';
const BASE_PATH = process.env.BASE_PATH || '/easy-blog';

function findArticleFile() {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md') && f.startsWith(today))
    .map((f) => path.join(POSTS_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0] || null;
}

function readArticleTitle(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const t = m[1].match(/^title:\s*["']?([^"'\n]+)["']?\s*$/m);
  return t ? t[1].trim() : null;
}

function run() {
  if (!fs.existsSync(META_FILE)) {
    console.log('No info.json found; skipping');
    return;
  }
  const info = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  if (!info.image_path || !fs.existsSync(info.image_path)) {
    console.log(`Image missing or not set (${info.image_path || 'none'}); skipping`);
    return;
  }
  if (!fs.existsSync(BINARY)) {
    console.log(`Binary missing: ${BINARY}`);
    return;
  }

  const article = findArticleFile();
  if (!article) {
    console.log('No article file found; skipping caption');
    return;
  }
  const title = readArticleTitle(article);
  if (!title) {
    console.log(`No title in article ${article}; skipping caption`);
    return;
  }

  const raw = info.image_path;
  const base = path.basename(raw, path.extname(raw));
  const output = path.join(PUBLIC_DIR, `${base}-og.jpg`);
  const caption = title.replace(/[\r\n]+/g, ' ').trim();

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  execFileSync(BINARY, ['-font', FONT, raw, caption, output], { stdio: 'inherit' });

  fs.rmSync(raw, { force: true });
  info.image_path = output;
  info.image_url = `${BASE_PATH}/post-images/${path.basename(output)}`;
  fs.writeFileSync(META_FILE, JSON.stringify(info, null, 2) + '\n');
  console.log(`Caption image: ${info.image_url}`);
  console.log(`Caption title: ${caption}`);
}

run();