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
const typeNumberSequentially = async (locator, parts) => {
  await locator.focus();
  await locator.press('Control+A');
  let expectedDraft = '';
  for (const part of parts) {
    await locator.pressSequentially(part, { delay: 35 });
    expectedDraft += part;
    assert.equal(await locator.inputValue(), expectedDraft, `Numeric draft should preserve "${expectedDraft}"`);
  }
  await locator.press('Enter');
  await delay(60);
  assert.equal(Number(await locator.inputValue()), Number(expectedDraft));
};

const results = [];
const mark = (name) => results.push(name);
const capture = (name) => page.screenshot({
  path: path.join(OUTPUT_DIR, name),
  type: 'jpeg',
  quality: 72,
  fullPage: true,
});

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.locator('.startup-cover').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  await page.locator('canvas.upper-canvas').waitFor({ state: 'visible' });

  const canvasSize = await page.locator('canvas.lower-canvas').evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
  assert.deepEqual(canvasSize, { width: 1080, height: 1920 });
  assert.equal(await objectCount(), 1);
  mark('初期1080×1920キャンバスとサンプル');
  await capture('phase1-1-01-initial.jpg');

  const addTextarea = page.getByLabel('追加するテキスト');
  await addTextarea.fill('テスト\n2行目です');
  await page.getByRole('button', { name: 'テキストを追加' }).click();
  await page.waitForFunction(() => document.querySelector('.editor-shell')?.getAttribute('data-object-count') === '2');
  mark('日本語2行テキスト追加');

  await page.getByLabel('フォント', { exact: true }).selectOption('Meiryo');
  const sizeInput = page.getByLabel('文字サイズの数値');
  const spacingInput = page.getByLabel('文字間隔の数値');
  const lineHeightInput = page.getByLabel('行間の数値');
  const rotationInput = page.getByLabel('グループの回転の数値');
  await typeNumberSequentially(sizeInput, ['1', '2', '4']);
  await typeNumberSequentially(sizeInput, ['4', '0', '0']);
  await typeNumberSequentially(sizeInput, ['1', '2', '4']);
  await typeNumberSequentially(spacingInput, ['0']);
  await typeNumberSequentially(spacingInput, ['1', '2']);
  await typeNumberSequentially(lineHeightInput, ['1', '.', '2', '5']);
  await typeNumberSequentially(rotationInput, ['-', '1', '5']);
  await sizeInput.focus();
  await sizeInput.press('Control+A');
  await sizeInput.pressSequentially('222', { delay: 35 });
  await sizeInput.press('Escape');
  assert.equal(await sizeInput.inputValue(), '124');
  assert.equal(await rotationInput.inputValue(), '-15');
  mark('数値draft入力・Escape・日本語フォント・サイズ・字間・行間');

  await page.getByRole('tab', { name: 'スタイル' }).click();
  await page.getByLabel('文字色HEX値').fill('#CE0902');
  await page.getByLabel('文字色HEX値').blur();
  await page.locator('[data-stroke-layer="1"] > summary').click();
  await page.locator('[data-stroke-layer="2"] > summary').click();
  await page.getByLabel('フチ1の幅の数値').fill('11');
  await page.getByLabel('フチ1の幅の数値').blur();
  await page.getByLabel('フチ2の幅の数値').fill('7');
  await page.getByLabel('フチ2の幅の数値').blur();
  await page.getByLabel('影のぼかしの数値').fill('13');
  await page.getByLabel('影のぼかしの数値').blur();
  await page.getByLabel('影の横位置の数値').fill('8');
  await page.getByLabel('影の横位置の数値').blur();
  await page.getByLabel('影の縦位置の数値').fill('10');
  await page.getByLabel('影の縦位置の数値').blur();
  const shadowOpacityInput = page.getByLabel('影の濃さの数値');
  await typeNumberSequentially(shadowOpacityInput, ['0']);
  assert.equal(await selectedNumber('shadow-opacity'), 0);
  await typeNumberSequentially(shadowOpacityInput, ['6', '2']);
  assert.equal(await selectedNumber('shadow-opacity'), 0.62);
  mark('文字色・フチ1・フチ2・影・影opacity');
  await capture('phase1-1-03-style-changed.jpg');

  await page.getByRole('tab', { name: '背景' }).click();
  const roughSwitch = page.getByRole('switch', { name: '黄色背景を表示' });
  await roughSwitch.click();
  assert.equal(await roughSwitch.getAttribute('aria-checked'), 'false');
  await roughSwitch.click();
  assert.equal(await roughSwitch.getAttribute('aria-checked'), 'true');
  await page.getByLabel('左右の余白の数値').fill('52');
  await page.getByLabel('左右の余白の数値').blur();
  const backgroundRotationInput = page.getByLabel('背景の追加角度の数値');
  await typeNumberSequentially(backgroundRotationInput, ['6']);
  assert.equal(await selectedNumber('background-rotation'), 6);
  await typeNumberSequentially(backgroundRotationInput, ['-', '1', '.', '5']);
  assert.equal(await selectedNumber('background-rotation'), -1.5);
  await page.locator('.stage-head').click();
  await page.keyboard.press('Control+z');
  assert.equal(await selectedNumber('background-rotation'), 6);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await selectedNumber('background-rotation'), -1.5);
  mark('黄色ラフ背景ON/OFF・余白・0.1度角度・Undo/Redo');
  await capture('phase1-1-02-yellow-on.jpg');

  await page.getByRole('tab', { name: 'テキスト' }).click();
  const beforeHorizontalCenter = {
    x: await selectedNumber('x'),
    y: await selectedNumber('y'),
  };
  await page.getByRole('button', { name: '水平方向中央' }).click();
  assert.equal(await selectedNumber('x'), canvasSize.width / 2);
  assert.equal(await selectedNumber('y'), beforeHorizontalCenter.y);
  await page.locator('.stage-head').click();
  await page.keyboard.press('Control+z');
  assert.equal(await selectedNumber('x'), beforeHorizontalCenter.x);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await selectedNumber('x'), canvasSize.width / 2);

  await page.getByRole('button', { name: '垂直方向中央' }).click();
  assert.equal(await selectedNumber('y'), canvasSize.height / 2);
  await page.locator('.stage-head').click();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await delay(600);
  assert.notEqual(await selectedNumber('x'), canvasSize.width / 2);
  assert.notEqual(await selectedNumber('y'), canvasSize.height / 2);
  await page.getByRole('button', { name: '完全中央' }).click();
  assert.equal(await selectedNumber('x'), canvasSize.width / 2);
  assert.equal(await selectedNumber('y'), canvasSize.height / 2);
  mark('水平中央・垂直中央・完全中央・Undo/Redo');

  const upperCanvas = page.locator('canvas.upper-canvas');
  const box = await upperCanvas.boundingBox();
  assert.ok(box, 'Canvas box is unavailable');
  const beforeX = await selectedNumber('x');
  const beforeY = await selectedNumber('y');
  const centerX = box.x + (beforeX / canvasSize.width) * box.width;
  const centerY = box.y + (beforeY / canvasSize.height) * box.height;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 30, centerY + 22, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((oldX) => Number(document.querySelector('.editor-shell')?.getAttribute('data-selected-x')) > oldX + 40, beforeX);
  mark('キャンバス上ドラッグ移動');

  const movedX = await selectedNumber('x');
  const movedY = await selectedNumber('y');
  const scaleBefore = await selectedNumber('scale-x');
  const cx = box.x + (movedX / canvasSize.width) * box.width;
  const cy = box.y + (movedY / canvasSize.height) * box.height;
  const controlPoint = await page.locator('canvas.lower-canvas').evaluate((canvas) => {
    const context2d = canvas.getContext('2d');
    const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
    let bestX = -1;
    let bestY = -1;
    let bestScore = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const isControlBlue = pixels[offset] >= 35
          && pixels[offset] <= 100
          && pixels[offset + 1] >= 85
          && pixels[offset + 1] <= 155
          && pixels[offset + 2] >= 190
          && pixels[offset + 2] <= 255
          && pixels[offset + 3] > 200;
        if (isControlBlue && x + y > bestScore) {
          bestX = x;
          bestY = y;
          bestScore = x + y;
        }
      }
    }
    return { x: bestX, y: bestY, width: canvas.width, height: canvas.height };
  });
  assert.ok(controlPoint.x >= 0 && controlPoint.y >= 0, 'Fabric scale control was not found');
  const handleX = box.x + ((controlPoint.x - 5) / controlPoint.width) * box.width;
  const handleY = box.y + ((controlPoint.y - 5) / controlPoint.height) * box.height;
  const outwardLength = Math.hypot(handleX - cx, handleY - cy);
  const outwardX = (handleX - cx) / outwardLength;
  const outwardY = (handleY - cy) / outwardLength;
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX + outwardX * 80, handleY + outwardY * 80, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((oldScale) => Number(document.querySelector('.editor-shell')?.getAttribute('data-selected-scale-x')) > oldScale + 0.05, scaleBefore);
  mark('キャンバス上拡大縮小');

  await page.getByRole('tab', { name: 'テキスト' }).click();
  await typeNumberSequentially(page.getByLabel('グループの回転の数値'), ['1', '7']);
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
  await capture('phase1-1-04-multiple-text.jpg');

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
  await capture('phase1-1-05-layer-operation.jpg');

  await page.getByRole('tab', { name: '出力' }).click();
  const templateBuffer = await downloadFrom(toolbar.getByRole('button', { name: '選択中の設定をテンプレート保存' }), 'phase1-template.json');
  const template = JSON.parse(templateBuffer.toString('utf8'));
  assert.equal(template.kind, 'text-graphic-studio-template');
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.background.rotation, -1.5);
  assert.equal(template.shadow.opacity, 0.62);
  await page.getByRole('tab', { name: 'テキスト' }).click();
  await typeNumberSequentially(page.getByLabel('文字サイズの数値'), ['7', '4']);
  await page.getByRole('tab', { name: 'スタイル' }).click();
  await typeNumberSequentially(page.getByLabel('影の濃さの数値'), ['2', '0']);
  await page.getByRole('tab', { name: '背景' }).click();
  await typeNumberSequentially(page.getByLabel('背景の追加角度の数値'), ['2']);
  await page.getByLabel('テンプレートJSONファイル').setInputFiles({
    name: 'phase1-template.json',
    mimeType: 'application/json',
    buffer: templateBuffer,
  });
  await page.waitForFunction(
    ({ rotation, opacity }) => {
      const shell = document.querySelector('.editor-shell');
      return Number(shell?.getAttribute('data-selected-background-rotation')) === rotation
        && Number(shell?.getAttribute('data-selected-shadow-opacity')) === opacity;
    },
    { rotation: template.background.rotation, opacity: template.shadow.opacity },
  );
  await page.getByRole('tab', { name: 'テキスト' }).click();
  assert.equal(Number(await page.getByLabel('文字サイズの数値').inputValue()), template.typography.fontSize);
  mark('テンプレートJSON保存・読込・角度/影opacity再適用');

  const sizeSelect = page.getByLabel('キャンバスサイズ');
  await sizeSelect.selectOption('landscape');
  await page.waitForFunction(() => document.querySelector('canvas.lower-canvas')?.width === 1920 && document.querySelector('canvas.lower-canvas')?.height === 1080);
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
  await capture('phase1-1-06-background-image.jpg');

  await page.getByRole('tab', { name: '背景' }).click();
  await page.getByRole('button', { name: '背景画像を削除' }).click();
  const wideBuffer = await makePngFixture(3000, 1000, '#2255cc');
  await page.getByLabel('背景画像ファイル').setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: wideBuffer });
  await page.waitForFunction(() => !document.querySelector('.busy-indicator'));
  await delay(300);
  const wideLeft = await page.locator('canvas.lower-canvas').evaluate((canvas) => [...canvas.getContext('2d').getImageData(20, 20, 1, 1).data]);
  assert.ok(wideLeft[2] > wideLeft[0], 'Wide image should cover and crop horizontally');
  mark('横長背景の左右中央クロップ・背景削除');

  await capture('phase1-1-07-transparent-before.jpg');
  const fullPng = await downloadFrom(toolbar.getByRole('button', { name: 'キャンバス全体をPNG保存' }), 'phase1-full.png');
  const fullInfo = parsePng(fullPng);
  assert.deepEqual({ width: fullInfo.width, height: fullInfo.height }, { width: 1920, height: 1080 });
  const transparentPng = await downloadFrom(toolbar.getByRole('button', { name: '選択中のテキストを透明PNG保存' }), 'phase1-transparent.png');
  const transparentInfo = readCornerAlpha(transparentPng);
  assert.ok(transparentInfo.alphas.every((alpha) => alpha === 0), 'Transparent PNG corners must be transparent');
  assert.ok(transparentInfo.dimensions.width < 1920 && transparentInfo.dimensions.height < 1080, 'Transparent export should be tightly cropped');
  mark('原寸全体PNG・選択透明PNG・透明余白検査');
  await page.waitForFunction(() => !document.querySelector('.busy-indicator'));
  await capture('phase1-1-08-transparent-after.jpg');

  await page.getByRole('tab', { name: '出力' }).click();
  const batchDownloads = [];
  const collectDownload = (download) => batchDownloads.push(download);
  page.on('download', collectDownload);
  await toolbar.getByRole('button', { name: 'すべてを個別に透明PNG保存' }).click();
  await delay(1400);
  page.off('download', collectDownload);
  assert.equal(batchDownloads.length, 3);
  mark('全テキスト透明PNG一括保存');

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
  await page.getByRole('tab', { name: 'レイヤー' }).click();
  const expectedSelectedLayerName = await page.locator('.layer-row.is-selected').getByLabel('レイヤー名').inputValue();
  const expectedAfterReload = {
    count: await objectCount(),
    x: await selectedNumber('x'),
    y: await selectedNumber('y'),
    backgroundRotation: await selectedNumber('background-rotation'),
    shadowOpacity: await selectedNumber('shadow-opacity'),
  };
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '前回の作業を復元しますか' }).waitFor();
  await page.getByRole('button', { name: '復元する' }).click();
  await page.getByRole('tab', { name: 'レイヤー' }).click();
  const restoredLayerNameInputs = page.getByLabel('レイヤー名');
  let restoredSelected = false;
  for (let index = 0; index < await restoredLayerNameInputs.count(); index += 1) {
    const input = restoredLayerNameInputs.nth(index);
    if (await input.inputValue() === expectedSelectedLayerName) {
      await input.click();
      restoredSelected = true;
      break;
    }
  }
  assert.ok(restoredSelected, 'Previously selected layer was not restored');
  await page.waitForFunction(
    (expected) => {
      const shell = document.querySelector('.editor-shell');
      const canvas = document.querySelector('canvas.lower-canvas');
      return Number(shell?.getAttribute('data-object-count')) === expected.count
        && Number(shell?.getAttribute('data-selected-x')) === expected.x
        && Number(shell?.getAttribute('data-selected-y')) === expected.y
        && Number(shell?.getAttribute('data-selected-background-rotation')) === expected.backgroundRotation
        && Number(shell?.getAttribute('data-selected-shadow-opacity')) === expected.shadowOpacity
        && canvas?.width === 1920
        && canvas?.height === 1080;
    },
    expectedAfterReload,
  );
  mark('IndexedDB自動保存・リロード復元（位置・角度・影opacity）');

  assert.equal(await page.locator('.inspector-tab svg').count(), 5);
  await page.getByRole('tab', { name: 'スタイル' }).click();
  assert.ok(await page.getByRole('tab', { name: 'スタイル' }).getAttribute('data-active') !== null);
  const tooltipCases = [
    ['新規', '新規プロジェクト'],
    ['背景画像', '背景画像を読み込む'],
    ['元に戻す', '元に戻す（Ctrl+Z）'],
    ['やり直す', 'やり直す（Ctrl+Shift+Z / Ctrl+Y）'],
    ['複製', '選択中のテキストを複製（Ctrl+D）'],
    ['削除', '選択中のテキストを削除（Delete）'],
    ['テンプレートJSONを読み込む', 'テンプレートJSONを読み込む'],
    ['選択中の設定をテンプレート保存', '選択中の設定をテンプレート保存'],
    ['選択中のテキストを透明PNG保存', '選択中のテキストを透明PNG保存'],
    ['キャンバス全体をPNG保存', 'キャンバス全体をPNG保存'],
  ];
  for (const [buttonName, tooltipText] of tooltipCases) {
    const anchor = toolbar.getByRole('button', { name: buttonName, exact: true }).locator('xpath=..');
    await anchor.hover();
    await page.getByRole('tooltip', { name: tooltipText }).waitFor();
    await page.mouse.move(0, 0);
    await page.getByRole('tooltip', { name: tooltipText }).waitFor({ state: 'hidden' });
  }
  mark('主要10操作の日本語hoverツールチップ・右タブ選択表示');

  await toolbar.getByRole('button', { name: '新規' }).click();
  await page.getByRole('heading', { name: '新しいプロジェクトを開始しますか' }).waitFor();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  assert.equal(await objectCount(), expectedAfterReload.count);
  await toolbar.getByRole('button', { name: '新規' }).click();
  await page.getByRole('button', { name: '新規プロジェクト' }).click();
  await page.waitForFunction(() => document.querySelector('canvas.lower-canvas')?.width === 1080 && document.querySelector('canvas.lower-canvas')?.height === 1920);
  assert.equal(await objectCount(), 1);
  mark('新規確認ダイアログ・新規1080×1920');

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
