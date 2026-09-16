#!/usr/bin/env node
// OGP画像・YouTube埋め込みの URL を記事ファイルのフロントマッターに機械的に付与する。
// 使い方:
//   node scripts/apply-meta.mjs [対象ファイル]
//   ※ 引数なしの場合、src/content/posts/ で今日の日付の最新ファイルを探す
//
// 処理:
//   1. ogp-context/info.json を読む
//   2. 記事ファイルのフロントマッターに image: が無ければ image_url を追記
//   3. フロントマッターに youtube: が無ければ youtube_embeds（embed URL 配列）を追記
//   4. 変更があればファイルを書き出す
//   ※ YouTube のレンダリングは SSG 側（[...slug].astro）が行う

import fs from 'node:fs';
import path from 'node:path';

const POSTS_DIR = 'src/content/posts';
const META_FILE = 'ogp-context/info.json';

function findArticleFile() {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md') && f.startsWith(today))
    .map((f) => path.join(POSTS_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0] || null;
}

function hasField(frontmatter, field) {
  return new RegExp(`^${field}:\\s*`, 'm').test(frontmatter);
}

function addImageToFrontmatter(frontmatter, imageUrl) {
  if (hasField(frontmatter, 'image')) return frontmatter;
  return frontmatter.trimEnd() + `\nimage: "${imageUrl}"\n`;
}

function addYoutubeToFrontmatter(frontmatter, embeds) {
  if (hasField(frontmatter, 'youtube')) return frontmatter;
  const items = embeds.map((u) => `"${u}"`).join(', ');
  return frontmatter.trimEnd() + `\nyoutube: [${items}]\n`;
}

function main() {
  if (!fs.existsSync(META_FILE)) {
    console.log('No ogp-context/info.json found; skipping');
    return;
  }
  const info = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));

  const target = process.argv[2] || findArticleFile();
  if (!target || !fs.existsSync(target)) {
    console.log('No article file found; skipping');
    return;
  }

  const original = fs.readFileSync(target, 'utf8');
  let frontmatter;
  let newBody;

  // Frontmatter の解析: 最初の --- と 2 番目の --- の間
  const fmMatch = original.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.log('No frontmatter found; skipping');
    return;
  }

  const fmFull = fmMatch[0];
  frontmatter = fmMatch[1];
  newBody = original.slice(fmFull.length);

  // 画像をフロントマッターに追記
  if (info.image_url) {
    frontmatter = addImageToFrontmatter(frontmatter, info.image_url);
  }

  // YouTube の embed URL をフロントマッターに追記（SSG 側でレンダリング）
  if (info.youtube_embeds?.length > 0) {
    frontmatter = addYoutubeToFrontmatter(frontmatter, info.youtube_embeds);
  }

  const newContent = '---\n' + frontmatter.trimEnd() + '\n---\n' + newBody.trimStart();

  if (newContent !== original) {
    fs.writeFileSync(target, newContent);
    console.log(`Updated: ${target}`);
    if (info.image_url) console.log(`  image: ${info.image_url}`);
    if (info.youtube_embeds?.length > 0) console.log(`  youtube: ${info.youtube_embeds.length} embed(s)`);
  } else {
    console.log('No changes needed');
  }
}

main();
