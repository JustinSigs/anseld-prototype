// Smoke-drive Gullshead: take office, meet the ferry, post repairs and a
// bonfire, watch the night, read the Gazette next morning.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const shots = './smoke-shots';
mkdirSync(shots, { recursive: true });

const errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/island.html');
await page.waitForSelector('#is-start-mock');
await page.click('#is-start-mock');
await page.waitForSelector('#is-canvas');
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/island-01-office.png` });

// Walk to the notice board (west and up from the office).
const walk = async (key, n) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.down(key);
    await page.waitForTimeout(150);
    await page.keyboard.up(key);
    await page.waitForTimeout(30);
  }
};
await walk('a', 8);
await walk('w', 3);
await page.keyboard.press('e');
await page.waitForTimeout(300);

// If the menu found the board, open it and post works.
const boardRow = page.locator('#is-menu button', { hasText: 'Open' });
if (await boardRow.count() > 0) {
  await boardRow.first().click();
  await page.waitForSelector('#is-board');
  await page.screenshot({ path: `${shots}/island-02-board.png` });
  const repair = page.locator('[data-repair="chowder"]');
  if (await repair.count() > 0) await repair.click();
  await page.locator('[data-bonfire="beach"]').click();
  await page.locator('#is-board-close').click();
} else {
  console.log('BOARD: not reached (menu contents differ) — continuing');
  await page.keyboard.press('Escape');
}

// 4x through the day; ferry lands at 9.
await page.click('.is-speed[data-speed="4"]');
await page.waitForTimeout(8000);
await page.screenshot({ path: `${shots}/island-03-day.png` });

// Run to the night event window.
await page.waitForTimeout(42000);
await page.screenshot({ path: `${shots}/island-04-night.png` });

// Morning after: check the Gazette.
await page.waitForTimeout(30000);
await page.click('#is-gazette-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/island-05-gazette.png` });

const clock = await page.textContent('#is-clock');
const rep = await page.textContent('#is-rep');
console.log('CLOCK:', clock, '| REPUTATION:', rep);
console.log('CONSOLE ERRORS:', errors.length === 0 ? 'none' : errors.join('\n---\n'));
await browser.close();
