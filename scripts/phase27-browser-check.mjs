import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase27');
const appUrl = process.env.PHASE27_APP_URL ?? 'http://localhost:4175/';
const brush = process.env.PHASE27_BACKGROUND_PNG ?? 'C:/Users/USER/Desktop/黄色ブラシ背景だけの透過PNG.png';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const results = [], errors = [], screenshots = [];
page.on('pageerror', (error) => errors.push(error.message));
const pause = (ms = 250) => page.waitForTimeout(ms);
const mark = (name, details = '') => { results.push({ name, status: 'PASS', details }); console.log(`PASS ${name}`); };
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const number = async (label, value) => { const input = page.getByLabel(`${label}の数値`, { exact: true }); await input.fill(String(value)); await input.press('Enter'); await pause(); };
const snap = async (name) => { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(output, `${name}.png`) }); screenshots.push(`${name}.png`); };
const toolbar = page.locator('.editor-toolbar');
const download = async (action, name) => { const pending = page.waitForEvent('download'); await toolbar.locator(`[data-editor-action="${action}"]`).click(); const file = await pending; const target = path.join(output, name); await file.saveAs(target); return readFile(target); };
const template = async (name) => JSON.parse((await download('templateSave', `${name}.json`)).toString());
const loadTemplate = async (value) => { await page.getByLabel('テンプレートJSONファイル', { exact: true }).setInputFiles({ name: 'phase27.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) }); await pause(800); };
const selectRange = async (start, end) => { await tab('テキスト'); const input = page.getByLabel('選択中のテキスト内容', { exact: true }); await input.focus(); await input.press('Control+Home'); for (let index = 0; index < start; index += 1) await input.press('ArrowRight'); for (let index = start; index < end; index += 1) await input.press('Shift+ArrowRight'); await pause(); };
const setSelectedText = async (value) => { await tab('テキスト'); const input = page.getByLabel('選択中のテキスト内容', { exact: true }); await input.fill(value); await input.blur(); await pause(); };
const setScale = (label, value) => number(label, value);
const setAlignment = (label) => page.getByRole('button', { name: label, exact: true }).click();
const openPartialStroke = async (index) => { const details = page.locator(`[data-partial-stroke-layer="${index}"]`); if (await details.getAttribute('open') === null) await details.locator('summary').click(); return details; };
const setPartialSelect = (label, value) => page.getByLabel(label, { exact: true }).selectOption(value);
const setPartialFillEnabled = async (enabled) => { const box = page.getByRole('checkbox', { name: '文字色を部分適用', exact: true }); if ((await box.getAttribute('aria-checked') === 'true') !== enabled) await box.click(); };
const savedRecord = (key) => page.evaluate((requestedKey) => new Promise((resolve, reject) => { const open = indexedDB.open('text-graphic-studio'); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const request = db.transaction('projects').objectStore('projects').get(requestedKey); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => reject(request.error); }; }), key);

const captureFillCalls = async () => {
  await page.evaluate(() => {
    const prototype = CanvasRenderingContext2D.prototype;
    window.__phase27FillOriginal = prototype.fillText;
    window.__phase27FillCalls = [];
    prototype.fillText = function(text, x, y, maxWidth) {
      window.__phase27FillCalls.push({ text, x, y, font: this.font, advance: this.measureText(text).width });
      return window.__phase27FillOriginal.call(this, text, x, y, maxWidth);
    };
  });
  await download('exportSelected', `layout-${Date.now()}.png`);
  return page.evaluate(() => {
    const calls = window.__phase27FillCalls;
    CanvasRenderingContext2D.prototype.fillText = window.__phase27FillOriginal;
    delete window.__phase27FillOriginal; delete window.__phase27FillCalls;
    return calls;
  });
};
const findSequence = (calls, sequence) => {
  for (let index = 0; index <= calls.length - sequence.length; index += 1) {
    if (sequence.every((character, offset) => calls[index + offset].text === character)) return calls.slice(index, index + sequence.length);
  }
  throw new Error(`fillText sequence not found: ${sequence.join('')} in ${JSON.stringify(calls)}`);
};
const lineExtent = (calls) => ({ left: Math.min(...calls.map((call) => call.x)), right: Math.max(...calls.map((call) => call.x + call.advance)) });
const alphaBounds = (buffer) => page.evaluate(async (base64) => { const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); const data = context.getImageData(0, 0, image.width, image.height).data; let minX=image.width,minY=image.height,maxX=-1,maxY=-1; for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){if(data[(y*image.width+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}} return { width:image.width,height:image.height,minX,minY,maxX,maxY }; }, buffer.toString('base64'));

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.locator('canvas.upper-canvas').waitFor();
  await tab('テキスト');
  const characterEditor = page.locator('details.character-scale-editor');
  await characterEditor.locator('summary').click();
  for (const label of ['漢字', 'ひらがな', 'カタカナ', '数字', '英字', '記号']) assert.equal(await page.getByLabel(`${label}の数値`, { exact: true }).isVisible(), true);
  await snap('01-character-scale-ui');
  mark('文字組みに6分類の文字種別サイズ倍率UI');

  await setSelectedText('私は人間！20才');
  await page.getByLabel('フォント', { exact: true }).selectOption('Arial');
  await number('文字サイズ', 100); await number('文字間隔', 0); await number('グループの回転', 0);
  await setSelectedText('漢あアA１！😀');
  for (const [label, value] of [['漢字',111],['ひらがな',91],['カタカナ',92],['英字',93],['数字',94],['記号',95]]) await setScale(label, value);
  const unicodeCalls = findSequence(await captureFillCalls(), Array.from('漢あアA１！😀'));
  const fontSize = (call) => Number(call.font.match(/([\d.]+)px/)?.[1]);
  assert.deepEqual(unicodeCalls.map(fontSize), [111, 91, 92, 93, 94, 95, 100]);
  mark('漢字/ひらがな/カタカナ/英字/全角数字/記号/emoji fallbackのUnicode分類');
  await setSelectedText('私は人間！20才');
  for (const label of ['漢字', 'ひらがな', 'カタカナ', '数字', '英字', '記号']) await setScale(label, 100);
  // Keep per-grapheme rendering observable without changing this Japanese sample.
  await setScale('英字', 101);
  await setAlignment('中央');
  const chars = Array.from('私は人間！20才');
  const baseCenter = findSequence(await captureFillCalls(), chars);
  await setScale('漢字', 110); await setScale('数字', 110); await setScale('記号', 110);
  const mixedCenter = findSequence(await captureFillCalls(), chars);
  const deltas = mixedCenter.map((call, index) => call.x - baseCenter[index].x);
  assert.ok(deltas[1] > deltas[0]); assert.ok(deltas[3] > deltas[2]); assert.ok(deltas[4] > deltas[3]); assert.ok(deltas[5] > deltas[4]); assert.ok(deltas[6] > deltas[5]); assert.ok(deltas[7] > deltas[6]);
  assert.ok(mixedCenter.every((call, index) => index === 0 || call.x > mixedCenter[index - 1].x));
  const baseExtent = lineExtent(baseCenter), mixedExtent = lineExtent(mixedCenter);
  assert.ok(Math.abs((baseExtent.left + baseExtent.right) - (mixedExtent.left + mixedExtent.right)) < 3, JSON.stringify({ baseExtent, mixedExtent }));
  await snap('02-character-scale-applied');
  mark('Unicode分類倍率・実advance累積・非重複・最終幅中央揃え', JSON.stringify({ deltas, baseExtent, mixedExtent }));

  await setSelectedText('私は\n私は人間！20才');
  await setAlignment('右揃え');
  const rightCalls = await captureFillCalls();
  const shortRight = lineExtent(findSequence(rightCalls, Array.from('私は'))), longRight = lineExtent(findSequence(rightCalls.slice(2), chars));
  assert.ok(Math.abs(shortRight.right - longRight.right) < 3, JSON.stringify({ shortRight, longRight }));
  await setAlignment('中央');
  const centerCalls = await captureFillCalls();
  const shortCenter = lineExtent(findSequence(centerCalls, Array.from('私は'))), longCenter = lineExtent(findSequence(centerCalls.slice(2), chars));
  assert.ok(Math.abs((shortCenter.left + shortCenter.right) - (longCenter.left + longCenter.right)) < 3, JSON.stringify({ shortCenter, longCenter }));
  await number('文字間隔', 18);
  const spaced = findSequence(await captureFillCalls(), Array.from('私は私は人間！20才')).slice(2);
  assert.ok(spaced.every((call, index) => index === 0 || call.x > spaced[index - 1].x));
  await snap('03-character-scale-centered');
  mark('最終幅右揃え・字間併用');

  await setSelectedText('私は人間！20才');
  await selectRange(5, 7); await setPartialFillEnabled(false);
  const sizeCheck = page.getByRole('checkbox', { name: '文字サイズを部分適用', exact: true }); await sizeCheck.click(); await number('範囲の文字サイズ', 130);
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click(); await pause();
  const partialSize = await template('partial-size-priority');
  assert.equal(partialSize.partialStyles.at(-1).fontSize, 130);
  const sizedCalls = findSequence(await captureFillCalls(), chars);
  assert.ok(sizedCalls[5].font.includes('130px') && sizedCalls[6].font.includes('130px'), JSON.stringify(sizedCalls.slice(5, 7)));
  await number('文字幅', 90); await number('文字高さ', 110); await page.getByRole('button', { name: 'スラント', exact: true }).click();
  await download('exportSelected', 'character-scale-partial-glyph-slant.png');
  mark('部分明示サイズ優先・glyphScale・slant・透明PNG併用');

  await tab('背景');
  await page.getByLabel('背景タイプ', { exact: true }).selectOption('uploadedImage');
  await page.getByLabel('テキスト背景ファイル', { exact: true }).setInputFiles(brush); await pause(1000);
  const objectX = await page.locator('.editor-shell').getAttribute('data-selected-x');
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('fixed');
  await number('背景の横位置', -31); await number('背景の縦位置', 26);
  assert.equal(await page.locator('.editor-shell').getAttribute('data-selected-x'), objectX);
  const fixedTemplate = await template('fixed-offset'); assert.equal(fixedTemplate.background.offsetX, -31); assert.equal(fixedTemplate.background.offsetY, 26);
  const fixedPng = await download('exportSelected', 'fixed-offset.png'); const fixedBounds = await alphaBounds(fixedPng); assert.ok(fixedBounds.minX > 0 && fixedBounds.minY > 0 && fixedBounds.maxX < fixedBounds.width - 1 && fixedBounds.maxY < fixedBounds.height - 1, JSON.stringify(fixedBounds));
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('followLines');
  await number('背景の横位置', 37); await number('背景の縦位置', -22); await pause(800);
  assert.equal(await page.locator('.editor-shell').getAttribute('data-selected-background-offset-x'), '37');
  assert.equal(await page.locator('.editor-shell').getAttribute('data-selected-background-offset-y'), '-22');
  await snap('06-background-offset');
  await tab('テキスト'); await number('グループの回転', 17); await tab('背景');
  const followPng = await download('exportSelected', 'follow-offset-rotated.png'); const followBounds = await alphaBounds(followPng); assert.ok(followBounds.minX > 0 && followBounds.minY > 0 && followBounds.maxX < followBounds.width - 1 && followBounds.maxY < followBounds.height - 1, JSON.stringify(followBounds));
  mark('固定/高画質自動追従背景の正負ローカルX/Y Offset・回転・切り出しbounds');

  const design = await template('design-source');
  design.typography = { ...design.typography, fontFamily: 'Arial', fontSize: 144, letterSpacing: 11, lineHeight: 1.2, glyphScaleX: .9, glyphScaleY: 1.1, fontStyle: 'slant', slant: 8 };
  design.characterScale = { kanji: 1.12, hiragana: 1, katakana: 1, number: 1.14, latin: 1.03, symbol: 1.09 };
  design.fill = { type: 'linear-gradient', angle: 90, stops: [{ offset: 0, color: '#F4D507' }, { offset: 1, color: '#F08A16' }] };
  design.strokes = [{ enabled: true, color: '#000000', width: 3 }, { enabled: true, color: '#FFFFFF', width: 6 }, { enabled: true, color: '#000000', width: 4 }];
  design.stroke = { ...design.strokes[0] }; design.outerStroke = { ...design.strokes[1] };
  design.shadow = { enabled: true, color: '#000000', opacity: .5, blur: 5, offsetX: 8, offsetY: 9 };
  design.transform = { scaleX: 1.35, scaleY: .8, rotation: 13 };
  design.partialStyles = [{ start: 0, end: 1, fill: { type: 'solid', color: '#D10D18' }, glyphScaleY: 1.2 }];
  design.background.offsetX = 37; design.background.offsetY = -22;
  await loadTemplate(design);
  await tab('テキスト'); const add = page.getByLabel('追加するテキスト', { exact: true }); await add.fill('引き継ぎ確認'); await page.getByRole('button', { name: 'テキストを追加', exact: true }).click(); await pause(1000);
  const afterAdd = await savedRecord('autosave'); await pause(1200); const projectAfterAdd = await savedRecord('autosave');
  const created = projectAfterAdd.objects.at(-1), source = projectAfterAdd.objects.at(-2);
  assert.equal(created.text, '引き継ぎ確認'); assert.deepEqual(created.typography, design.typography); assert.deepEqual(created.characterScale, design.characterScale);
  assert.deepEqual(created.fill, design.fill); assert.deepEqual(created.strokes, design.strokes); assert.deepEqual(created.shadow, design.shadow); assert.equal(created.background.offsetX, 37); assert.equal(created.background.offsetY, -22);
  assert.equal(created.transform.rotation, 13); assert.equal(created.transform.scaleX, 1); assert.equal(created.transform.scaleY, 1); assert.deepEqual(created.partialStyles, []); assert.notDeepEqual(created.position, source.position);
  void afterAdd;
  await snap('04-last-used-inherited');
  const lastUsed = await savedRecord('last-used-text-defaults'); assert.equal(lastUsed.defaults.typography.fontSize, 144); assert.equal(lastUsed.defaults.transform.scaleX, 1); assert.deepEqual(lastUsed.defaults.partialStyles, []);
  mark('新規テキストへ全体デザインのみ引継ぎ・文章/部分/位置/手動scale除外');

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '復元する', exact: true }).click(); await page.locator('canvas.upper-canvas').waitFor(); await pause(1000);
  await tab('テキスト'); await page.getByLabel('追加するテキスト', { exact: true }).fill('再起動後'); await page.getByRole('button', { name: 'テキストを追加', exact: true }).click(); await pause(900);
  const restored = await savedRecord('autosave'); const restarted = restored.objects.at(-1);
  assert.equal(restarted.text, '再起動後'); assert.equal(restarted.typography.fontSize, 144); assert.deepEqual(restarted.characterScale, design.characterScale); assert.equal(restarted.background.offsetX, 37); assert.equal(restarted.transform.rotation, 13); assert.deepEqual(restarted.partialStyles, []);
  await snap('05-last-used-after-restart');
  mark('IndexedDB専用設定から再起動後の新規テキストへ引継ぎ');

  await setSelectedText('部分フチテスト'); await selectRange(0, 2); await setPartialFillEnabled(false);
  for (let index = 1; index <= 3; index += 1) await openPartialStroke(index);
  assert.equal(await page.getByText('フチ1の使用状態を部分適用', { exact: true }).count(), 0);
  for (let index = 1; index <= 3; index += 1) {
    const use = page.getByLabel(`フチ${index}の使用状態`, { exact: true });
    assert.deepEqual(await use.locator('option').allTextContents(), ['変更しない', '全体設定を使用', 'この範囲でON', 'この範囲でOFF']);
  }
  await snap('07-partial-stroke-ui');
  mark('部分フチ1/2/3の明確な操作選択UI・旧チェックボックス廃止');

  await setPartialSelect('フチ1の使用状態', 'off');
  assert.equal(await page.getByLabel('フチ2の使用状態', { exact: true }).inputValue(), 'off');
  assert.equal(await page.getByLabel('フチ3の使用状態', { exact: true }).inputValue(), 'off');
  assert.equal(await page.getByLabel('フチ1の色設定', { exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel('フチ1の幅設定', { exact: true }).isDisabled(), true);
  await snap('08-partial-stroke1-off');
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click(); await pause();
  let partialTemplate = await template('partial-off');
  assert.deepEqual(partialTemplate.partialStyles.at(-1).strokes, { '1': { enabled: false }, '2': { enabled: false }, '3': { enabled: false } });
  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click(); await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click();
  mark('部分OFF連続制約・色幅保持・Undo/Redo');

  const discontinuous = structuredClone(partialTemplate); discontinuous.strokes.forEach((layer) => { layer.enabled = false; }); discontinuous.stroke = { ...discontinuous.strokes[0] }; discontinuous.outerStroke = { ...discontinuous.strokes[1] }; discontinuous.partialStyles = [];
  await loadTemplate(discontinuous); await selectRange(0, 2); await setPartialFillEnabled(false); await openPartialStroke(2);
  assert.equal(await page.getByLabel('フチ2の使用状態', { exact: true }).locator('option[value="on"]').isDisabled(), true);
  await snap('09-partial-stroke-contiguous');
  mark('内側実効OFF時は外側部分ON不可');

  const preserve = structuredClone(design); preserve.transform.scaleX = 1; preserve.transform.scaleY = 1; preserve.strokes = [{ enabled: true, color: '#FFFFFF', width: 4 }, { enabled: true, color: '#000000', width: 6 }, { enabled: false, color: '#000000', width: 3 }]; preserve.stroke = { ...preserve.strokes[0] }; preserve.outerStroke = { ...preserve.strokes[1] };
  preserve.partialStyles = [{ start: 0, end: 2, fill: { type: 'solid', color: '#D10D18' }, fontFamily: 'Arial', glyphScaleY: 1.2, strokes: { '1': { enabled: true, color: '#FF0000', width: 7 } } }];
  await loadTemplate(preserve); await selectRange(0, 2); await setPartialFillEnabled(false); await openPartialStroke(1);
  await setPartialSelect('フチ1の色設定', 'change');
  await page.getByRole('button', { name: '範囲のフチ1の色カラーピッカー', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: '範囲のフチ1の色のパレット', exact: true }).getByRole('button').count(), 6);
  const native = page.getByLabel('範囲のフチ1の色詳細カラーピッカー', { exact: true });
  await native.evaluate((element) => { window.__phase27PickerCalls = 0; element.showPicker = () => { window.__phase27PickerCalls += 1; }; });
  await page.getByRole('button', { name: '詳細カラーを選択…', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__phase27PickerCalls), 1);
  await native.evaluate((element) => { element.value = '#1236b7'; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); });
  await snap('10-partial-stroke-native-color');
  await page.getByRole('button', { name: 'カラーピッカーを閉じる', exact: true }).click();
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click(); await pause();
  partialTemplate = await template('partial-leaf-preserved');
  assert.equal(partialTemplate.partialStyles[0].fill.color, '#D10D18'); assert.equal(partialTemplate.partialStyles[0].glyphScaleY, 1.2); assert.equal(partialTemplate.partialStyles[0].strokes['1'].enabled, true); assert.equal(partialTemplate.partialStyles[0].strokes['1'].width, 7);
  assert.deepEqual(partialTemplate.partialStyles.at(-1).strokes, { '1': { color: '#1236B7' } });
  mark('部分フチ色だけ後勝ち・他のfont/fill/glyph/使用状態/幅を保持・ネイティブpicker回帰');

  await selectRange(0, 2); await setPartialFillEnabled(false); await openPartialStroke(1); await setPartialSelect('フチ1の色設定', 'inherit');
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click(); await pause();
  const inherited = await template('partial-color-inherited');
  assert.ok(inherited.partialStyles.filter((style) => style.end > 0 && style.start < 2).every((style) => style.strokes?.['1']?.color === undefined));
  assert.ok(inherited.partialStyles.some((style) => style.glyphScaleY === 1.2));
  mark('全体設定を使用は対象leafだけ解除、変更しないは既存leafを保持');

  await pause(1300);
  const finalAutosave = await savedRecord('autosave'); assert.equal(finalAutosave.objects.at(-1).background.offsetX, 37);
  await download('exportSelected', 'partial-stroke-final.png');
  await snap('11-indexeddb-restored');
  mark('背景Offset・文字種別倍率・部分フチのJSON/IndexedDB/PNG経路');

  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results.length, results, screenshots, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output, screenshots }));
} finally {
  await browser.close();
}
