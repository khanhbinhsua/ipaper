const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3100/api';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

async function login(page, username) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const inputs = page.locator('input');
  // 3 ô: tenant, username, password (theo thứ tự form)
  await page.getByPlaceholder(/Mã tổ chức/i).fill('demo');
  await page.getByPlaceholder(/Tên đăng nhập/i).fill(username);
  await page.getByPlaceholder(/Mật khẩu/i).fill('123456A@');
  await page.getByRole('button', { name: /Đăng nhập/i }).click();
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 10000 });
  await page.waitForTimeout(1500);
}

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  console.log('shot:', name);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1.5, locale: 'vi-VN' });
  const page = await ctx.newPage();

  // 1. Login page
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '01-login');

  // Login as truongphong (có hồ sơ đến để duyệt)
  await login(page, 'truongphong');

  // 2. Dashboard
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await shot(page, '02-dashboard');

  // 3. Inbox
  await page.goto(BASE + '/inbox', { waitUntil: 'networkidle' });
  await shot(page, '03-inbox');

  // 4. Document detail (tìm 1 hồ sơ trong inbox)
  try {
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const res = await page.request.get(API + '/documents/search?box=inbox', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    if (data.items && data.items.length) {
      await page.goto(BASE + '/documents/' + data.items[0].id, { waitUntil: 'networkidle' });
      await shot(page, '04-document-detail');
    }
  } catch (e) { console.log('detail err', e.message); }

  // 5. Create
  await page.goto(BASE + '/create', { waitUntil: 'networkidle' });
  await shot(page, '05-create');

  // 6. Outbox
  await page.goto(BASE + '/outbox', { waitUntil: 'networkidle' });
  await shot(page, '06-outbox');

  // 7. Leave
  await page.goto(BASE + '/leave', { waitUntil: 'networkidle' });
  await shot(page, '07-leave');

  // 8. Templates
  await page.goto(BASE + '/templates', { waitUntil: 'networkidle' });
  await shot(page, '08-templates');

  // 9. Login as admin -> admin users
  await page.evaluate(() => localStorage.clear());
  await login(page, 'admin');
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await shot(page, '09-admin-users');

  await browser.close();
  console.log('ALL DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
