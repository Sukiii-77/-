import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const templates = [
  ['00_index', 'Index', 'https://demos.creative-tim.com/material-kit-pro/index'],
  ['01_coworking', 'Coworking', 'https://demos.creative-tim.com/material-kit-pro/pages/coworking.html'],
  ['02_rental', 'Rental', 'https://demos.creative-tim.com/material-kit-pro/pages/rental.html'],
  ['03_case-study', 'Case Study', 'https://demos.creative-tim.com/material-kit-pro/pages/case-study.html'],
  ['04_about-us', 'About Us', 'https://demos.creative-tim.com/material-kit-pro/pages/about-us.html'],
  ['05_pricing', 'Pricing', 'https://demos.creative-tim.com/material-kit-pro/pages/pricing.html'],
  ['06_career', 'Career', 'https://demos.creative-tim.com/material-kit-pro/pages/career.html'],
  ['07_work-with-us', 'Work With Us', 'https://demos.creative-tim.com/material-kit-pro/pages/work-with-us.html'],
  ['08_terms', 'Terms & Conditions', 'https://demos.creative-tim.com/material-kit-pro/pages/terms.html'],
  ['09_help-center', 'Help Center', 'https://demos.creative-tim.com/material-kit-pro/pages/help-center.html'],
  ['10_help-center-basic', 'Help Center Basic', 'https://demos.creative-tim.com/material-kit-pro/pages/help-center-basic.html'],
  ['11_contact-us', 'Contact Us', 'https://demos.creative-tim.com/material-kit-pro/pages/contact-us.html'],
  ['12_contact-us-simple', 'Contact Us Simple', 'https://demos.creative-tim.com/material-kit-pro/pages/contact-us-simple.html'],
  ['13_faq', 'FAQ', 'https://demos.creative-tim.com/material-kit-pro/pages/faq.html'],
  ['14_privacy', 'Privacy', 'https://demos.creative-tim.com/material-kit-pro/pages/privacy.html'],
  ['15_mobile-app', 'Mobile App', 'https://demos.creative-tim.com/material-kit-pro/pages/mobile-app.html'],
  ['16_desktop-app', 'Desktop App', 'https://demos.creative-tim.com/material-kit-pro/pages/desktop-app.html'],
  ['17_blog-single-article', 'Blog Single Article', 'https://demos.creative-tim.com/material-kit-pro/pages/blog/single-article.html'],
  ['18_blog-posts', 'Blog Posts', 'https://demos.creative-tim.com/material-kit-pro/pages/blog/blog-posts.html'],
  ['19_blog-categories', 'Blog Categories', 'https://demos.creative-tim.com/material-kit-pro/pages/blog/categories.html'],
  ['20_blog-author', 'Blog Author', 'https://demos.creative-tim.com/material-kit-pro/pages/blog/author.html'],
  ['21_automotive', 'Automotive', 'https://demos.creative-tim.com/material-kit-pro/pages/automotive.html'],
  ['22_virtual-reality', 'Virtual Reality', 'https://demos.creative-tim.com/material-kit-pro/pages/virtual-reality.html'],
  ['23_smart-home', 'Smart Home', 'https://demos.creative-tim.com/material-kit-pro/pages/smart-home.html'],
  ['24_chat', 'Chat', 'https://demos.creative-tim.com/material-kit-pro/pages/chat.html'],
  ['25_product-page', 'Product Page', 'https://demos.creative-tim.com/material-kit-pro/pages/product-page.html'],
  ['26_sign-in-cover', 'Sign In Cover', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-in/sign-in-cover.html'],
  ['27_sign-in-illustration', 'Sign In Illustration', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-in/sign-in-illustration.html'],
  ['28_sign-in-basic', 'Sign In Basic', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-in/sign-in-basic.html'],
  ['29_sign-in-simple', 'Sign In Simple', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-in/sign-in-simple.html'],
  ['30_sign-up-cover', 'Sign Up Cover', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-up/sign-up-cover.html'],
  ['31_sign-up-illustration', 'Sign Up Illustration', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-up/sign-up-illustration.html'],
  ['32_sign-up-basic', 'Sign Up Basic', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-up/sign-up-basic.html'],
  ['33_sign-up-simple', 'Sign Up Simple', 'https://demos.creative-tim.com/material-kit-pro/pages/sign-up/sign-up-simple.html'],
  ['34_reset-cover', 'Password Reset Cover', 'https://demos.creative-tim.com/material-kit-pro/pages/reset/reset-cover.html'],
  ['35_reset-illustration', 'Password Reset Illustration', 'https://demos.creative-tim.com/material-kit-pro/pages/reset/reset-illustration.html'],
  ['36_reset-basic', 'Password Reset Basic', 'https://demos.creative-tim.com/material-kit-pro/pages/reset/reset-basic.html'],
  ['37_error-404', 'Error 404', 'https://demos.creative-tim.com/material-kit-pro/pages/error-404.html'],
  ['38_error-500', 'Error 500', 'https://demos.creative-tim.com/material-kit-pro/pages/error-500.html'],
  ['39_coming-soon', 'Coming Soon', 'https://demos.creative-tim.com/material-kit-pro/pages/coming-soon.html'],
  ['40_2fa-security', '2FA Security', 'https://demos.creative-tim.com/material-kit-pro/pages/2fa-security.html'],
];

function chromePath() {
  for (const candidate of ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {}
  }
  throw new Error('Chrome/Chromium executable was not found on the runner.');
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const distance = 720;
    const delay = 90;
    await new Promise((resolve) => {
      let total = 0;
      const timer = setInterval(() => {
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.scrollBy(0, distance);
        total += distance;
        if (total >= height - window.innerHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          setTimeout(resolve, 500);
        }
      }, delay);
    });
  });
}

const outputDir = path.resolve('output');
await fs.mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

const results = [];
try {
  for (const [fileBase, title, url] of templates) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(30000);

    const failedRequests = [];
    page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));

    let status = 'ok';
    let note = '';
    try {
      console.log(`Capturing ${fileBase}: ${url}`);
      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      const httpStatus = response?.status() ?? 0;
      await page.addStyleTag({ content: `
        *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
        html { scroll-behavior: auto !important; }
      ` }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1800));
      await autoScroll(page);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await page.screenshot({
        path: path.join(outputDir, `${fileBase}.png`),
        type: 'png',
        fullPage: true,
        captureBeyondViewport: true,
      });
      note = `HTTP ${httpStatus}; failed resources: ${failedRequests.length}`;
    } catch (error) {
      status = 'failed';
      note = String(error?.stack ?? error);
      console.error(`FAILED ${fileBase}:`, note);
      await fs.writeFile(path.join(outputDir, `${fileBase}.error.txt`), `${url}\n\n${note}\n`, 'utf8');
    } finally {
      await page.close();
    }
    results.push({ file: `${fileBase}.png`, title, url, status, note });
  }
} finally {
  await browser.close();
}

const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
const csv = ['file,title,url,status,note', ...results.map((r) => [r.file, r.title, r.url, r.status, r.note].map(escapeCsv).join(','))].join('\n') + '\n';
await fs.writeFile(path.join(outputDir, 'manifest.csv'), csv, 'utf8');

const succeeded = results.filter((r) => r.status === 'ok').length;
const failed = results.length - succeeded;
const readme = [
  'Material Kit 3 PRO template screenshots',
  '=======================================',
  '',
  `Captured: ${new Date().toISOString()}`,
  'Viewport: 1440 × 900 CSS pixels',
  'Mode: desktop, full-page PNG',
  `Successful screenshots: ${succeeded}/${results.length}`,
  `Failed screenshots: ${failed}/${results.length}`,
  '',
  'Scope: the demo index plus the 40 complete Pages and Account page templates listed in the Material Kit 3 PRO navigation.',
  'The 109 reusable section/component examples are not treated as complete page templates.',
  '',
  'See manifest.csv for every file name, template title, source URL and capture status.',
  '',
].join('\n');
await fs.writeFile(path.join(outputDir, 'README.txt'), readme, 'utf8');

if (failed > 0) {
  console.warn(`${failed} captures failed; artifact will still be uploaded with error logs.`);
}
console.log(`Done: ${succeeded}/${results.length} screenshots captured.`);
