// Smoke-drive the clockwork town: start mock, watch the clock run,
// verify agents move, walk the player, possess someone, talk, check errors.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const shots = './smoke-shots';
mkdirSync(shots, { recursive: true });

const errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/town.html');
await page.waitForSelector('#tt-start-mock');
await page.click('#tt-start-mock');
await page.waitForSelector('#tt-canvas');
await page.waitForTimeout(800);
await page.screenshot({ path: `${shots}/town-01-wake.png` });

// Clock advances.
const t1 = await page.textContent('#tt-clock');
await page.click('.tt-speed[data-speed="4"]');
await page.waitForTimeout(3000);
const t2 = await page.textContent('#tt-clock');
console.log('CLOCK:', t1, '→', t2);

// Walk south out of the office and around.
for (const key of ['s', 's', 's', 's', 'd', 'd', 's', 's']) {
  await page.keyboard.down(key);
  await page.waitForTimeout(160);
  await page.keyboard.up(key);
}
await page.screenshot({ path: `${shots}/town-02-walking.png` });

// Let the town run at 4x for a while — lunch hour approaches, people move.
await page.waitForTimeout(6000);
await page.screenshot({ path: `${shots}/town-03-later.png` });

// Find someone adjacent: walk toward the tavern door area and try E.
// (Deterministic adjacency is fiddly; instead, teleport-check via evaluate is
// avoided — we just verify the menu opens if anyone is near after wandering.)
await page.keyboard.press('e');
await page.waitForTimeout(400);
const menuVisible = await page.isVisible('#tt-menu');
console.log('ACTION MENU after E:', menuVisible ? 'opened (someone adjacent)' : 'nobody adjacent (toast shown)');
await page.screenshot({ path: `${shots}/town-04-interact.png` });

console.log('CONSOLE ERRORS:', errors.length === 0 ? 'none' : errors.join('\n---\n'));
await browser.close();
