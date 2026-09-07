import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase29');
const appUrl = process.env.PHASE29_APP_URL ?? 'http://localhost:4175/';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(30000);
try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.locator('[data-editor-action="outputPreview"]').click();
  const dialog = page.locator('.output-preview-dialog');
  await dialog.waitFor();
  const viewport = await dialog.locator('.output-preview-viewport').boundingBox();
  const image = await dialog.locator('img').boundingBox();
  assert.ok(viewport && image);
  assert.ok(image.width <= viewport.width && image.height <= viewport.height);
  assert.ok(Math.abs(image.width / image.height - 1080 / 1920) < 0.001);
  assert.ok(image.x >= viewport.x && image.y >= viewport.y);
  assert.ok(image.x + image.width <= viewport.x + viewport.width);
  assert.ok(image.y + image.height <= viewport.y + viewport.height);
  await page.screenshot({ path: path.join(output, '01-preview-fit.png') });
  const result = { status: 'PASS', viewport, image, ratio: image.width / image.height, expectedRatio: 1080 / 1920 };
  await writeFile(path.join(output, 'fit-results.json'), JSON.stringify(result, null, 2));
  console.log(`PASS Fit DOM bounds ${image.width.toFixed(2)}×${image.height.toFixed(2)} within ${viewport.width.toFixed(2)}×${viewport.height.toFixed(2)}`);
} finally {
  await browser.close();
}
