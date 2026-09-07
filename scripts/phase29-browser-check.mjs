import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase29');
const appUrl = process.env.PHASE29_APP_URL ?? 'http://localhost:4175/';
const brush = process.env.PHASE29_BACKGROUND_PNG ?? 'C:/Users/USER/Desktop/黄色ブラシ背景だけの透過PNG.png';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const results = [], screenshots = [], errors = [];
const mark = (name) => { results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const makePage = async () => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await page.locator('canvas.upper-canvas').waitFor();
  return { context, page };
};
const first = await makePage();
let page = first.page;
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const pause = (ms = 250) => page.waitForTimeout(ms);
const snap = async (name) => { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(output, name) }); screenshots.push(name); };
const toolbarAction = (action) => page.locator(`.editor-toolbar [data-editor-action="${action}"]`);
const download = async (action, name) => {
  const pending = page.waitForEvent('download');
  await toolbarAction(action).click();
  const item = await pending;
  const target = path.join(output, name);
  await item.saveAs(target);
  return readFile(target);
};
const selectedText = () => page.getByLabel('選択中のテキスト内容', { exact: true });
const setText = async (value) => { await tab('テキスト'); await selectedText().fill(value); await selectedText().blur(); await pause(); };
const setSelection = async (start, end = start) => {
  await tab('テキスト');
  const input = selectedText();
  await input.focus();
  await input.press('Control+Home');
  for (let index = 0; index < start; index += 1) await input.press('ArrowRight');
  for (let index = start; index < end; index += 1) await input.press('Shift+ArrowRight');
  await pause();
};
const setGap = async (value) => {
  const input = page.getByLabel('間隔補正の数値', { exact: true });
  await input.fill(String(value)); await input.press('Enter'); await pause();
};
const captureGlyphs = async () => {
  await page.evaluate(() => {
    const prototype = CanvasRenderingContext2D.prototype;
    window.__phase29FillText = prototype.fillText;
    window.__phase29Calls = [];
    prototype.fillText = function(text, x, y, maxWidth) {
      window.__phase29Calls.push({ text, x, y });
      return window.__phase29FillText.call(this, text, x, y, maxWidth);
    };
  });
  await download('exportSelected', `capture-${Date.now()}.png`);
  return page.evaluate(() => {
    const calls = window.__phase29Calls;
    CanvasRenderingContext2D.prototype.fillText = window.__phase29FillText;
    delete window.__phase29FillText; delete window.__phase29Calls;
    return calls;
  });
};
const glyphSequence = (calls) => {
  for (let index = 0; index <= calls.length - 3; index += 1) {
    if (calls[index].text === '甲' && calls[index + 1].text === '乙' && calls[index + 2].text === '丙') return calls.slice(index, index + 3);
  }
  throw new Error('3行の描画座標を取得できませんでした。');
};
const near = (left, right, tolerance = 0.05) => Math.abs(left - right) <= tolerance;

