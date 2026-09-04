import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { chromium } from 'playwright-core';

const APP_URL = process.env.PHASE1_APP_URL ?? 'http://localhost:3000/';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTPUT_DIR = path.resolve('test-results');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const parsePng = (buffer) => {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'PNG signature is missing');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  return { width, height, bitDepth, colorType, idat: Buffer.concat(idat) };
};

const paeth = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
};

const readCornerAlpha = (buffer) => {
  const png = parsePng(buffer);
  assert.equal(png.bitDepth, 8, 'Expected an 8-bit PNG');
  assert.equal(png.colorType, 6, 'Transparent export must be RGBA');
  const bytesPerPixel = 4;
  const rowLength = png.width * bytesPerPixel;
  const source = inflateSync(png.idat);
  const decoded = Buffer.alloc(rowLength * png.height);
  let sourceOffset = 0;
  for (let y = 0; y < png.height; y += 1) {
    const filter = source[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < rowLength; x += 1) {
      const raw = source[sourceOffset + x];
      const outputOffset = y * rowLength + x;
      const left = x >= bytesPerPixel ? decoded[outputOffset - bytesPerPixel] : 0;
      const up = y > 0 ? decoded[outputOffset - rowLength] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? decoded[outputOffset - rowLength - bytesPerPixel] : 0;
      if (filter === 0) decoded[outputOffset] = raw;
      else if (filter === 1) decoded[outputOffset] = (raw + left) & 0xff;
      else if (filter === 2) decoded[outputOffset] = (raw + up) & 0xff;
      else if (filter === 3) decoded[outputOffset] = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) decoded[outputOffset] = (raw + paeth(left, up, upperLeft)) & 0xff;
      else throw new Error(`Unsupported PNG filter: ${filter}`);
    }
    sourceOffset += rowLength;
  }
  return {
    dimensions: { width: png.width, height: png.height },
    alphas: [
      decoded[3],
      decoded[(png.width - 1) * 4 + 3],
      decoded[(png.height - 1) * rowLength + 3],
      decoded[(png.height * rowLength) - 1],
    ],
  };
};

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--disable-gpu-sandbox'],
});
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1600, height: 980 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

const downloadFrom = async (locator, outputName) => {
  const [download] = await Promise.all([page.waitForEvent('download'), locator.click()]);
  const outputPath = path.join(OUTPUT_DIR, outputName);
  await download.saveAs(outputPath);
  return readFile(outputPath);
};

const makePngFixture = async (width, height, color) => {
  const dataUrl = await page.evaluate(({ fixtureWidth, fixtureHeight, fixtureColor }) => {
    const canvas = document.createElement('canvas');
    canvas.width = fixtureWidth;
    canvas.height = fixtureHeight;
    const context2d = canvas.getContext('2d');
    if (!context2d) throw new Error('2D context is unavailable');
    context2d.fillStyle = fixtureColor;
    context2d.fillRect(0, 0, fixtureWidth, fixtureHeight);
    context2d.fillStyle = '#ffffff';
    context2d.fillRect(fixtureWidth / 2 - 8, 0, 16, fixtureHeight);
    return canvas.toDataURL('image/png');
  }, { fixtureWidth: width, fixtureHeight: height, fixtureColor: color });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
};

const selectedNumber = async (name) => Number(await page.locator('.editor-shell').getAttribute(`data-selected-${name}`));
const objectCount = async () => Number(await page.locator('.editor-shell').getAttribute('data-object-count'));

