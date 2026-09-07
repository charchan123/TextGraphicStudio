import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const appUrl = process.env.PHASE29_APP_URL ?? 'http://localhost:4175/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  const text = page.getByLabel('選択中のテキスト内容', { exact: true });
  await text.fill('甲\n乙\n丙'); await text.blur();
  await text.focus(); await text.press('Control+Home');
  const gap = page.getByLabel('間隔補正の数値', { exact: true });
  await gap.fill('12'); await gap.press('Enter');

  const pending = page.waitForEvent('download');
  await page.locator('[data-editor-action="templateSave"]').click();
  const item = await pending;
  const target = path.resolve('test-results/phase29/line-gap-template.json');
  await item.saveAs(target);
  const template = JSON.parse((await readFile(target)).toString());
  assert.deepEqual(template.lineGapOffsets, [12, 0]);
  console.log('PASS template JSONへlineGapOffsetsを保存');

  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  const restore = page.getByRole('button', { name: '復元する', exact: true });
  await restore.waitFor(); await restore.click();
  assert.deepEqual(JSON.parse(await page.locator('.editor-shell').getAttribute('data-selected-line-gap-offsets')), [12, 0]);
  console.log('PASS IndexedDB自動保存・復元でlineGapOffsetsを保持');
} finally {
  await context.close(); await browser.close();
}
