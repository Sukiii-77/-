import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { imageSize } from 'image-size';

const TARGET_COUNT = 16;
const SEARCH_URL = 'https://unsplash.com/s/photos/food?orientation=landscape';
const OUT_DIR = path.resolve('unsplash-food-landscape');
const IMG_DIR = path.join(OUT_DIR, 'images');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slugify = (value) => String(value || 'unknown')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase()
  .slice(0, 48) || 'unknown';

await fs.rm(OUT_DIR, { recursive: true, force: true });
await fs.mkdir(IMG_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1440,1100',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36');

console.log(`Opening ${SEARCH_URL}`);
await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 90000 });
await sleep(2500);

// Close cookie/privacy or promotional overlays when present.
await page.evaluate(() => {
  const labels = ['Accept all', 'Accept', 'Agree', 'Got it', 'No thanks', 'Close'];
  for (const el of [...document.querySelectorAll('button, [role="button"]')]) {
    const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
    if (labels.some((label) => text.toLowerCase() === label.toLowerCase())) {
      try { el.click(); } catch {}
    }
  }
});

// Load enough search results while allowing lazy-loaded images to resolve.
for (let i = 0; i < 14; i += 1) {
  await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 0.82, 760)));
  await sleep(900);
}
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(1200);

const candidates = await page.evaluate(() => {
  const absolute = (href) => {
    try { return new URL(href, location.origin).href.split('?')[0]; } catch { return ''; }
  };
  const chooseLargest = (img) => {
    const values = (img.getAttribute('srcset') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const bits = item.split(/\s+/);
        return { url: bits[0], width: Number.parseInt(bits[1] || '0', 10) || 0 };
      })
      .sort((a, b) => b.width - a.width);
    return values[0]?.url || img.currentSrc || img.src || '';
  };

  const found = [];
  const seen = new Set();
  const images = [...document.querySelectorAll('img[src*="images.unsplash.com"], img[srcset*="images.unsplash.com"]')];

  for (const img of images) {
    const photoAnchor = img.closest('a[href*="/photos/"]');
    if (!photoAnchor) continue;
    const photoUrl = absolute(photoAnchor.href);
    if (!/^https:\/\/unsplash\.com\/photos\//.test(photoUrl) || seen.has(photoUrl)) continue;

    const naturalWidth = img.naturalWidth || 0;
    const naturalHeight = img.naturalHeight || 0;
    const rect = img.getBoundingClientRect();
    const ratio = naturalWidth && naturalHeight
      ? naturalWidth / naturalHeight
      : (rect.height ? rect.width / rect.height : 0);
    if (ratio < 1.08) continue;

    let container = img.parentElement;
    let freeDownload = null;
    let profileAnchor = null;
    for (let depth = 0; container && depth < 10; depth += 1, container = container.parentElement) {
      freeDownload ||= container.querySelector('a[href*="download"], a[title*="Download" i], button[aria-label*="Download" i]');
      profileAnchor ||= container.querySelector('a[href^="/@"], a[href*="unsplash.com/@"]');
      if (freeDownload && profileAnchor) break;
    }
    if (!freeDownload) continue;

    const raw = chooseLargest(img);
    if (!raw.includes('images.unsplash.com')) continue;

    const author = (profileAnchor?.textContent || profileAnchor?.getAttribute('aria-label') || 'Unknown photographer').trim();
    const authorUrl = profileAnchor ? absolute(profileAnchor.href) : '';
    found.push({
      photoUrl,
      author,
      authorUrl,
      alt: (img.alt || '').trim(),
      raw,
      detectedRatio: ratio,
    });
    seen.add(photoUrl);
  }
  return found;
});

console.log(`Found ${candidates.length} free landscape candidates`);

const records = [];
for (const candidate of candidates) {
  if (records.length >= TARGET_COUNT) break;
  try {
    const url = new URL(candidate.raw);
    for (const key of ['w', 'h', 'fit', 'crop', 'rect', 'dpr', 'auto']) url.searchParams.delete(key);
    url.searchParams.set('fm', 'jpg');
    url.searchParams.set('fit', 'max');
    url.searchParams.set('w', '2400');
    url.searchParams.set('q', '86');

    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
        Referer: candidate.photoUrl,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100_000) throw new Error(`file too small (${buffer.length} bytes)`);

    const dimensions = imageSize(buffer);
    if (!dimensions.width || !dimensions.height || dimensions.width <= dimensions.height) {
      throw new Error(`not landscape (${dimensions.width}x${dimensions.height})`);
    }

    const number = String(records.length + 1).padStart(2, '0');
    const filename = `${number}-${slugify(candidate.author)}-${slugify(candidate.alt).slice(0, 42)}.jpg`;
    await fs.writeFile(path.join(IMG_DIR, filename), buffer);

    const record = {
      number: records.length + 1,
      filename,
      width: dimensions.width,
      height: dimensions.height,
      bytes: buffer.length,
      description: candidate.alt || 'Food photograph',
      photographer: candidate.author,
      photographer_url: candidate.authorUrl,
      unsplash_photo_url: candidate.photoUrl,
      downloaded_image_url: url.href,
    };
    records.push(record);
    console.log(`Saved ${filename} (${dimensions.width}x${dimensions.height})`);
  } catch (error) {
    console.warn(`Skipped ${candidate.photoUrl}: ${error.message}`);
  }
}

await browser.close();

if (records.length < 10) {
  throw new Error(`Only ${records.length} valid landscape images were downloaded; expected at least 10.`);
}

const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csvHeaders = [
  'number', 'filename', 'width', 'height', 'bytes', 'description',
  'photographer', 'photographer_url', 'unsplash_photo_url', 'downloaded_image_url',
];
const csv = [
  csvHeaders.join(','),
  ...records.map((record) => csvHeaders.map((key) => csvEscape(record[key])).join(',')),
].join('\n');
await fs.writeFile(path.join(OUT_DIR, 'ATTRIBUTION.csv'), `${csv}\n`, 'utf8');
await fs.writeFile(path.join(OUT_DIR, 'metadata.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');

const readme = `# Unsplash 横向美食图片\n\n- 来源搜索页：${SEARCH_URL}\n- 图片数量：${records.length}\n- 筛选：仅保留搜索结果中可免费下载、原图宽度大于高度的图片\n- 文件：无水印 JPEG，最长边请求约 2400px；实际尺寸见 ATTRIBUTION.csv\n- 说明：图片仍受 Unsplash License 约束。正式发布时建议保留摄影师署名与原图片链接。\n\n## 图片清单\n\n${records.map((r) => `${r.number}. **${r.filename}** — ${r.photographer} — ${r.width}×${r.height}\n   - 原图页：${r.unsplash_photo_url}\n   - 摄影师：${r.photographer_url || '未识别'}`).join('\n')}\n`;
await fs.writeFile(path.join(OUT_DIR, 'README.md'), readme, 'utf8');

console.log(`Completed: ${records.length} images in ${OUT_DIR}`);