const results = [];
const mark = (name) => results.push(name);

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  await page.locator('canvas.upper-canvas').waitFor({ state: 'visible' });

  const canvasSize = await page.locator('canvas.lower-canvas').evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
  assert.deepEqual(canvasSize, { width: 1920, height: 1080 });
  assert.equal(await objectCount(), 1);
  mark('初期1920×1080キャンバスとサンプル');

  const addTextarea = page.getByLabel('追加するテキスト');
  await addTextarea.fill('テスト\n2行目です');
  await page.getByRole('button', { name: 'テキストを追加' }).click();
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '2');
  mark('日本語2行テキスト追加');

  await page.getByLabel('フォント').selectOption('Meiryo');
  const sizeInput = page.getByLabel('文字サイズの数値');
  await sizeInput.fill('124');
  await sizeInput.blur();
  await page.getByLabel('文字間隔の数値').fill('12');
  await page.getByLabel('文字間隔の数値').blur();
  await page.getByLabel('行間の数値').fill('1.25');
  await page.getByLabel('行間の数値').blur();
  assert.equal(await sizeInput.inputValue(), '124');
  mark('日本語フォント・サイズ・字間・行間の即時反映');

  await page.getByRole('tab', { name: 'スタイル' }).click();
  await page.getByLabel('文字色HEX値').fill('#CE0902');
  await page.getByLabel('文字色HEX値').blur();
  await page.getByLabel('白フチの幅の数値').fill('11');
  await page.getByLabel('白フチの幅の数値').blur();
  await page.getByLabel('黒フチの幅の数値').fill('7');
  await page.getByLabel('黒フチの幅の数値').blur();
  await page.getByLabel('影のぼかしの数値').fill('13');
  await page.getByLabel('影のぼかしの数値').blur();
  await page.getByLabel('影の横位置の数値').fill('8');
  await page.getByLabel('影の横位置の数値').blur();
  await page.getByLabel('影の縦位置の数値').fill('10');
  await page.getByLabel('影の縦位置の数値').blur();
  mark('文字色・白フチ・黒フチ・影');

  await page.getByRole('tab', { name: '背景' }).click();
  const roughSwitch = page.getByRole('switch', { name: '黄色背景を表示' });
  await roughSwitch.click();
  assert.equal(await roughSwitch.getAttribute('aria-checked'), 'false');
  await roughSwitch.click();
  assert.equal(await roughSwitch.getAttribute('aria-checked'), 'true');
  await page.getByLabel('左右の余白の数値').fill('52');
  await page.getByLabel('左右の余白の数値').blur();
  await page.getByLabel('背景の追加角度の数値').fill('6');
  await page.getByLabel('背景の追加角度の数値').blur();
  mark('黄色ラフ背景ON/OFF・余白・独立角度');

  const upperCanvas = page.locator('canvas.upper-canvas');
  const box = await upperCanvas.boundingBox();
  assert.ok(box, 'Canvas box is unavailable');
  const beforeX = await selectedNumber('x');
  const beforeY = await selectedNumber('y');
  const centerX = box.x + (beforeX / 1920) * box.width;
  const centerY = box.y + (beforeY / 1080) * box.height;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 78, centerY + 42, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((oldX) => Number(document.querySelector('.editor-shell')?.getAttribute('data-selected-x')) > oldX + 40, beforeX);
  mark('キャンバス上ドラッグ移動');

  const movedX = await selectedNumber('x');
  const movedY = await selectedNumber('y');
  const objectWidth = await selectedNumber('width');
  const objectHeight = await selectedNumber('height');
  const scaleBefore = await selectedNumber('scale-x');
  const rotation = (await selectedNumber('rotation')) * Math.PI / 180;
  const cssScale = box.width / 1920;
  const cx = box.x + (movedX / 1920) * box.width;
  const cy = box.y + (movedY / 1080) * box.height;
  const dx = objectWidth * scaleBefore * cssScale / 2;
  const dy = objectHeight * scaleBefore * cssScale / 2;
  const handleX = cx + dx * Math.cos(rotation) - dy * Math.sin(rotation);
  const handleY = cy + dx * Math.sin(rotation) + dy * Math.cos(rotation);
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX + 65, handleY + 45, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((oldScale) => Number(document.querySelector('.editor-shell')?.getAttribute('data-selected-scale-x')) > oldScale + 0.05, scaleBefore);
  mark('キャンバス上拡大縮小');

  await page.getByRole('tab', { name: 'テキスト' }).click();
  await page.getByLabel('グループの回転の数値').fill('17');
  await page.getByLabel('グループの回転の数値').blur();
  assert.equal(Math.round(await selectedNumber('rotation')), 17);
  mark('回転角度リアルタイム反映');

  await page.locator('.stage-head').click();
  await page.keyboard.press('Control+d');
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '3');
  const duplicatedX = await selectedNumber('x');
  await page.keyboard.press('ArrowRight');
  await delay(300);
  assert.equal(Math.round(await selectedNumber('x')), Math.round(duplicatedX + 1));
  await page.keyboard.press('Shift+ArrowDown');
  await delay(300);
  mark('Ctrl+D・矢印1px・Shift+矢印10px');

  const toolbar = page.locator('.editor-toolbar');
  await toolbar.getByRole('button', { name: '削除' }).click();
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '2');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '3');
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '2');
  await toolbar.getByRole('button', { name: '複製' }).click();
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '3');
  mark('削除・Undo・Redo・ツールバー複製');

  await page.getByRole('tab', { name: 'レイヤー' }).click();
  assert.equal(await page.locator('.layer-row').count(), 3);
  const firstLayer = page.locator('.layer-row').first();
  await firstLayer.getByTitle('非表示にする').click();
  await firstLayer.getByTitle('表示する').click();
  await firstLayer.getByTitle('ロック').click();
  await firstLayer.getByTitle('ロックを解除').click();
  await page.getByRole('button', { name: '最背面へ' }).click();
  mark('レイヤー選択・表示・ロック・重なり順');

  await page.getByRole('tab', { name: '出力' }).click();
  const templateBuffer = await downloadFrom(page.getByRole('button', { name: '選択中の設定を保存' }), 'phase1-template.json');
  const template = JSON.parse(templateBuffer.toString('utf8'));
  assert.equal(template.kind, 'text-graphic-studio-template');
  assert.equal(template.schemaVersion, 1);
  await page.getByRole('tab', { name: 'テキスト' }).click();
  await page.getByLabel('文字サイズの数値').fill('74');
  await page.getByLabel('文字サイズの数値').blur();
  await page.getByLabel('テンプレートJSONファイル').setInputFiles({
    name: 'phase1-template.json',
    mimeType: 'application/json',
    buffer: templateBuffer,
  });
  await page.waitForFunction((expected) => Number(document.querySelector('[aria-label="文字サイズの数値"]')?.value) === expected, template.typography.fontSize);
  mark('テンプレートJSON保存・読込・再適用');

  const portraitBuffer = await makePngFixture(1080, 1920, '#00aa44');
  await page.getByLabel('背景画像ファイル').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: portraitBuffer });
  await page.waitForFunction(() => !document.querySelector('.busy-indicator'));
  await delay(300);
  const portraitPixels = await page.locator('canvas.lower-canvas').evaluate((canvas) => {
    const context2d = canvas.getContext('2d');
    return {
      left: [...context2d.getImageData(40, 40, 1, 1).data],
      center: [...context2d.getImageData(800, 40, 1, 1).data],
    };
  });
  assert.ok(portraitPixels.left[0] > 240 && portraitPixels.left[1] > 240 && portraitPixels.left[2] > 240, 'Portrait image should leave white sides with strict height-fit');
  assert.ok(portraitPixels.center[1] > portraitPixels.center[0], 'Portrait image should be centered and height-fitted');
  mark('PNG背景・9:16高さ合わせ中央配置');

  await page.getByRole('tab', { name: '背景' }).click();
  await page.getByRole('button', { name: '背景画像を削除' }).click();
  const wideBuffer = await makePngFixture(3000, 1000, '#2255cc');
  await page.getByLabel('背景画像ファイル').setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: wideBuffer });
  await page.waitForFunction(() => !document.querySelector('.busy-indicator'));
  await delay(300);
  const wideLeft = await page.locator('canvas.lower-canvas').evaluate((canvas) => [...canvas.getContext('2d').getImageData(20, 20, 1, 1).data]);
  assert.ok(wideLeft[2] > wideLeft[0], 'Wide image should cover and crop horizontally');
  mark('横長背景の左右中央クロップ・背景削除');

  const fullPng = await downloadFrom(toolbar.getByRole('button', { name: 'PNG保存' }), 'phase1-full.png');
  const fullInfo = parsePng(fullPng);
  assert.deepEqual({ width: fullInfo.width, height: fullInfo.height }, { width: 1920, height: 1080 });
  const transparentPng = await downloadFrom(toolbar.getByRole('button', { name: '透明PNG' }), 'phase1-transparent.png');
  const transparentInfo = readCornerAlpha(transparentPng);
  assert.ok(transparentInfo.alphas.every((alpha) => alpha === 0), 'Transparent PNG corners must be transparent');
  assert.ok(transparentInfo.dimensions.width < 1920 && transparentInfo.dimensions.height < 1080, 'Transparent export should be tightly cropped');
  mark('原寸全体PNG・選択透明PNG・透明余白検査');

  await page.getByRole('tab', { name: '出力' }).click();
  const batchDownloads = [];
  const collectDownload = (download) => batchDownloads.push(download);
  page.on('download', collectDownload);
  await page.getByRole('button', { name: 'すべてを個別に透明PNG保存' }).click();
  await delay(1400);
  page.off('download', collectDownload);
  assert.equal(batchDownloads.length, 3);
  mark('全テキスト透明PNG一括保存');

  const sizeSelect = page.getByLabel('キャンバスサイズ');
  await sizeSelect.selectOption('portrait');
  await page.waitForFunction(() => document.querySelector('canvas.lower-canvas')?.width === 1080 && document.querySelector('canvas.lower-canvas')?.height === 1920);
  await sizeSelect.selectOption('square');
  await page.waitForFunction(() => document.querySelector('canvas.lower-canvas')?.width === 1080 && document.querySelector('canvas.lower-canvas')?.height === 1080);
  await sizeSelect.selectOption('custom');
  await page.getByLabel('幅').fill('1400');
  await page.getByLabel('高さ').fill('900');
  await page.getByRole('button', { name: 'このサイズに変更' }).click();
  await page.waitForFunction(() => document.querySelector('canvas.lower-canvas')?.width === 1400 && document.querySelector('canvas.lower-canvas')?.height === 900);
  await sizeSelect.selectOption('landscape');
  mark('全プリセット・カスタムキャンバス切替');

  const guideSwitch = page.getByRole('switch', { name: '中央ガイドを表示' });
  await guideSwitch.click();
  assert.equal(await page.locator('.guide-overlay').count(), 0);
  await guideSwitch.click();
  assert.equal(await page.locator('.guide-overlay').count(), 1);
  mark('中央ガイドON/OFF');

  await delay(1300);
  const expectedCountAfterReload = await objectCount();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '前回の作業を復元しますか' }).waitFor();
  await page.getByRole('button', { name: '復元する' }).click();
  await page.waitForFunction((expected) => Number(document.querySelector('.editor-shell')?.getAttribute('data-object-count')) === expected, expectedCountAfterReload);
  mark('IndexedDB自動保存・リロード復元');

  await toolbar.getByRole('button', { name: '新規' }).click();
  await page.getByRole('heading', { name: '新しいプロジェクトを開始しますか' }).waitFor();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  assert.equal(await objectCount(), expectedCountAfterReload);
  mark('新規プロジェクト確認ダイアログ');

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'phase1-editor.jpg'),
    type: 'jpeg',
    quality: 58,
    fullPage: true,
  });
  assert.deepEqual(consoleErrors, [], `Browser console errors:\n${consoleErrors.join('\n')}`);
  await writeFile(path.join(OUTPUT_DIR, 'phase1-browser-results.json'), JSON.stringify({ passed: results.length, results }, null, 2));
  process.stdout.write(`PASS ${results.length} browser checks\n${results.map((result) => `- ${result}`).join('\n')}\n`);
} catch (error) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'phase1-browser-failure.png'), fullPage: true }).catch(() => undefined);
  await writeFile(
    path.join(OUTPUT_DIR, 'phase1-browser-failure.json'),
    JSON.stringify({
      completed: results,
      error: error instanceof Error ? error.stack : String(error),
      consoleErrors,
      bodyText: await page.locator('body').innerText().catch(() => ''),
    }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
