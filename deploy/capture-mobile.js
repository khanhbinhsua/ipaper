const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = 'http://localhost:5173'; const API = 'http://localhost:3100/api';
const OUT = path.join(__dirname, 'shots-mobile'); fs.mkdirSync(OUT, { recursive: true });

async function login(page, u) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.getByPlaceholder(/Mã tổ chức/i).fill('demo');
  await page.getByPlaceholder(/Tên đăng nhập/i).fill(u);
  await page.getByPlaceholder(/Mật khẩu/i).fill('123456A@');
  await page.getByRole('button', { name: /Đăng nhập/i }).click();
  await page.waitForURL((x) => !x.toString().includes('/login'), { timeout: 10000 });
  await page.waitForTimeout(1200);
}
async function shot(page, n) { await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: 'vi-VN' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' }); await shot(page, 'm1-login');
  await login(page, 'truongphong');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await shot(page, 'm2-dashboard');
  // open drawer
  await page.locator('button').filter({ has: page.locator('.anticon-menu') }).first().click().catch(()=>{});
  await page.waitForTimeout(800); await shot(page, 'm3-drawer');
  await page.keyboard.press('Escape').catch(()=>{});
  await page.goto(BASE + '/inbox', { waitUntil: 'networkidle' }); await shot(page, 'm4-inbox');
  await b.close(); console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
