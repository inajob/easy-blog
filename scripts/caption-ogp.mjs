#!/usr/bin/env node
// OGP 画像を 1200x630 にリサイズし、キャプション（og:title）を付ける。
// 使い方:
//   node scripts/caption-ogp.mjs [ビルド済みバイナリのパス]
//   既定: ogp-context/ogp-caption（tools/ogp-caption を go build したもの）
//
// 処理:
//   1. ogp-context/info.json を読む
//   2. image_path と title があれば ogp-caption を実行
//   3. 出力画像 (ogp-<ts>-og.jpg) を public/post-images/ に保存
//   4. 元画像を削除し、info.json の image_path / image_url を更新する

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BINARY = process.argv[2] || 'ogp-context/ogp-caption';
const FONT = 'ogp-context/MPLUS1p-Black.ttf';
const META_FILE = 'ogp-context/info.json';
const BASE_PATH = process.env.BASE_PATH || '/easy-blog';

function run() {
  if (!fs.existsSync(META_FILE)) {
    console.log('No info.json found; skipping');
    return;
  }
  const info = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  if (!info.image_path || !info.title) {
    console.log('No image or title; skipping');
    return;
  }
  if (!fs.existsSync(info.image_path)) {
    console.log(`Image missing: ${info.image_path}`);
    return;
  }
  if (!fs.existsSync(BINARY)) {
    console.log(`Binary missing: ${BINARY}`);
    return;
  }

  const raw = info.image_path;
  const base = path.basename(raw, path.extname(raw));
  const output = path.join(path.dirname(raw), `${base}-og.jpg`);
  const caption = info.title.replace(/[\r\n]+/g, ' ').trim();

  execFileSync(BINARY, ['-font', FONT, raw, caption, output], { stdio: 'inherit' });

  fs.rmSync(raw, { force: true });
  info.image_path = output;
  info.image_url = `${BASE_PATH}/post-images/${path.basename(output)}`;
  fs.writeFileSync(META_FILE, JSON.stringify(info, null, 2) + '\n');
  console.log(`Caption image: ${info.image_url}`);
}

run();