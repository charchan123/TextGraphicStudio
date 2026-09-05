import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase25');
const appUrl = process.env.PHASE25_APP_URL ?? 'http://localhost:3000/';
const referencePng = process.env.PHASE25_BACKGROUND_PNG ?? 'C:/Users/USER/Desktop/黄色ブラシ背景だけの透過PNG.png';
const chrome = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const fontRoot = 'C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/4fe60c8b1c/resources/app/node_modules/katex';
const fontFiles = [
  ['TTF', `${fontRoot}/dist/fonts/KaTeX_Main-Regular.ttf`],
  ['OTF', `${fontRoot}/src/fonts/lib/Extra.otf`],
  ['WOFF', `${fontRoot}/dist/fonts/KaTeX_Main-Regular.woff`],
  ['WOFF2', `${fontRoot}/dist/fonts/KaTeX_Main-Regular.woff2`],
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
await context.grantPermissions(['local-fonts'], { origin: new URL(appUrl).origin });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const toolbar = page.locator('.editor-toolbar');
const results = [], screenshots = [], errors = [], requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => requests.push(request.url()));
const pause = (ms = 180) => page.waitForTimeout(ms);
const mark = (name, details = '') => { results.push({ name, status: 'PASS', details }); console.log(`PASS ${name}`); };
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const number = async (label, value) => {
  const input = page.getByLabel(`${label}の数値`, { exact: true });
  await input.fill(String(value));
  await input.press('Enter');
  await pause();
};
const color = async (label, value) => {
  const input = page.getByLabel(`${label}HEX値`, { exact: true });
  await input.fill(value);
  await input.blur();
  await pause();
};
const check = async (label, enabled) => {
  const control = page.getByRole('checkbox', { name: label, exact: true });
  const checked = await control.getAttribute('aria-checked') === 'true';
  if (checked !== enabled) await control.click();
};
const toggle = async (label, enabled) => {
  const control = page.getByRole('switch', { name: label, exact: true });
  const checked = await control.getAttribute('aria-checked') === 'true';
  if (checked !== enabled) await control.click();
};
const selected = async (name) => page.locator('.editor-shell').getAttribute(`data-selected-${name}`);
const selectedNumber = async (name) => Number(await selected(name));
const snap = async (name) => {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  screenshots.push(`${name}.png`);
};
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
    name: 'phase25-template.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
  await pause(450);
};
const setText = async (value) => {
  const field = page.getByLabel('選択中のテキスト内容', { exact: true });
  await field.fill(value);
  await field.blur();
  await pause();
};
const selectRange = async (start, end) => {
  await tab('テキスト');
  const field = page.getByLabel('選択中のテキスト内容', { exact: true });
  await field.focus();
  await field.press('Control+Home');
  for (let index = 0; index < start; index += 1) await field.press('ArrowRight');
  for (let index = start; index < end; index += 1) await field.press('Shift+ArrowRight');
  await page.waitForFunction(({ start, end }) => {
    const range = document.querySelector('.range-selection');
    return Number(range?.getAttribute('data-range-start')) === start
      && Number(range?.getAttribute('data-range-end')) === end;
  }, { start, end });
};
const applyRange = async () => {
  await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click();
  await pause(300);
};
const analyzePng = (buffer) => page.evaluate(async (base64) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const alphaColumns = new Array(image.width).fill(0);
  const colorColumns = Array.from({ length: image.width }, () => ({ yellow: 0, orange: 0, blue: 0, red: 0 }));
  const coloredRows = Array.from({ length: image.height }, () => ({ count: 0, min: image.width, max: -1 }));
  let minX = image.width, maxX = -1, minY = image.height, maxY = -1, alphaMass = 0;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    const index = (y * image.width + x) * 4;
    const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2], a = pixels[index + 3];
    alphaMass += a;
    if (a > 80) {
      alphaColumns[x] += 1;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (a > 110) {
      if (r > 210 && g > 175 && b < 90) colorColumns[x].yellow += 1;
      if (r > 210 && g > 55 && g < 185 && b < 90) colorColumns[x].orange += 1;
      if (b > 130 && r < 90 && g < 125) colorColumns[x].blue += 1;
      if (r > 160 && g < 90 && b < 100) colorColumns[x].red += 1;
      const band = (r > 170 && g < 100 && b < 100)
        || (r < 90 && g > 155 && b > 155)
        || (r > 145 && b > 115 && g < 105);
      if (band) {
        coloredRows[y].count += 1;
        coloredRows[y].min = Math.min(coloredRows[y].min, x);
        coloredRows[y].max = Math.max(coloredRows[y].max, x);
      }
    }
  }
  const runs = [];
  let start = -1;
  for (let x = 0; x <= image.width; x += 1) {
    const active = x < image.width && alphaColumns[x] > 2;
    if (active && start < 0) start = x;
    if (!active && start >= 0) {
      const end = x - 1;
      let yellow = 0, orange = 0, blue = 0, red = 0, top = image.height, bottom = -1;
      for (let column = start; column <= end; column += 1) {
        yellow += colorColumns[column].yellow; orange += colorColumns[column].orange;
        blue += colorColumns[column].blue; red += colorColumns[column].red;
        for (let row = 0; row < image.height; row += 1) {
          if (pixels[(row * image.width + column) * 4 + 3] > 80) {
            top = Math.min(top, row); bottom = Math.max(bottom, row);
          }
        }
      }
      runs.push({ start, end, width: end - start + 1, top, bottom, height: bottom - top + 1, yellow, orange, blue, red });
      start = -1;
    }
  }
  const bands = [];
  let bandStart = -1, bandMin = image.width, bandMax = -1;
  for (let y = 0; y <= image.height; y += 1) {
    const active = y < image.height && coloredRows[y].count > 12;
    if (active) {
      if (bandStart < 0) bandStart = y;
      bandMin = Math.min(bandMin, coloredRows[y].min);
      bandMax = Math.max(bandMax, coloredRows[y].max);
    } else if (bandStart >= 0) {
      bands.push({ top: bandStart, bottom: y - 1, height: y - bandStart, left: bandMin, right: bandMax, width: bandMax - bandMin + 1 });
      bandStart = -1; bandMin = image.width; bandMax = -1;
    }
  }
  return { width: image.width, height: image.height, alphaMass, bounds: { width: maxX - minX + 1, height: maxY - minY + 1 }, runs, bands };
}, buffer.toString('base64'));
const comparePngPixels = (left, right) => page.evaluate(async (sources) => {
  const decoded = await Promise.all(sources.map(async (source) => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
  }));
  if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) return { dimensionsMatch: false };
  let changed = 0, max = 0, total = 0;
  for (let index = 0; index < decoded[0].data.length; index += 1) {
    const difference = Math.abs(decoded[0].data[index] - decoded[1].data[index]);
    if (difference) changed += 1;
    max = Math.max(max, difference);
    total += difference;
  }
  return { dimensionsMatch: true, changed, max, mean: total / decoded[0].data.length };
}, [left.toString('base64'), right.toString('base64')]);
const readSaved = () => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('text-graphic-studio');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const database = open.result;
    const transaction = database.transaction('projects');
    const request = transaction.objectStore('projects').get('autosave');
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
  };
}));
const scaleSelection = async () => {
  const canvas = page.locator('canvas.upper-canvas');
  const box = await canvas.boundingBox();
  const logical = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
  const position = { x: await selectedNumber('x'), y: await selectedNumber('y') };
  const dimensions = { width: await selectedNumber('width'), height: await selectedNumber('height') };
  const scales = { x: await selectedNumber('scale-x'), y: await selectedNumber('scale-y') };
  const radians = await selectedNumber('rotation') * Math.PI / 180;
  const halfWidth = dimensions.width * scales.x / 2 + 3;
  const halfHeight = dimensions.height * scales.y / 2 + 3;
  const point = {
    x: position.x + Math.cos(radians) * halfWidth - Math.sin(radians) * halfHeight,
    y: position.y + Math.sin(radians) * halfWidth + Math.cos(radians) * halfHeight,
  };
  const before = await selectedNumber('scale-x');
  const x = box.x + point.x / logical.width * box.width;
  const y = box.y + point.y / logical.height * box.height;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 24, y + 18, { steps: 8 }); await page.mouse.up();
  await pause(350);
  assert.ok(Math.abs(await selectedNumber('scale-x') - before) > 0.02, 'outer Fabric scale must change');
};

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('canvas.upper-canvas').waitFor();
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await pause(450);
  await snap('01-phase25-initial');
  assert.equal(await page.getByLabel('文字幅の数値', { exact: true }).inputValue(), '100');
  assert.equal(await page.getByLabel('文字高さの数値', { exact: true }).inputValue(), '100');
  mark('初期glyph倍率100% / 100%');

  await tab('スタイル');
  assert.equal(await page.getByLabel('パレット色 1', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('group', { name: '文字色のパレット', exact: true }).getByRole('button').count(), 6);
  await page.getByLabel('パレット色 1', { exact: true }).fill('#223344');
  await page.getByRole('button', { name: '文字色を#223344に設定', exact: true }).click();
  assert.equal((await page.getByLabel('文字色HEX値', { exact: true }).inputValue()).toUpperCase(), '#223344');
  await snap('02-color-palette');
  const paletteTemplate = await template('palette-custom');
  assert.equal(paletteTemplate.palette.length, 6);
  assert.equal(paletteTemplate.palette[0], '#223344');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('text-graphic-studio-color-palette-v1'))[0]), '#223344');
  mark('6色palette編集・色チップ即時適用・JSON/localStorage');

  await page.getByLabel('文字の塗り', { exact: true }).selectOption('linear-gradient');
  for (const label of ['開始色', '終了色']) {
    assert.equal(await page.getByRole('group', { name: `${label}のパレット`, exact: true }).getByRole('button').count(), 6);
  }
  await page.getByLabel('文字の塗り', { exact: true }).selectOption('solid');
  for (const label of ['文字色', '白フチの色', '黒フチの色', '影の色']) {
    assert.equal(await page.getByRole('group', { name: `${label}のパレット`, exact: true }).getByRole('button').count(), 6);
  }
  mark('全体色・フチ・影・gradient両端に共通palette');

  await toggle('白フチを使用', false);
  await toggle('黒フチを使用', false);
  await toggle('影を使用', false);
  await color('文字色', '#1236B7');
  await tab('背景');
  await page.getByLabel('背景タイプ', { exact: true }).selectOption('none');
  await tab('テキスト');
  await setText('HHHH');
  await page.getByLabel('フォント', { exact: true }).selectOption('Arial');
  await number('文字サイズ', 150); await number('文字間隔', 30); await number('行間', 1.05); await number('グループの回転', 0);
  const objectScaleBefore = [await selectedNumber('scale-x'), await selectedNumber('scale-y')];
  const baseline = await analyzePng(await download('exportSelected', 'glyph-baseline.png'));
  await number('文字高さ', 110);
  await number('文字幅', 90);
  const glyphChangedBuffer = await download('exportSelected', 'glyph-90x110.png');
  const glyphChanged = await analyzePng(glyphChangedBuffer);
  assert.equal(await selectedNumber('glyph-scale-x'), 0.9);
  assert.equal(await selectedNumber('glyph-scale-y'), 1.1);
  assert.deepEqual([await selectedNumber('scale-x'), await selectedNumber('scale-y')], objectScaleBefore);
  assert.ok(glyphChanged.bounds.width < baseline.bounds.width * 0.96, `${glyphChanged.bounds.width} !< ${baseline.bounds.width}`);
  assert.ok(glyphChanged.bounds.height > baseline.bounds.height * 1.05, `${glyphChanged.bounds.height} !> ${baseline.bounds.height}`);
  mark('全体glyph幅90%・高さ110%・外側Fabric transformから独立', JSON.stringify({ baseline: baseline.bounds, changed: glyphChanged.bounds }));

  await number('文字幅', 150); await number('文字高さ', 100); await number('文字間隔', 0);
  const zeroSpacingRuns = (await analyzePng(await download('exportSelected', 'glyph-spacing-0.png'))).runs.slice(-4);
  await number('文字間隔', 20);
  const twentySpacingRuns = (await analyzePng(await download('exportSelected', 'glyph-spacing-20.png'))).runs.slice(-4);
  assert.equal(zeroSpacingRuns.length, 4); assert.equal(twentySpacingRuns.length, 4);
  const averageGap = (runs) => runs.slice(1).reduce((sum, run, index) => sum + run.start - runs[index].end - 1, 0) / (runs.length - 1);
  const spacingIncrease = averageGap(twentySpacingRuns) - averageGap(zeroSpacingRuns);
  assert.ok(spacingIncrease >= 19 && spacingIncrease <= 21, `spacing increase=${spacingIncrease}`);
  assert.deepEqual([await selectedNumber('scale-x'), await selectedNumber('scale-y')], objectScaleBefore);
  await number('文字幅', 90); await number('文字高さ', 110); await number('文字間隔', 30);
  mark('glyph幅150%でも字間20pxは20pxだけ増加し外側scale不変', `increase=${spacingIncrease}`);

  await page.getByRole('button', { name: 'スラント', exact: true }).click();
  await number('スラント角度', 12);
  assert.equal(await selected('font-style'), 'slant');
  assert.equal(await selectedNumber('rotation'), 0);
  const slantedPng = await download('exportSelected', 'glyph-slant.png');
  assert.notDeepEqual(slantedPng, glyphChangedBuffer);
  assert.ok((await download('exportSelected', 'glyph-slant-repeat.png')).equals(slantedPng));
  await page.getByRole('button', { name: '斜体', exact: true }).click();
  assert.equal(await selected('font-style'), 'italic');
  const italicPng = await download('exportSelected', 'glyph-italic.png');
  assert.notDeepEqual(italicPng, slantedPng);
  await snap('03-glyph-and-slant');
  mark('native italic・数値slant・回転との独立・PNG反映');

  await page.getByRole('button', { name: '通常', exact: true }).click();
  await number('文字幅', 100); await number('文字高さ', 100);
  await selectRange(0, 3);
  await page.getByLabel('範囲の塗り', { exact: true }).selectOption('linear-gradient');
  await color('範囲の開始色', '#FFF000'); await color('範囲の終了色', '#FF8000'); await number('範囲のグラデーション角度', 0);
  await check('文字幅を部分適用', true); await number('範囲の文字幅', 85);
  await check('文字高さを部分適用', true); await number('範囲の文字高さ', 120);
  await check('文字サイズを部分適用', false); await check('文字間隔を部分適用', false); await check('太字を部分適用', false); await check('フォントを部分適用', false);
  await applyRange();
  const partialGlyph = await analyzePng(await download('exportSelected', 'partial-gradient-glyph.png'));
  assert.ok(partialGlyph.runs.length >= 4, JSON.stringify(partialGlyph.runs));
  const fourRuns = partialGlyph.runs.slice(-4);
  for (const run of fourRuns.slice(0, 3)) assert.ok(run.yellow > 25 && run.orange > 25, JSON.stringify(run));
  assert.ok(fourRuns[3].blue > 100 && fourRuns[3].yellow === 0, JSON.stringify(fourRuns[3]));
  assert.ok(fourRuns.slice(0, 3).every((run) => run.width < fourRuns[3].width));
  assert.ok(Math.max(...fourRuns.map((run) => run.bottom)) - Math.min(...fourRuns.map((run) => run.bottom)) <= 2, JSON.stringify(fourRuns));
  mark('部分gradientは各文字で反復・部分幅85%・高さ120%・全体単色を継承', JSON.stringify(fourRuns));

  await check('文字色を部分適用', false); await check('文字幅を部分適用', false); await check('文字高さを部分適用', false);
  await check('フォントを部分適用', true);
  await page.getByLabel('範囲のフォント', { exact: true }).selectOption('Impact');
  await applyRange();
  let mixedTemplate = await template('property-merge');
  const rangeStyles = mixedTemplate.partialStyles.slice(-2);
  assert.equal(rangeStyles[0].fill.type, 'linear-gradient');
  assert.equal(rangeStyles[0].glyphScaleX, 0.85); assert.equal(rangeStyles[0].glyphScaleY, 1.2);
  assert.equal(rangeStyles[1].fontFamily, 'Impact');
  assert.equal(rangeStyles[1].fill, undefined); assert.equal(rangeStyles[1].glyphScaleY, undefined);
  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.equal((await template('property-merge-undo')).partialStyles.length, mixedTemplate.partialStyles.length - 1);
  await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click();
  mixedTemplate = await template('property-merge-redo');
  assert.equal(mixedTemplate.partialStyles.at(-1).fontFamily, 'Impact');
  mark('重複範囲は同一propertyだけ後勝ち・他property保持・Undo/Redo');

  await tab('スタイル');
  await color('文字色', '#D10D18');
  await tab('テキスト');
  await page.getByLabel('フォント', { exact: true }).selectOption('Arial');
  await number('文字幅', 120); await number('文字高さ', 80);
  const priorityPng = await analyzePng(await download('exportSelected', 'partial-priority.png'));
  const priorityRuns = priorityPng.runs.slice(-4);
  assert.ok(priorityRuns.slice(0, 3).every((run) => run.yellow > 15 && run.orange > 15));
  assert.ok(priorityRuns[3].red > 80);
  const priorityTemplate = await template('partial-priority');
  assert.equal(priorityTemplate.typography.glyphScaleX, 1.2);
  assert.equal(priorityTemplate.partialStyles.at(-2).glyphScaleX, 0.85);
  await snap('04-partial-gradient-font-glyph');
  mark('部分style > 全体style、未指定propertyは全体継承');

  const priorityBytes = await download('exportSelected', 'partial-priority-before.json.png');
  await selectRange(0, 3);
  await page.getByRole('button', { name: '部分スタイルをすべて解除', exact: true }).click();
  await loadTemplate(priorityTemplate);
  assert.ok((await download('exportSelected', 'partial-priority-roundtrip.png')).equals(priorityBytes));
  assert.deepEqual((await template('partial-style-roundtrip')).partialStyles, priorityTemplate.partialStyles);
  mark('部分font/gradient/glyphScaleのテンプレート往復・PNGバイト一致');

  const customPalette = [...priorityTemplate.palette];
  const oldTemplate = structuredClone(priorityTemplate);
  delete oldTemplate.palette; delete oldTemplate.fontCatalog;
  delete oldTemplate.typography.fontStyle; delete oldTemplate.typography.slant;
  delete oldTemplate.typography.glyphScaleX; delete oldTemplate.typography.glyphScaleY;
  delete oldTemplate.background.imageMode; delete oldTemplate.background.followSettings;
  oldTemplate.partialStyles = [];
  await loadTemplate(oldTemplate);
  const migratedTemplate = await template('old-template-normalized');
  assert.equal(migratedTemplate.palette.length, 6);
  assert.equal(migratedTemplate.typography.glyphScaleX, 1);
  assert.equal(migratedTemplate.background.imageMode, 'fixed');
  await loadTemplate({ ...priorityTemplate, palette: customPalette });
  mark('旧schemaVersion 1 JSONをdefault palette/glyph/background modeで互換読込');

  await tab('テキスト');
  await selectRange(0, 1);
  await page.getByRole('button', { name: '部分スタイルをすべて解除', exact: true }).click();
  await setText('短い\nとても長いテキストです');
  await page.getByLabel('フォント', { exact: true }).selectOption('Arial');
  await number('文字サイズ', 100); await number('文字間隔', 4); await number('行間', 1.05); await number('文字幅', 100); await number('文字高さ', 100); await number('グループの回転', 0);
  await tab('背景');
  await page.getByLabel('背景タイプ', { exact: true }).selectOption('uploadedImage');
  const requestStart = requests.length;
  await page.getByLabel('テキスト背景ファイル', { exact: true }).setInputFiles(referencePng);
  await page.getByAltText('読み込んだテキスト背景').waitFor();
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('fixed');
  await pause(450);
  await snap('05-png-fixed-background');
  assert.equal((await template('fixed-image-mode')).background.imageMode, 'fixed');
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('followLines');
  await pause(500);
  await snap('06-png-auto-follow-normal-lines');
  const pngFollow = await template('png-follow');
  assert.equal(pngFollow.background.imageMode, 'followLines');
  assert.equal(pngFollow.background.image.sourceMimeType, 'image/png');
  assert.equal(requests.slice(requestStart).filter((url) => /^https?:/.test(url) && !url.startsWith(new URL(appUrl).origin)).length, 0);
  mark('参考PNGを通常経路で固定/自動追従切替・外部送信なし');

  await tab('テキスト'); await number('行間', 2);
  await tab('背景');
  const followSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 140"><rect width="600" height="140" rx="8" fill="#00dfe8"/><path d="M0 0h125v140H0z" fill="#df1020"/><path d="M475 0h125v140H475z" fill="#d000d8"/></svg>';
  await page.getByLabel('テキスト背景ファイル', { exact: true }).setInputFiles({ name: 'three-slice.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(followSvg) });
  await page.getByAltText('読み込んだテキスト背景').waitFor();
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('fixed');
  const fixedSvgStats = await analyzePng(await download('exportSelected', 'svg-fixed.png'));
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('followLines');
  const followSvgPng = await download('exportSelected', 'svg-follow.png');
  const followStats = await analyzePng(followSvgPng);
  assert.ok(fixedSvgStats.bands.length <= 1, JSON.stringify(fixedSvgStats.bands));
  assert.equal(followStats.bands.length, 2, JSON.stringify(followStats.bands));
  assert.ok(followStats.bands[1].width > followStats.bands[0].width * 1.7, JSON.stringify(followStats.bands));
  await snap('07-svg-auto-follow-measured-lines');
  mark('SVG固定1枚/行別2枚・実寸幅追従・3slice端部維持', JSON.stringify(followStats.bands));

  await tab('テキスト');
  await setText('一行目をかなり長く変更しました\nとても長いテキストです');
  const changedStats = await analyzePng(await download('exportSelected', 'svg-follow-text-changed.png'));
  assert.equal(changedStats.bands.length, 2);
  assert.ok(changedStats.bands[0].width > followStats.bands[0].width * 2);
  assert.ok(Math.abs(changedStats.bands[1].width - followStats.bands[1].width) < 8);
  const beforeGlyphBands = changedStats.bands;
  await number('文字幅', 90); await number('文字高さ', 110);
  const globalGlyphBands = (await analyzePng(await download('exportSelected', 'svg-follow-global-glyph.png'))).bands;
  assert.ok(globalGlyphBands[0].width < beforeGlyphBands[0].width);
  assert.ok(globalGlyphBands[0].height > beforeGlyphBands[0].height);
  mark('文字変更・全体glyph幅/高さへ行背景が再追従');

  await number('文字サイズ', 90);
  const smallerFontBands = (await analyzePng(await download('exportSelected', 'svg-follow-font-size-90.png'))).bands;
  assert.ok(smallerFontBands[0].width < globalGlyphBands[0].width && smallerFontBands[0].height < globalGlyphBands[0].height);
  await number('文字サイズ', 100); await number('文字間隔', 24);
  const widerTrackingBands = (await analyzePng(await download('exportSelected', 'svg-follow-letter-spacing-24.png'))).bands;
  assert.ok(widerTrackingBands[0].width > globalGlyphBands[0].width && widerTrackingBands[1].width > globalGlyphBands[1].width);
  await number('文字間隔', 4);
  mark('文字サイズ・字間変更へ行背景が再追従');

  await selectRange(0, 4);
  await check('文字色を部分適用', false); await check('フォントを部分適用', false);
  await check('文字幅を部分適用', true); await check('文字高さを部分適用', true);
  await number('範囲の文字幅', 80); await number('範囲の文字高さ', 115);
  await applyRange();
  const partialFollowStats = await analyzePng(await download('exportSelected', 'svg-follow-partial-glyph.png'));
  assert.equal(partialFollowStats.bands.length, 2);
  assert.ok(partialFollowStats.bands[0].width < globalGlyphBands[0].width, JSON.stringify(partialFollowStats.bands));
  assert.ok(partialFollowStats.bands[0].height > globalGlyphBands[0].height, JSON.stringify(partialFollowStats.bands));
  assert.ok(Math.abs(partialFollowStats.bands[1].width - globalGlyphBands[1].width) < 8, JSON.stringify(partialFollowStats.bands));
  assert.ok(Math.abs(partialFollowStats.bands[1].height - globalGlyphBands[1].height) < 4, JSON.stringify(partialFollowStats.bands));
  const partialFollowTemplate = await template('svg-follow-partial-glyph');
  assert.equal(partialFollowTemplate.partialStyles.at(-1).glyphScaleX, 0.8);
  assert.equal(partialFollowTemplate.partialStyles.at(-1).glyphScaleY, 1.15);
  mark('部分glyph倍率混在後の行背景bounds追従・保存');

  const allPartialLow = structuredClone(partialFollowTemplate);
  const currentTextLength = (await page.getByLabel('選択中のテキスト内容', { exact: true }).inputValue()).length;
  allPartialLow.partialStyles = [{ start: 0, end: currentTextLength, glyphScaleY: 0.5 }];
  await loadTemplate(allPartialLow);
  const allPartialLowBands = (await analyzePng(await download('exportSelected', 'svg-follow-all-partial-height-50.png'))).bands;
  const allGlobalLow = structuredClone(partialFollowTemplate);
  allGlobalLow.typography.glyphScaleY = 0.5;
  allGlobalLow.partialStyles = [];
  await loadTemplate(allGlobalLow);
  const allGlobalLowBands = (await analyzePng(await download('exportSelected', 'svg-follow-global-height-50.png'))).bands;
  assert.equal(allPartialLowBands.length, allGlobalLowBands.length);
  allPartialLowBands.forEach((band, index) => {
    assert.ok(Math.abs(band.height - allGlobalLowBands[index].height) <= 2, JSON.stringify({ allPartialLowBands, allGlobalLowBands }));
  });
  await loadTemplate(partialFollowTemplate);
  mark('全範囲の部分文字高さ50%は全体高さ50%と同じ行背景高');

  await tab('テキスト');
  await number('文字サイズ', 70);
  await number('グループの回転', 0);
  const outerBefore = await selectedNumber('scale-x');
  await scaleSelection();
  assert.notEqual(await selectedNumber('scale-x'), outerBefore);
  assert.equal(await selectedNumber('glyph-scale-x'), 0.9);
  await number('グループの回転', 14);
  const transformedFollow = await download('exportSelected', 'svg-follow-transformed.png');
  assert.ok((await analyzePng(transformedFollow)).alphaMass > 100000);
  await snap('08-auto-follow-scaled-rotated');
  const transformedTemplate = await template('follow-transformed');
  await tab('背景');
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('fixed');
  await loadTemplate(transformedTemplate);
  assert.ok((await download('exportSelected', 'follow-transformed-roundtrip.png')).equals(transformedFollow));
  mark('自動追従背景と文字の一体拡縮/回転・glyph倍率独立・PNG/JSON往復');

  await page.getByLabel('背景画像ファイル', { exact: true }).setInputFiles(referencePng);
  await tab('背景');
  const card = page.locator('.background-file-card');
  await card.waitFor();
  await card.scrollIntoViewIfNeeded();
  await pause();
  const summaryBox = await card.locator('.background-file-summary').boundingBox();
  const buttonBox = await page.getByRole('button', { name: 'キャンバス背景画像を削除', exact: true }).boundingBox();
  assert.ok(buttonBox.y > summaryBox.y && buttonBox.x + buttonBox.width <= (await card.boundingBox()).x + (await card.boundingBox()).width + 1);
  await snap('09-canvas-background-delete-layout');
  await page.getByRole('button', { name: 'キャンバス背景画像を削除', exact: true }).click();
  await card.waitFor({ state: 'detached' });
  mark('キャンバス背景削除ボタンの独立配置・右寄せ・削除動作');

  await tab('テキスト');
  await page.getByRole('button', { name: 'PCのフォントを追加', exact: true }).click();
  await page.getByRole('heading', { name: 'PCのフォントを追加', exact: true }).waitFor();
  await page.getByLabel('PCフォントを検索', { exact: true }).fill('Arial');
  const fontResults = page.locator('.font-result');
  assert.ok(await fontResults.count() > 0);
  await snap('10-local-font-search');
  const chosenName = await fontResults.first().locator('strong').innerText();
  await fontResults.first().click();
  const localFontTemplate = await template('local-font');
  assert.ok(localFontTemplate.typography.fontRefId.startsWith('local:'));
  const localReference = localFontTemplate.fontCatalog.find((font) => font.id === localFontTemplate.typography.fontRefId);
  assert.equal(localReference.source, 'local-access');
  assert.ok(localReference.family && localReference.fullName && localReference.postscriptName);
  assert.ok((await analyzePng(await download('exportSelected', 'local-font.png'))).alphaMass > 100000);
  mark('Chrome Local Font Access実API・516件環境から検索/追加/全体適用/PNG', chosenName);

  await selectRange(0, 2);
  await check('文字幅を部分適用', false); await check('文字高さを部分適用', false);
  await check('フォントを部分適用', true);
  await page.getByLabel('範囲のフォント', { exact: true }).selectOption(`ref:${localReference.id}`);
  await applyRange();
  const partialLocalFont = await template('partial-local-font');
  assert.equal(partialLocalFont.partialStyles.at(-1).fontRefId, localReference.id);
  mark('選択範囲だけPCフォント・複数font混在・識別情報保存');

  for (const [format, filePath] of fontFiles) {
    const beforeRef = await selected('font-ref-id');
    await page.getByLabel('追加するフォントファイル', { exact: true }).setInputFiles(filePath);
    await page.waitForFunction((before) => document.querySelector('.editor-shell')?.getAttribute('data-selected-font-ref-id') !== before, beforeRef);
    const value = await template(`file-font-${format.toLowerCase()}`);
    const reference = value.fontCatalog.find((font) => font.id === value.typography.fontRefId);
    assert.equal(reference.source, 'file');
    assert.ok(!JSON.stringify(reference).includes('data:') && !('blob' in reference));
    assert.ok((await analyzePng(await download('exportSelected', `file-font-${format.toLowerCase()}.png`))).alphaMass > 100000);
  }
  await page.getByLabel('フォント', { exact: true }).selectOption(`ref:${localReference.id}`);
  await snap('11-font-file-fallback');
  mark('TTF/OTF/WOFF/WOFF2をFontFaceで実読込・使用・binary非保存');

  const availableFontTemplate = await template('available-local-font');
  const missingFontTemplate = structuredClone(availableFontTemplate);
  const missingReference = {
    id: 'local:TGSPhase25DefinitelyMissing', family: 'TGS Phase25 Definitely Missing',
    fullName: '存在しないテストフォント', postscriptName: 'TGSPhase25DefinitelyMissing',
    style: 'Regular', weight: 400, source: 'local-access',
  };
  missingFontTemplate.fontCatalog = [...missingFontTemplate.fontCatalog, missingReference];
  missingFontTemplate.typography.fontFamily = missingReference.family;
  missingFontTemplate.typography.fontRefId = missingReference.id;
  await loadTemplate(missingFontTemplate);
  await page.getByText(/このPCで利用できないフォントがあります/).waitFor();
  assert.ok((await analyzePng(await download('exportSelected', 'missing-font-fallback.png'))).alphaMass > 100000);
  await loadTemplate(availableFontTemplate);
  mark('同じPCに存在しない保存fontは警告＋安全なfallbackで編集/PNG維持');

  const unsupported = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  await unsupported.addInitScript(() => Object.defineProperty(window, 'queryLocalFonts', { value: undefined, configurable: true }));
  const unsupportedPage = await unsupported.newPage();
  await unsupportedPage.goto(appUrl, { waitUntil: 'networkidle' });
  await unsupportedPage.locator('.startup-cover').waitFor({ state: 'hidden' });
  await unsupportedPage.getByRole('button', { name: 'PCのフォントを追加', exact: true }).click();
  await unsupportedPage.getByText('このブラウザはPCフォント一覧に対応していません。フォントファイル追加をご利用ください。', { exact: true }).waitFor();
  assert.equal(await unsupportedPage.locator('canvas.upper-canvas').count(), 1);
  await unsupported.close();
  mark('queryLocalFonts非対応分岐でも編集Canvasを維持');

  await tab('スタイル');
  await page.getByLabel('パレット色 1', { exact: true }).fill('#3155AA');
  await tab('背景');
  await page.getByLabel('画像背景の使い方', { exact: true }).selectOption('followLines');
  await pause(1800);
  const saved = await readSaved();
  assert.equal(saved.palette[0], '#3155AA');
  assert.ok(saved.fontCatalog.some((font) => font.source === 'local-access'));
  assert.ok(saved.fontCatalog.filter((font) => font.source === 'file').length >= 4);
  const savedObject = saved.objects.at(-1);
  assert.equal(savedObject.background.imageMode, 'followLines');
  assert.equal(savedObject.typography.glyphScaleX, 0.9);
  assert.ok(savedObject.partialStyles.some((style) => style.glyphScaleX === 0.8));
  const beforeRestore = await download('exportProject', 'before-restore.png');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '前回の作業を復元しますか', exact: true }).waitFor();
  await page.getByRole('button', { name: '復元する', exact: true }).click();
  await page.locator('canvas.upper-canvas').waitFor();
  await pause(900);
  const restored = await readSaved();
  assert.deepEqual(restored.palette, saved.palette);
  assert.deepEqual(restored.fontCatalog, saved.fontCatalog);
  assert.deepEqual(restored.objects.at(-1).partialStyles, savedObject.partialStyles);
  assert.equal(restored.objects.at(-1).background.imageMode, 'followLines');
  const afterRestore = await download('exportProject', 'after-restore.png');
  const restoreDifference = await comparePngPixels(beforeRestore, afterRestore);
  assert.ok(
    restoreDifference.dimensionsMatch && restoreDifference.max <= 2 && restoreDifference.changed < 1200,
    JSON.stringify(restoreDifference),
  );
  await snap('12-indexeddb-restored');
  mark('palette/font identity/glyphScale/partial styles/auto backgroundのIndexedDB復元・PNG画素一致', JSON.stringify(restoreDifference));

  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({
    appUrl, browser: await browser.version(), viewport: '1600x1000', results, screenshots, errors,
  }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output }));
} catch (error) {
  await snap('failure').catch(() => undefined);
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({
    results, error: String(error.stack ?? error), errors, body: await page.locator('body').innerText().catch(() => ''),
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