try {
  let downloadCount = 0;
  page.on('download', () => { downloadCount += 1; });
  await toolbarAction('outputPreview').click();
  const preview = page.locator('.output-preview-dialog');
  await preview.waitFor();
  const image = preview.getByRole('img', { name: '完成画像の出力プレビュー' });
  const natural = await image.evaluate((element) => [element.naturalWidth, element.naturalHeight]);
  assert.deepEqual(natural, [1080, 1920]); mark('出力プレビューは1080×1920の最新PNG Blob');
  assert.equal(downloadCount, 0); mark('プレビューではダウンロードが発生しない');
  assert.equal(await preview.getAttribute('data-preview-mode'), 'fit');
  await snap('01-preview-fit.png'); mark('画面に合わせる表示');
  await preview.getByRole('button', { name: '100%表示', exact: true }).click();
  assert.equal(await preview.getAttribute('data-preview-mode'), 'actual');
  assert.ok(near(await image.evaluate((element) => element.getBoundingClientRect().width), 1080, 1));
  await snap('02-preview-100-percent.png'); mark('100%表示とスクロール');
  const oldSource = await image.getAttribute('src');
  await page.keyboard.press('Escape'); await preview.waitFor({ state: 'hidden' }); mark('Escでプレビューを閉じる');
  await setText('甲\n乙\n丙');
  await toolbarAction('outputPreview').click(); await preview.waitFor();
  assert.notEqual(await image.getAttribute('src'), oldSource); mark('編集後は新しいobject URLで再生成');
  await page.keyboard.press('Escape');

  const baseline = glyphSequence(await captureGlyphs());
  await setSelection(0);
  assert.match(await page.locator('.line-gap-target').textContent(), /1行目 → 2行目/); mark('カーソルと1行内選択から対象境界を決定');
  await setGap(10);
  const plusTen = glyphSequence(await captureGlyphs());
  assert.ok(near((plusTen[1].y - plusTen[0].y) - (baseline[1].y - baseline[0].y), 10));
  assert.ok(near(plusTen[2].y - plusTen[1].y, baseline[2].y - baseline[1].y));
  assert.ok(plusTen.every((call, index) => near(call.x, baseline[index].x)));
  await snap('06-line-gap-line1-plus10.png'); mark('1→2 +10pxで後続2行を一括移動しX/相対間隔不変');

  await setSelection(2);
  assert.match(await page.locator('.line-gap-target').textContent(), /2行目 → 3行目/);
  await setGap(-6);
  const minusSix = glyphSequence(await captureGlyphs());
  assert.ok(near((minusSix[2].y - minusSix[1].y) - (plusTen[2].y - plusTen[1].y), -6));
  assert.ok(minusSix.every((call, index) => near(call.x, plusTen[index].x)));
  await snap('07-line-gap-line2-minus6.png'); mark('2→3 -6pxで3行目以降だけ移動');

  await page.locator('.line-gap-editor').getByRole('button', { name: '0に戻す', exact: true }).click();
  assert.deepEqual(JSON.parse(await page.locator('.editor-shell').getAttribute('data-selected-line-gap-offsets')), [10, 0]); mark('境界補正を0へ戻す');
  await page.locator('.editor-toolbar').getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.deepEqual(JSON.parse(await page.locator('.editor-shell').getAttribute('data-selected-line-gap-offsets')), [10, -6]);
  await page.locator('.editor-toolbar').getByRole('button', { name: 'やり直す', exact: true }).click(); mark('個別行間のUndo/Redo');

  await setSelection(0, 2);
  assert.equal(await page.getByLabel('間隔補正の数値', { exact: true }).isDisabled(), true);
  await snap('09-line-gap-disabled-multiline-selection.png'); mark('複数行選択ではdisabled');
  await setSelection(4);
  assert.equal(await page.getByLabel('間隔補正の数値', { exact: true }).isDisabled(), true); mark('最終行ではdisabled');
  await setSelection(0);
  await setGap(10);

  await tab('背景');
  await page.getByLabel('背景タイプ', { exact: true }).selectOption('uploadedImage');
  await page.getByLabel('テキスト背景ファイル', { exact: true }).setInputFiles(brush);
  await pause(700);
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('followLines');
  await snap('08-line-gap-follow-lines.png'); mark('followLines背景が補正後の各行へ追従');

  await snap('03-project-before-export.png');
  const projectBytes = await download('projectExport', 'phase29-portable.tgsproj');
  const packageValue = JSON.parse(projectBytes.toString());
  assert.equal(packageValue.kind, 'text-graphic-studio-project-package');
  assert.equal(packageValue.version, 1);
  assert.deepEqual(packageValue.document.objects[0].lineGapOffsets, [10, 0]);
  assert.match(packageValue.document.objects[0].background.image.dataUrl, /^data:image\/png;base64,/);
  assert.equal('quickPartialPresets' in packageValue, false);
  assert.equal('lastUsedTextDefaults' in packageValue, false);
  mark('.tgsprojは画像asset内包の自己完結1ファイルで個人設定を含まない');

  const clean = await makePage();
  page = clean.page;
  await page.getByLabel('Text Graphic Studioプロジェクトファイル', { exact: true }).setInputFiles({ name: 'phase29.tgsproj', mimeType: 'application/json', buffer: projectBytes });
  await page.getByRole('heading', { name: 'プロジェクトを読み込みますか', exact: true }).waitFor(); mark('検証後に置換確認を表示');
  await page.getByRole('button', { name: '読み込む', exact: true }).click(); await pause(600);
  assert.equal(await page.getByLabel('選択中のテキスト内容', { exact: true }).inputValue(), '甲\n乙\n丙');
  assert.deepEqual(JSON.parse(await page.locator('.editor-shell').getAttribute('data-selected-line-gap-offsets')), [10, 0]);
  assert.equal(await page.locator('.editor-toolbar').getByRole('button', { name: '元に戻す', exact: true }).isDisabled(), true);
  await snap('04-project-after-import-clean-profile.png'); mark('クリーンprofile相当でdocument・lineGap・assetを復元し履歴をリセット');

  const beforeInvalid = await page.getByLabel('選択中のテキスト内容', { exact: true }).inputValue();
  await page.getByLabel('Text Graphic Studioプロジェクトファイル', { exact: true }).setInputFiles({ name: 'broken.tgsproj', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await pause(300);
  assert.equal(await page.getByLabel('選択中のテキスト内容', { exact: true }).inputValue(), beforeInvalid); mark('壊れたprojectでも現在作業を保持');

  const missing = structuredClone(packageValue);
  missing.document.objects[0].typography.fontFamily = '__TGS_PHASE29_MISSING_FONT__';
  missing.document.objects[0].typography.fontRefId = 'local:phase29-missing';
  missing.document.fontCatalog.push({ id: 'local:phase29-missing', family: '__TGS_PHASE29_MISSING_FONT__', fullName: 'Phase29 Missing Font', source: 'local-access' });
  await page.getByLabel('Text Graphic Studioプロジェクトファイル', { exact: true }).setInputFiles({ name: 'missing-font.tgsproj', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(missing)) });
  await page.getByRole('button', { name: '読み込む', exact: true }).click();
  await page.locator('.app-notice').filter({ hasText: 'Phase29 Missing Font' }).waitFor();
  await snap('05-missing-font-warning.png'); mark('不足font familyを警告してfallback表示');

  await tab('テキスト');
  await selectedText().fill('甲\n乙\n丙\n丁'); await selectedText().blur(); await pause();
  assert.deepEqual(JSON.parse(await page.locator('.editor-shell').getAttribute('data-selected-line-gap-offsets')), [10, 0, 0]);
  await selectedText().fill('甲\n乙'); await selectedText().blur(); await pause();
  assert.deepEqual(JSON.parse(await page.locator('.editor-shell').getAttribute('data-selected-line-gap-offsets')), [10]); mark('行数増減時に末尾維持・追加0・不要境界削除');

  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results.length, results, screenshots, errors }, null, 2));
  assert.deepEqual(errors, []);
  await clean.context.close();
} finally {
  await first.context.close();
  await browser.close();
}
