import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase281');
const appUrl = process.env.PHASE281_APP_URL ?? 'http://localhost:4175/';
const brush = process.env.PHASE281_BACKGROUND_PNG ?? 'C:/Users/USER/Desktop/黄色ブラシ背景だけの透過PNG.png';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const results = [];
const screenshots = [];
const mark = (name) => { results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const pause = (ms = 250) => page.waitForTimeout(ms);
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const toolbar = page.locator('.editor-toolbar');
const download = async (action, name) => {
  const pending = page.waitForEvent('download');
  await toolbar.locator(`[data-editor-action="${action}"]`).click();
  const file = await pending;
  const target = path.join(output, name);
  await file.saveAs(target);
  return readFile(target);
};
const template = async (name) => JSON.parse((await download('templateSave', `${name}.json`)).toString());
const loadTemplate = async (value) => {
  await page.getByLabel('テンプレートJSONファイル', { exact: true }).setInputFiles({
    name: 'phase281.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
  await pause(600);
};
const numberInput = (label) => page.getByLabel(`${label}の数値`, { exact: true });
const number = async (label, value) => {
  const input = numberInput(label);
  await input.fill(String(value));
  await input.press('Enter');
  await pause();
};
const selectedText = () => page.getByLabel('選択中のテキスト内容', { exact: true });
const setText = async (value) => { await tab('テキスト'); await selectedText().fill(value); await selectedText().blur(); await pause(); };
const selectRange = async (start, end) => {
  await tab('テキスト');
  const input = selectedText();
  await input.focus();
  await input.press('Control+Home');
  for (let index = 0; index < start; index += 1) await input.press('ArrowRight');
  for (let index = start; index < end; index += 1) await input.press('Shift+ArrowRight');
  await pause();
};
const snap = async (name) => {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  screenshots.push(`${name}.png`);
};
const captureTextCalls = async () => {
  await page.evaluate(() => {
    const prototype = CanvasRenderingContext2D.prototype;
    window.__phase281OriginalFill = prototype.fillText;
    window.__phase281OriginalStroke = prototype.strokeText;
    window.__phase281Calls = { fill: [], stroke: [] };
    prototype.fillText = function(text, x, y, maxWidth) {
      window.__phase281Calls.fill.push({ text, x, y });
      return window.__phase281OriginalFill.call(this, text, x, y, maxWidth);
    };
    prototype.strokeText = function(text, x, y, maxWidth) {
      window.__phase281Calls.stroke.push({ text, x, y });
      return window.__phase281OriginalStroke.call(this, text, x, y, maxWidth);
    };
  });
  await download('exportSelected', `calls-${Date.now()}.png`);
  return page.evaluate(() => {
    const calls = window.__phase281Calls;
    CanvasRenderingContext2D.prototype.fillText = window.__phase281OriginalFill;
    CanvasRenderingContext2D.prototype.strokeText = window.__phase281OriginalStroke;
    delete window.__phase281Calls;
    delete window.__phase281OriginalFill;
    delete window.__phase281OriginalStroke;
    return calls;
  });
};
const findSequences = (calls, sequence) => {
  const matches = [];
  for (let index = 0; index <= calls.length - sequence.length; index += 1) {
    if (sequence.every((character, offset) => calls[index + offset].text === character)) {
      matches.push(calls.slice(index, index + sequence.length));
      index += sequence.length - 1;
    }
  }
  return matches;
};
const near = (left, right, tolerance = 0.01) => Math.abs(left - right) <= tolerance;
const overlapping = (styles, start, end) => styles.filter((style) => style.end > start && style.start < end);
const effectiveLeaf = (styles, start, end, leaf) =>
  overlapping(styles, start, end).reduce((value, style) => style[leaf] ?? value, undefined);

try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.locator('canvas.upper-canvas').waitFor();
  await tab('テキスト');
  await page.locator('details.character-scale-editor > summary').click();

  const kanji = numberInput('漢字');
  await kanji.fill('110.00000'); await kanji.press('Enter');
  assert.equal(await kanji.inputValue(), '110');
  await kanji.fill('100.00000'); await kanji.press('Enter');
  assert.equal(await kanji.inputValue(), '100');
  await kanji.fill('110.5'); await kanji.press('Enter');
  assert.equal(await kanji.inputValue(), '110.5');
  await kanji.fill('110.25'); await kanji.press('Enter');
  assert.equal(await kanji.inputValue(), '110.25');
  assert.ok(near((await template('decimal-value')).characterScale.kanji, 1.1025, 1e-12));
  await kanji.focus(); await kanji.fill('110.');
  assert.equal(await kanji.inputValue(), '110.');
  await kanji.press('Enter');
  assert.equal(await kanji.inputValue(), '110');
  mark('倍率表示の末尾0除去・小数精度・入力draft保持');

  const text = 'しかし2人の活躍は';
  await setText(text);
  const base = await template('base');
  base.partialStyles = [{ start: 3, end: 4, fill: { type: 'solid', color: '#D10D18' }, glyphScaleY: 1.2 }];
  await loadTemplate(base);
  const sequence = Array.from(text);
  const before = await captureTextCalls();
  const beforeFill = findSequences(before.fill, sequence)[0];
  const beforeStrokes = findSequences(before.stroke, sequence);
  assert.ok(beforeFill && beforeStrokes.length >= 2);

  await selectRange(3, 4);
  const fillCheckbox = page.getByRole('checkbox', { name: '文字色を部分適用', exact: true });
  if (await fillCheckbox.getAttribute('aria-checked') === 'true') await fillCheckbox.click();
  assert.deepEqual(await page.getByLabel('文字の上下位置', { exact: true }).locator('option').allTextContents(), [
    '変更しない', '標準位置に戻す', 'この範囲で変更',
  ]);
  await page.getByLabel('文字の上下位置', { exact: true }).selectOption('change');
  await number('文字の上下位置', 6);
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  await pause();
  let saved = await template('offset-plus-six');
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'glyphOffsetY'), 6);
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'glyphScaleY'), 1.2);
  assert.deepEqual(effectiveLeaf(saved.partialStyles, 3, 4, 'fill'), { type: 'solid', color: '#D10D18' });
  const after = await captureTextCalls();
  const afterFill = findSequences(after.fill, sequence)[0];
  const afterStrokes = findSequences(after.stroke, sequence);
  assert.ok(afterFill && afterStrokes.length === beforeStrokes.length);
  for (let index = 0; index < sequence.length; index += 1) {
    assert.ok(near(afterFill[index].x, beforeFill[index].x));
    assert.ok(near(afterFill[index].y - beforeFill[index].y, index === 3 ? 6 : 0));
  }
  for (let layer = 0; layer < beforeStrokes.length; layer += 1) {
    for (let index = 0; index < sequence.length; index += 1) {
      assert.ok(near(afterStrokes[layer][index].x, beforeStrokes[layer][index].x));
      assert.ok(near(afterStrokes[layer][index].y - beforeStrokes[layer][index].y, index === 3 ? 6 : 0));
    }
  }
  await snap('01-glyph-offset-plus-six');
  mark('選択glyphだけ+6px・X/advance不変・3層フチ追従・他leaf保持');

  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.equal(effectiveLeaf((await template('offset-undo')).partialStyles, 3, 4, 'glyphOffsetY'), undefined);
  await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click();
  assert.equal(effectiveLeaf((await template('offset-redo')).partialStyles, 3, 4, 'glyphOffsetY'), 6);
  mark('上下位置をUndo/Redo各1回');

  await pause(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  const restore = page.getByRole('button', { name: '復元する', exact: true });
  if (await restore.count()) await restore.click();
  await page.locator('canvas.upper-canvas').waitFor(); await pause(500);
  saved = await template('offset-restored');
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'glyphOffsetY'), 6);
  mark('JSON・IndexedDB自動復元で上下位置を保持');

  await selectRange(3, 4);
  if (await fillCheckbox.getAttribute('aria-checked') === 'true') await fillCheckbox.click();
  await page.getByLabel('文字の上下位置', { exact: true }).selectOption('change');
  await number('文字の上下位置', -5);
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  let calls = await captureTextCalls();
  let fillCalls = findSequences(calls.fill, sequence)[0];
  assert.ok(near(fillCalls[3].y - beforeFill[3].y, -5));
  await number('文字の上下位置', 0);
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  calls = await captureTextCalls();
  fillCalls = findSequences(calls.fill, sequence)[0];
  assert.ok(near(fillCalls[3].y, beforeFill[3].y));
  mark('負値で上移動・0で標準baseline');

  await number('文字の上下位置', 6);
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  await tab('背景');
  await page.getByLabel('背景タイプ', { exact: true }).selectOption('uploadedImage');
  await page.getByLabel('テキスト背景ファイル', { exact: true }).setInputFiles(brush);
  await pause(800);
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('followLines');
  const png = await download('exportSelected', 'offset-follow-lines.png');
  assert.ok(png.length > 1000);
  await snap('02-offset-follow-lines');
  mark('高画質自動追従背景・影・透明PNG boundsと併用');

  await selectRange(3, 4);
  if (await fillCheckbox.getAttribute('aria-checked') !== 'true') await fillCheckbox.click();
  await page.getByLabel('範囲の塗り', { exact: true }).selectOption('linear-gradient');
  await page.getByLabel('文字の上下位置', { exact: true }).selectOption('keep');
  await page.getByRole('button', { name: 'プリセットを保存', exact: true }).click();
  await page.getByLabel('プリセット名', { exact: true }).fill('Phase281互換');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: 'Phase281互換を選択範囲へ適用', exact: true }).click();
  saved = await template('quick-preset-compatible');
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'fill').type, 'linear-gradient');
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'glyphOffsetY'), 6);
  mark('Phase 2.8クイック部分プリセット互換・gradient追従');

  await selectRange(3, 4);
  if (await fillCheckbox.getAttribute('aria-checked') === 'true') await fillCheckbox.click();
  await page.getByLabel('文字の上下位置', { exact: true }).selectOption('inherit');
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  saved = await template('offset-cleared');
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'glyphOffsetY'), undefined);
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'glyphScaleY'), 1.2);
  assert.equal(effectiveLeaf(saved.partialStyles, 3, 4, 'fill').type, 'linear-gradient');
  await snap('03-offset-cleared');
  mark('標準位置へ戻してoffset leafだけ解除');

  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results.length, results, screenshots }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output, screenshots }));
} finally {
  await context.close();
  await browser.close();
}
