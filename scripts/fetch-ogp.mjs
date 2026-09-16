#!/usr/bin/env node
// 種ページの OGP 画像・タイトル・説明を取得し、記事で使える形で配置する。
// 使用法:
//   node scripts/fetch-ogp.mjs --url <seed-url>
//   node scripts/fetch-ogp.mjs --issue-title "<issue title>" --issue-body "<issue body>"
//
// 出力:
//   - 画像を ogp-context/raw/<ogp-<timestamp>.<ext>> に保存（gitignore 対象。ここで直接
//     public に入れず、キャプション生成（caption-ogp.mjs）の後に public/post-images/ へ出る）
//   - メタ情報を ogp-context/info.json に出力（ogp-context/ は gitignore 対象）
// 取得できない場合・エラー時はプロセスを終了させず、情報なしで続行する。

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = argValue('--url');
const issueTitle = argValue('--issue-title');
const issueBody = argValue('--issue-body');

const OUT_DIR = 'ogp-context/raw';
const OUT_META = 'ogp-context/info.json';

const META_TARGETS = [
  'og:image',
  'og:image:secure_url',
  'og:image:url',
  'twitter:image',
  'twitter:image:src',
];

const CONTENT_TYPE_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

function extractUrl(text) {
  const m = text && text.match(/https?:\/\/[^\s<>"')]+/);
  return m ? m[0].replace(/[.,;:]$/, '') : null;
}

function parseMetaAttributes(tag) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function extractMetaTag(html, targets) {
  const tagRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html)) !== null && m[0].length < 2000) {
    const attrs = parseMetaAttributes(m[0]);
    const property = (attrs.property || attrs.name || '').toLowerCase();
    const key = (attrs.primitive || attrs.key || '').toLowerCase();
    if ((targets.includes(property) || targets.includes(key)) && attrs.content) {
      return attrs.content.trim();
    }
  }
  return null;
}

function pickOgpValue(html, name) {
  return extractMetaTag(html, [name]);
}

const YOUTUBE_EMBED_URL = (id) => `https://www.youtube-nocookie.com/embed/${id}`;

function normalizeEmbedSrc(src) {
  let u;
  try {
    u = new URL(src, 'https://example.com');
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const isYouTube = host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com');
  const id = u.pathname.match(/\/embed\/([\w-]+)/)?.[1];
  return isYouTube && id ? id : null;
}

export function extractYoutubeEmbeds(html) {
  const out = [];
  const seen = new Set();
  const push = (id) => {
    if (id && !seen.has(id) && out.length < 3) {
      seen.add(id);
      out.push(YOUTUBE_EMBED_URL(id));
    }
  };
  const iframeRe = /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = iframeRe.exec(html)) !== null) push(normalizeEmbedSrc(m[1]));
  if (out.length === 0) {
    const linkRe = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/g;
    let lm;
    while ((lm = linkRe.exec(html)) !== null) push(lm[1]);
  }
  return out;
}

async function fetchHtml(target) {
  const res = await fetch(target, {
    headers: { 'user-agent': 'easy-blog-ogp-fetcher/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${target}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('html') && !ct.includes('text')) {
    throw new Error(`Not HTML (${ct}) for ${target}`);
  }
  return res.text();
}

async function main() {
  const issuesText = [issueTitle, issueBody].filter(Boolean).join('\n');
  const seedUrl = url || extractUrl(issuesText);
  if (!seedUrl) {
    console.log('No seed URL found; skipping OGP fetch');
    return;
  }
  if (issuesText) console.log(`Seed URL extracted: ${seedUrl}`);

  let html;
  let ogImage;
  try {
    html = await fetchHtml(seedUrl);
  } catch (e) {
    console.log(`Could not fetch page: ${e.message}; skipping OGP fetch`);
    return;
  }

  for (const target of META_TARGETS) {
    const v = pickOgpValue(html, target);
    if (v) {
      ogImage = v;
      break;
    }
  }

  let absolute;
  try {
    absolute = ogImage ? new URL(ogImage, seedUrl).href : null;
  } catch {
    absolute = null;
  }

  const ogTitle = pickOgpValue(html, 'og:title');
  const ogDescription = pickOgpValue(html, 'og:description');

  let imageUrl = null;
  if (absolute) {
    try {
      const res = await fetch(absolute, {
        headers: { 'user-agent': 'easy-blog-ogp-fetcher/1.0' },
        redirect: 'follow',
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        const ext = CONTENT_TYPE_EXT[ct.split(';')[0].trim()];
        if (ext && Number(res.headers.get('content-length') || 0) <= 10 * 1024 * 1024) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 0 && buf.length <= 10 * 1024 * 1024) {
            fs.mkdirSync(OUT_DIR, { recursive: true });
            const filename = `ogp-${Date.now()}.${ext}`;
            fs.writeFileSync(path.join(OUT_DIR, filename), buf);
            imageUrl = filename;
            // image_url（ブログ上で参照する最終 URL）はキャプション生成後に caption-ogp.mjs が設定する
          }
        }
      }
    } catch (e) {
      console.log(`Could not fetch image: ${e.message}`);
    }
  }

  const youtube_embeds = extractYoutubeEmbeds(html);

  const info = {
    image_path: imageUrl ? path.join(OUT_DIR, path.basename(imageUrl)) : null,
    // image_url は caption-ogp.mjs で記事タイトルをキャプションにしてから設定する
    image_url: null,
    title: ogTitle || null,
    description: ogDescription || null,
    seed_url: seedUrl,
    youtube_embeds,
  };
  fs.mkdirSync(path.dirname(OUT_META), { recursive: true });
  fs.writeFileSync(OUT_META, JSON.stringify(info, null, 2) + '\n');
  console.log(JSON.stringify(info));
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });