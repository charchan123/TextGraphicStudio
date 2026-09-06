import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase28');
const appUrl = process.env.PHASE28_APP_URL ?? 'http://localhost:4175/';
const profile = await mkdtemp(path.join(os.tmpdir(), 'tgs-phase28-'));
await mkdir(output, { recursive: true });

const launch = () => chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
});

let context = await launch();
let page;
const results = [], errors = [], screenshots = [];
const mark = (name, details = '') => { results.push({ name, status: 'PASS', details }); console.log(`PASS ${name}`); };
const pause = (ms = 250) => page.waitForTimeout(ms);
const attachPage = async () => {
  page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.locator('canvas.upper-canvas').waitFor();
};
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const snap = async (name) => { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(output, `${name}.png`) }); screenshots.push(`${name}.png`); };
const toolbar = () => page.locator('.editor-toolbar');
const download = async (action, name) => { const pending = page.waitForEvent('download'); await toolbar().locator(`[data-editor-action="${action}"]`).click(); const file = await pending; const target = path.join(output, name); await file.saveAs(target); return readFile(target); };
const template = async (name) => JSON.parse((await download('templateSave', `${name}.json`)).toString());
const selectedText = () => page.getByLabel('選択中のテキスト内容', { exact: true });
const selectRange = async (start, end) => {
  await tab('テキスト');
  const input = selectedText();
  await input.focus();
  await input.press('Control+Home');
  for (let index = 0; index < start; index += 1) await input.press('ArrowRight');
  for (let index = start; index < end; index += 1) await input.press('Shift+ArrowRight');
  await pause();
};
const setText = async (text) => { await tab('テキスト'); await selectedText().fill(text); await selectedText().blur(); await pause(500); };
const setRangeColor = async (color, label = '範囲の文字色') => {
  await page.getByRole('button', { name: `${label}カラーピッカー`, exact: true }).click();
  const native = page.getByLabel(`${label}詳細カラーピッカー`, { exact: true });
  await native.evaluate((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
  await page.getByRole('button', { name: 'カラーピッカーを閉じる', exact: true }).click();
};
const savePreset = async (name) => {
  await page.getByRole('button', { name: 'プリセットを保存', exact: true }).click();
  await page.getByLabel('プリセット名', { exact: true }).fill(name);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await pause(200);
};
const openMenu = async (name) => {
  const summary = page.getByLabel(`${name}の管理`, { exact: true });
  await summary.click();
  return summary.locator('..').locator('[role="menu"]');
};
const effectiveFill = (value, start, end) => value.partialStyles.reduce((fill, style) => style.end > start && style.start < end && style.fill ? style.fill : fill, value.fill);
const partialLeaf = (value, predicate) => value.partialStyles.filter((style) => style.end > 0 && style.start < 2).findLast(predicate);

try {
  await attachPage();
  await setText('赤青黄プリセット');
  await selectRange(0, 2);
  assert.equal(await page.getByRole('heading', { name: 'クイック部分プリセット', exact: true }).isVisible(), true);
  mark('クイック部分プリセットUIと選択範囲');

  await setRangeColor('#D10D18');
  await savePreset('赤文字');
  await setRangeColor('#1236B7');
  await savePreset('青文字');
  await page.getByLabel('範囲の塗り', { exact: true }).selectOption('linear-gradient');
  await setRangeColor('#F4D507', '範囲の開始色');
  await page.getByRole('button', { name: '範囲の終了色カラーピッカー', exact: true }).click();
  await page.getByLabel('範囲の終了色詳細カラーピッカー', { exact: true }).evaluate((element) => {
    element.value = '#F08A16';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'カラーピッカーを閉じる', exact: true }).click();
  await savePreset('黄グラデ');
  assert.equal(await page.locator('.quick-preset-item').count(), 3);
  await snap('01-quick-presets-three');
  mark('赤文字・青文字・黄グラデを保存しクイックボタン表示');

  await page.getByRole('button', { name: '赤文字を選択範囲へ適用', exact: true }).click();
  let value = await template('red-applied');
  assert.deepEqual(effectiveFill(value, 0, 2), { type: 'solid', color: '#D10D18' });
  assert.deepEqual(await selectedText().evaluate((element) => [element.selectionStart, element.selectionEnd]), [0, 2]);
  await snap('02-red-applied');
  await page.getByRole('button', { name: '青文字を選択範囲へ適用', exact: true }).click();
  value = await template('blue-applied');
  assert.deepEqual(effectiveFill(value, 0, 2), { type: 'solid', color: '#1236B7' });
  await snap('03-blue-applied');
  await page.getByRole('button', { name: '黄グラデを選択範囲へ適用', exact: true }).click();
  value = await template('yellow-gradient-applied');
  assert.equal(effectiveFill(value, 0, 2).type, 'linear-gradient');
  await snap('04-yellow-gradient-applied');
  mark('3プリセットを追加操作なしで即適用・選択範囲維持');

  await page.getByRole('button', { name: '赤文字を選択範囲へ適用', exact: true }).click();
  value = await template('gradient-to-red');
  assert.deepEqual(effectiveFill(value, 0, 2), { type: 'solid', color: '#D10D18' });
  await page.getByRole('button', { name: '黄グラデを選択範囲へ適用', exact: true }).click();
  value = await template('red-to-gradient');
  assert.equal(effectiveFill(value, 0, 2).type, 'linear-gradient');
  await snap('05-gradient-to-solid');
  mark('単色と1文字グラデーションを双方向へ排他的に切替');

  const fillCheckbox = page.getByRole('checkbox', { name: '文字色を部分適用', exact: true });
  if (await fillCheckbox.getAttribute('aria-checked') === 'true') await fillCheckbox.click();
  const heightCheckbox = page.getByRole('checkbox', { name: '文字高さを部分適用', exact: true });
  if (await heightCheckbox.getAttribute('aria-checked') !== 'true') await heightCheckbox.click();
  const heightInput = page.getByLabel('範囲の文字高さの数値', { exact: true });
  await heightInput.fill('120'); await heightInput.press('Enter');
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  await page.getByRole('button', { name: '赤文字を選択範囲へ適用', exact: true }).click();
  value = await template('unrelated-leaf-preserved');
  assert.equal(partialLeaf(value, (style) => style.glyphScaleY !== undefined).glyphScaleY, 1.2);
  assert.deepEqual(effectiveFill(value, 0, 2), { type: 'solid', color: '#D10D18' });
  mark('プリセット未指定の文字高さ・他leafを保持');

  await selectRange(0, 2);
  for (let index = 1; index <= 3; index += 1) {
    const details = page.locator(`[data-partial-stroke-layer="${index}"]`);
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await page.getByLabel(`フチ${index}の使用状態`, { exact: true }).selectOption('on');
    await page.getByLabel(`フチ${index}の色設定`, { exact: true }).selectOption('change');
    await page.getByLabel(`フチ${index}の幅設定`, { exact: true }).selectOption('change');
  }
  const redMenu = await openMenu('赤文字');
  await redMenu.getByRole('menuitem', { name: '現在の設定で上書き', exact: true }).click();
  const stored = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('text-graphic-studio');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction('projects').objectStore('projects').get('quick-partial-presets');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  }));
  await pause(700);
  const latestStored = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('text-graphic-studio');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction('projects').objectStore('projects').get('quick-partial-presets');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  }));
  void stored;
  assert.ok(latestStored.presets.find((preset) => preset.name === '赤文字').operation.strokes['3']);
  const beforePreset = await template('before-stroke-preset');
  await page.getByRole('button', { name: '赤文字を選択範囲へ適用', exact: true }).click();
  const afterPreset = await template('after-stroke-preset');
  const finalStrokes = afterPreset.partialStyles.findLast((style) => style.strokes)?.strokes;
  assert.equal(finalStrokes['1'].enabled, true); assert.equal(finalStrokes['2'].enabled, true); assert.equal(finalStrokes['3'].enabled, true);
  await toolbar().getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.deepEqual((await template('preset-undo')).partialStyles, beforePreset.partialStyles);
  await toolbar().getByRole('button', { name: 'やり直す', exact: true }).click();
  assert.deepEqual((await template('preset-redo')).partialStyles, afterPreset.partialStyles);
  mark('3層フチ連続制約・プリセット1回をUndo/Redo各1回');

  const blueMenu = await openMenu('青文字');
  await snap('06-preset-management-menu');
  await blueMenu.getByRole('menuitem', { name: '名前変更', exact: true }).click();
  await page.getByLabel('プリセット名', { exact: true }).fill('青文字改');
  await page.getByRole('button', { name: '名前を変更', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '青文字改を選択範囲へ適用', exact: true }).count(), 1);
  mark('名前変更・現在設定で上書き');

  for (const name of ['予備4', '予備5', '予備6', '予備7', '予備8']) await savePreset(name);
  assert.equal(await page.locator('.quick-preset-item').count(), 8);
  assert.equal(await page.getByRole('button', { name: 'プリセットを保存', exact: true }).isDisabled(), true);
  await snap('07-maximum-eight');
  mark('最大8個・9個目の保存を無効化');

  await page.getByRole('button', { name: '黄グラデを選択範囲へ適用', exact: true }).click();
  const beforeDelete = (await template('before-delete')).partialStyles;
  const yellowMenu = await openMenu('黄グラデ');
  await yellowMenu.getByRole('menuitem', { name: '削除', exact: true }).click();
  assert.equal(await page.locator('.quick-preset-item').count(), 7);
  assert.deepEqual((await template('after-delete')).partialStyles, beforeDelete);
  mark('削除しても適用済み文字を保持');

  for (const label of ['文字色を部分適用', '文字サイズを部分適用', '文字間隔を部分適用', '文字幅を部分適用', '文字高さを部分適用', '太字を部分適用', 'フォントを部分適用']) {
    const checkbox = page.getByRole('checkbox', { name: label, exact: true });
    if (await checkbox.getAttribute('aria-checked') === 'true') await checkbox.click();
  }
  for (let index = 1; index <= 3; index += 1) {
    await page.getByLabel(`フチ${index}の使用状態`, { exact: true }).selectOption('keep');
    const color = page.getByLabel(`フチ${index}の色設定`, { exact: true });
    const width = page.getByLabel(`フチ${index}の幅設定`, { exact: true });
    if (!await color.isDisabled()) await color.selectOption('keep');
    if (!await width.isDisabled()) await width.selectOption('keep');
  }
  await page.getByRole('button', { name: 'プリセットを保存', exact: true }).click();
  await page.getByText('プリセットに保存する変更がありません。', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('プリセット名', { exact: true }).count(), 0);
  mark('変更項目ゼロの空プリセットを拒否');

  await selectRange(0, 0);
  const partialDetails = page.locator('details.partial-style-editor');
  if (await partialDetails.getAttribute('open') === null) await partialDetails.locator(':scope > summary').click();
  await page.getByRole('button', { name: '赤文字を選択範囲へ適用', exact: true }).click();
  await page.getByText('先に文字範囲を選択してください。', { exact: true }).waitFor();
  mark('選択範囲なしの誤適用を防止');

  await selectRange(0, 2);
  await page.getByRole('button', { name: '範囲の文字色カラーピッカー', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: '範囲の文字色のパレット', exact: true }).getByRole('button').count(), 6);
  const native = page.getByLabel('範囲の文字色詳細カラーピッカー', { exact: true });
  await native.evaluate((element) => { window.__phase28PickerCalls = 0; element.showPicker = () => { window.__phase28PickerCalls += 1; }; });
  await page.getByRole('button', { name: '詳細カラーを選択…', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__phase28PickerCalls), 1);
  await page.getByRole('button', { name: 'カラーピッカーを閉じる', exact: true }).click();
  mark('基本6色Popover・ChromeネイティブshowPicker回帰');

  await pause(1200);
  await context.close();
  context = await launch();
  await attachPage();
  const restore = page.getByRole('button', { name: '復元する', exact: true });
  if (await restore.count()) await restore.click();
  await page.locator('canvas.upper-canvas').waitFor(); await pause(700);
  await tab('テキスト'); await selectRange(0, 2);
  assert.equal(await page.locator('.quick-preset-item').count(), 7);
  await snap('08-restored-after-browser-restart');
  mark('Chrome再起動相当のIndexedDB復元');

  await toolbar().getByRole('button', { name: '新規', exact: true }).click();
  await page.getByRole('button', { name: '新規プロジェクト', exact: true }).click();
  await tab('テキスト');
  assert.equal(await page.locator('.quick-preset-item').count(), 7);
  mark('新規プロジェクトでもプリセットを保持');

  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results.length, results, screenshots, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output, screenshots }));
} finally {
  await context.close().catch(() => undefined);
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
