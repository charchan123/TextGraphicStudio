import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase26-colorpicker');
const appUrl = process.env.PHASE26_APP_URL ?? 'http://localhost:4175/';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const results = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const mark = (name) => { results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const toolbar = page.locator('.editor-toolbar');
const saveTemplate = async (name) => {
  const pending = page.waitForEvent('download');
  await toolbar.locator('[data-editor-action="templateSave"]').click();
  const download = await pending;
  const target = path.join(output, name);
  await download.saveAs(target);
  return JSON.parse((await readFile(target)).toString());
};
const openPicker = async (label) => {
  await page.getByRole('button', { name: `${label}カラーピッカー`, exact: true }).click();
  return page.getByLabel(`${label}詳細カラーピッカー`, { exact: true });
};
const instrumentNativePicker = async (input) => input.evaluate((element) => {
  window.__textGraphicStudioPickerCalls = 0;
  element.showPicker = () => { window.__textGraphicStudioPickerCalls += 1; };
});
const applyNativeColor = async (input, value) => input.evaluate((element, next) => {
  element.value = next;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}, value);

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: 'スタイル', exact: true }).click();

  const original = await saveTemplate('before-native-color.json');
  const textNative = await openPicker('文字色');
  assert.equal(await page.getByRole('group', { name: '文字色のパレット', exact: true }).getByRole('button').count(), 6);
  assert.equal(await page.getByRole('button', { name: '詳細カラーを選択…', exact: true }).isVisible(), true);
  assert.equal(await textNative.getAttribute('type'), 'color');
  mark('基本6色Popoverと詳細カラー導線');

  await instrumentNativePicker(textNative);
  await page.getByRole('button', { name: '詳細カラーを選択…', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__textGraphicStudioPickerCalls), 1);
  mark('showPickerによるネイティブカラーピッカー起動');

  await applyNativeColor(textNative, '#336699');
  assert.equal(await page.getByLabel('文字色HEX値', { exact: true }).inputValue(), '#336699');
  await page.getByRole('button', { name: 'カラーピッカーを閉じる', exact: true }).click();
  assert.equal((await saveTemplate('after-native-color.json')).fill.color, '#336699');
  mark('ネイティブ選択色を現在色・HEX・対象スタイルへ同期');

  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.equal((await saveTemplate('after-native-undo.json')).fill.color, original.fill.color);
  await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click();
  assert.equal((await saveTemplate('after-native-redo.json')).fill.color, '#336699');
  mark('ネイティブ色変更のUndo / Redo');

  const stroke = page.locator('[data-stroke-layer="1"]');
  if (await stroke.getAttribute('open') === null) await stroke.locator('summary').click();
  const strokeNative = await openPicker('フチ1の色');
  await instrumentNativePicker(strokeNative);
  await page.getByRole('button', { name: '詳細カラーを選択…', exact: true }).click();
  await applyNativeColor(strokeNative, '#7A25C4');
  await page.getByRole('button', { name: 'カラーピッカーを閉じる', exact: true }).click();
  const multiple = await saveTemplate('multiple-fields.json');
  assert.equal(multiple.fill.color, '#336699');
  assert.equal(multiple.strokes[0].color, '#7A25C4');
  mark('複数の共通ColorFieldで色反映');

  await page.getByRole('button', { name: '文字色カラーピッカー', exact: true }).click();
  await page.screenshot({ path: path.join(output, '01-basic-six-and-detail-button.png') });
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results.length, results, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output }));
} finally {
  await browser.close();
}
