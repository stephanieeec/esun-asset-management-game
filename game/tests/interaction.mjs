// Run with the bundled Playwright runtime (no app dependencies are needed).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { CONFIG } from '../dist/js/config.js';
const require = createRequire(process.env.PUZZLE_PLAYWRIGHT_ROOT + '/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
// Use a test registry to exercise the optional WebMCP hooks in browsers without the proposed API.
await page.addInitScript(() => {
  document.modelContext = { registerTool: (tool) => { (window.testTools ||= {})[tool.name] = tool; } };
  Element.prototype.requestFullscreen = async () => {};
});
try {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('.mascot').first().evaluate((image) => image.decode());
  await page.screenshot({ path: 'tests/opening.png' });
  assert.equal(await page.locator('#opening').isVisible(), true);
  await page.getByRole('button', { name: CONFIG.text.start, exact: true }).click();
  assert.equal(await page.locator('#puzzle').isVisible(), true);
  assert.equal(await page.locator('.hole').count(), 5);
  assert.equal(await page.locator('.piece').count(), 8);
  await page.screenshot({ path: 'tests/puzzle.png' });

  async function drag(pieceId, holeId) {
    const piece = page.locator(`#${pieceId}`), hole = page.locator(`#hole-${holeId}`);
    const from = await piece.boundingBox(), to = await hole.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(260);
  }

  // Incorrect shape and correct shape in wrong hole both return to their original location.
  await drag('wrong-hexagon', 'investment');
  assert.equal(await page.locator('#wrong-hexagon').evaluate((el) => el.style.transform), 'translate(0px, 0px)');
  await drag('finance-piece', 'family');
  assert.equal(await page.locator('#finance-piece').evaluate((el) => el.style.transform), 'translate(0px, 0px)');
  assert.equal(await page.locator('.placed').count(), 0);

  // Cancellation midway through a drag must not leave a floating piece.
  const cancelBox = await page.locator('#finance-piece').boundingBox();
  await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(750, 550, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal(await page.locator('.dragging').count(), 0);

  // Snap precisely; matching paths and bounding boxes must be identical.
  await drag('finance-piece', 'finance');
  assert.equal(await page.locator('#finance-piece').isDisabled(), true);
  assert.deepEqual(await page.locator('#finance-piece').boundingBox(), await page.locator('#hole-finance').boundingBox());
  assert.equal(await page.locator('#finance-piece path').getAttribute('d'), await page.locator('#hole-finance path').getAttribute('d'));

  // Real emulated touchscreen tap selection and placement.
  await page.locator('#family-piece').tap();
  await page.locator('#hole-family').tap();
  assert.equal(await page.locator('#family-piece').isDisabled(), true);

  // Touch drag (browser-generated touch pointer events, rather than synthetic DOM events).
  const touchSession = await context.newCDPSession(page);
  const touchFrom = await page.locator('#insurance-piece').boundingBox();
  const touchTo = await page.locator('#hole-insurance').boundingBox();
  const sx = touchFrom.x + touchFrom.width / 2, sy = touchFrom.y + touchFrom.height / 2;
  const ex = touchTo.x + touchTo.width / 2, ey = touchTo.y + touchTo.height / 2;
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 12; i++) await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + (ex - sx) * i / 12, y: sy + (ey - sy) * i / 12, id: 1 }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(260);
  assert.equal(await page.locator('#insurance-piece').isDisabled(), true);

  // Verify registered tools use the same state, and reject invalid IDs safely.
  const readState = await page.evaluate(() => window.testTools.read_puzzle_state.execute());
  assert.equal(readState.placed.length, 3);
  const invalid = await page.evaluate(() => {
    try { window.testTools.place_puzzle_piece.execute({ pieceId: 'missing', targetId: 'family' }); return false; }
    catch { return true; }
  });
  assert.equal(invalid, true);
  const placedByTool = await page.evaluate(() => window.testTools.place_puzzle_piece.execute({ pieceId: 'crossborder-piece', targetId: 'crossborder' }));
  assert.equal(placedByTool.matched, true);
  await drag('investment-piece', 'investment');
  await page.waitForTimeout(CONFIG.behavior.completionDelay + 100);
  assert.equal(await page.locator('#completion').isVisible(), true);
  await page.screenshot({ path: 'tests/completion.png' });
  await page.getByRole('button', { name: CONFIG.text.home, exact: true }).click();
  assert.equal(await page.locator('#opening').isVisible(), true);
  assert.equal(await page.locator('.placed').count(), 0);
  assert.equal(await page.locator('.filled').count(), 0);
  await page.getByRole('button', { name: CONFIG.text.start, exact: true }).click();
  assert.equal(await page.locator('.piece:disabled').count(), 0);

  // Smaller 16:9 preview: coordinate conversion still yields exact snapping.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(100);
  await drag('crossborder-piece', 'crossborder');
  assert.equal(await page.locator('#crossborder-piece').isDisabled(), true);
  const stage = await page.locator('#stage').boundingBox();
  assert.equal(stage.width, 1280);
  assert.equal(stage.height, 720);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight), false);
  assert.deepEqual(errors, []);
  console.log('PASS: opening, 5 holes / 8 pieces, incorrect drops, cancellation, exact snapping, touchscreen taps, completion, reset, scaled dragging, and optional tool validation.');
} finally {
  await browser.close();
}
