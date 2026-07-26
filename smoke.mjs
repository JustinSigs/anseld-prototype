// Smoke-drive the ANSELD prototype: start screen → mock run → play turns,
// aim a prophecy, trigger a rewind warning, take the scar, check designer panel.
import { chromium } from 'playwright';

const shots = './smoke-shots';
import { mkdirSync } from 'fs';
mkdirSync(shots, { recursive: true });

const errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173');
await page.waitForSelector('text=ANSELD');
await page.screenshot({ path: `${shots}/01-start.png` });

// Start a mock run.
await page.click('#start-mock');
await page.waitForSelector('#prose:not(:empty)', { timeout: 10000 });
await page.screenshot({ path: `${shots}/02-opening.png`, fullPage: true });

// Play: ferry crossing twice → warn then decay.
await page.click('button.choice:has-text("ferry")');
await page.waitForSelector('.note-prophecy-warned', { timeout: 5000 });
await page.screenshot({ path: `${shots}/03-warned.png`, fullPage: true });

await page.click('button.choice:has-text("ferry")');
await page.waitForSelector('.note-prophecy-decayed', { timeout: 5000 });
await page.screenshot({ path: `${shots}/04-decayed.png`, fullPage: true });

// Free text action.
await page.fill('#free-text', 'Study the ledger by lamplight');
await page.press('#free-text', 'Enter');
await page.waitForFunction(() => document.querySelector('#prose')?.textContent?.includes('folio'), { timeout: 5000 });

// Aim a remaining loose prophecy.
const aimBtns = page.locator('.aim-btn');
if (await aimBtns.count() > 0) {
  await aimBtns.first().click();
  await page.waitForSelector('#aim-decl');
  await page.fill('#aim-decl', 'The salt pans will prove the erased folio true.');
  const inputs = page.locator('.modal input[id^="aim-role-"]');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) await inputs.nth(i).fill('The Warden\'s seized folio');
  await page.click('.modal button:has-text("irrevocable")');
  await page.waitForSelector('.overlay', { state: 'detached' });
  await page.screenshot({ path: `${shots}/05-aimed.png`, fullPage: true });
}

// Jump to a fresh window via the grid (Issa, year 70).
await page.click('td.g-cell.alive[data-host="issa"][data-year="70"]');
await page.waitForFunction(() => document.querySelector('#host-chip')?.textContent?.includes('Issa'), { timeout: 5000 });

// Now re-enter an occupied window → rewind warning modal → take the scar.
await page.click('td.g-cell.occ[data-host="merra"][data-year="60"]');
await page.waitForSelector('.modal');
await page.screenshot({ path: `${shots}/06-rewind-warning.png` });
await page.click('.modal button:has-text("take the scar")');
await page.waitForSelector('.note-scar', { timeout: 5000 });
await page.screenshot({ path: `${shots}/07-scarred.png`, fullPage: true });

// Designer panel.
await page.click('#designer-toggle');
await page.waitForSelector('#designer-dials input');
await page.screenshot({ path: `${shots}/08-designer.png` });
await page.click("#designer-close"); // close it again

// Ledger drawer.
await page.click('details.panel summary');
await page.screenshot({ path: `${shots}/09-ledger.png`, fullPage: true });

const scar = await page.textContent('#scar-chip');
const state = await page.evaluate(() => localStorage.getItem('anseld.save.v1') !== null);
console.log('SCAR CHIP:', scar?.trim());
console.log('SAVE EXISTS:', state);
console.log('CONSOLE ERRORS:', errors.length === 0 ? 'none' : errors.join('\n---\n'));
await browser.close();
