import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase2');
const appUrl = process.env.PHASE2_APP_URL ?? 'http://localhost:3000/';
const referencePng = process.env.PHASE2_BACKGROUND_PNG ?? 'C:/Users/USER/Desktop/黄色ブラシ背景だけの透過PNG.png';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], results = [], screenshots = [], requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
const toolbar = page.locator('.editor-toolbar');
const pause = (ms = 120) => page.waitForTimeout(ms);
const mark = (name, details = '') => { results.push({ name, status: 'PASS', details }); console.log('PASS ' + name); };
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const number = async (label, value) => {
  const input = page.getByLabel(label + 'の数値', { exact: true });
  await input.fill(String(value)); await input.press('Enter'); await pause();
};
const color = async (label, value) => {
  const input = page.getByLabel(label + 'HEX値', { exact: true });
  await input.fill(value); await input.blur(); await pause();
};
const selectedNumber = async (name) => Number(await page.locator('.editor-shell').getAttribute('data-selected-' + name));
const snap = async (name) => {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  screenshots.push(name + '.png');
};
const download = async (action, name) => {
  const pending = page.waitForEvent('download');
  await toolbar.locator('[data-editor-action="' + action + '"]').click();
  const file = await pending, target = path.join(output, name);
  await file.saveAs(target); return readFile(target);
};
const template = async (name) => JSON.parse((await download('templateSave', name + '.json')).toString());
const loadTemplate = async (value) => {
  await page.getByLabel('テンプレートJSONファイル').setInputFiles({ name: 'phase2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await pause(250);
};
const png = (buffer) => page.evaluate(async (base64) => {
  const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0, blue = 0, yellow = 0, orange = 0, cyan = 0, alphaMass = 0, transparent = 0;
  let redLeft = image.width, redRight = -1, redTop = image.height, redBottom = -1;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = data.subarray(i, i + 4);
    alphaMass += a; if (a === 0) transparent++;
    if (a < 150) continue;
    if (r > 160 && g < 65 && b < 90) {
      red++; const x = i / 4 % image.width, y = Math.floor(i / 4 / image.width);
      redLeft = Math.min(redLeft, x); redRight = Math.max(redRight, x); redTop = Math.min(redTop, y); redBottom = Math.max(redBottom, y);
    }
    if (b > 150 && r < 80 && g < 100) blue++;
    if (r > 210 && g > 205 && b < 60) yellow++;
    if (r > 210 && g > 65 && g < 185 && b < 60) orange++;
    if (r < 80 && g > 170 && b > 170) cyan++;
  }
  return { width: image.width, height: image.height, red, blue, yellow, orange, cyan, alphaMass, transparent, redWidth: redRight - redLeft + 1, redHeight: redBottom - redTop + 1 };
}, buffer.toString('base64'));
const canvasPng = async () => Buffer.from((await page.locator('canvas.lower-canvas').evaluate((c) => c.toDataURL())).split(',')[1], 'base64');
const comparePngPixels = (a, b) => page.evaluate(async (sources) => {
  const decoded = await Promise.all(sources.map(async (source) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + source; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
  }));
  if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) return { dimensionsMatch: false };
  let changed = 0, max = 0, total = 0;
  for (let i = 0; i < decoded[0].data.length; i++) {
    const diff = Math.abs(decoded[0].data[i] - decoded[1].data[i]);
    if (diff) changed++; total += diff; max = Math.max(max, diff);
  }
  return { dimensionsMatch: true, changed, max, mean: total / decoded[0].data.length };
}, [a.toString('base64'), b.toString('base64')]);
const selectRange = async (start, end) => {
  await tab('テキスト');
  const field = page.getByLabel('選択中のテキスト内容');
  await field.focus(); await field.press('Control+Home');
  while (await field.evaluate((el) => el.selectionStart) < start) await field.press('ArrowRight');
  while (await field.evaluate((el) => el.selectionEnd) < end) await field.press('Shift+ArrowRight');
  await page.waitForFunction(({ start, end }) => {
    const range = document.querySelector('.range-selection');
    return Number(range?.getAttribute('data-range-start')) === start && Number(range?.getAttribute('data-range-end')) === end;
  }, { start, end });
};
const check = async (label, enabled) => {
  const control = page.getByRole('checkbox', { name: label, exact: true });
  if ((await control.getAttribute('aria-checked') === 'true') !== enabled) await control.click();
};
const apply = async () => { await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click(); await pause(200); };
const readSaved = () => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('text-graphic-studio');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result, tx = db.transaction('projects'), req = tx.objectStore('projects').get('autosave');
    tx.oncomplete = () => { db.close(); resolve(req.result); };
  };
}));
const dragSelection = async () => {
  const canvas = page.locator('canvas.upper-canvas'), box = await canvas.boundingBox();
  const x = await selectedNumber('x'), y = await selectedNumber('y');
  const px = box.x + x / 1080 * box.width, py = box.y + y / 1920 * box.height;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 30, py + 20, { steps: 8 }); await page.mouse.up();
  await pause(250); assert.ok(await selectedNumber('x') > x + 30, 'Group drag must change position');
};
const scaleSelection = async () => {
  const box = await page.locator('canvas.upper-canvas').boundingBox();
  const point = await page.locator('canvas.lower-canvas').evaluate((canvas) => {
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let x = -1, y = -1, score = -1;
    for (let j = 0; j < canvas.height; j++) for (let i = 0; i < canvas.width; i++) {
      const k = (j * canvas.width + i) * 4;
      if (d[k] >= 35 && d[k] <= 100 && d[k + 1] >= 85 && d[k + 1] <= 155 && d[k + 2] >= 190 && d[k + 3] > 200 && i + j > score) { x = i; y = j; score = i + j; }
    }
    return { x, y };
  });
  assert.ok(point.x >= 0, 'Fabric scale handle visible');
  const before = await selectedNumber('scale-x');
  const x = box.x + (point.x - 5) / 1080 * box.width, y = box.y + (point.y - 5) / 1920 * box.height;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 24, y + 15, { steps: 8 }); await page.mouse.up();
  await pause(250); assert.ok(Math.abs(await selectedNumber('scale-x') - before) > .025, 'Image-backed group scaling');
};

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('canvas.upper-canvas').waitFor();
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  await pause(300); await snap('01-initial');
  const legacy = await template('legacy-baseline');
  await page.getByLabel('選択中のテキスト内容').fill('赤色ABCD\n青いタイトル');
  await page.getByLabel('選択中のテキスト内容').blur();
  await number('文字サイズ', 100); await number('文字間隔', 0); await number('グループの回転', 0);
  await page.getByRole('button', { name: '完全中央', exact: true }).click();
  await tab('背景'); await page.getByLabel('背景タイプ', { exact: true }).selectOption('none');
  await tab('テキスト');
  const widthBefore = await selectedNumber('width');
  await selectRange(0, 2); await color('範囲の文字色', '#D20A11'); await apply();
  let t = await template('range-red'); assert.equal(t.partialStyles[0].fill.color, '#D20A11');
  await selectRange(0, 2); await check('文字色を部分適用', false); await check('文字サイズを部分適用', true);
  await number('範囲の文字サイズ', 150); await apply();
  assert.ok(await selectedNumber('width') > widthBefore + 50);
  const spacedBefore = await selectedNumber('width');
  await check('文字サイズを部分適用', false); await check('文字間隔を部分適用', true);
  await number('範囲の文字間隔', 25); await apply(); assert.ok(await selectedNumber('width') > spacedBefore + 35);
  await check('文字間隔を部分適用', false); await check('太字を部分適用', true);
  await page.getByRole('button', { name: '範囲の太字 ON', exact: true }).click(); await apply();
  t = await template('range-normal'); assert.equal(t.partialStyles.at(-1).fontWeight, 400);
  const normalPng = await download('exportSelected', 'range-normal.png');
  await page.getByRole('button', { name: '範囲の太字 OFF', exact: true }).click(); await apply();
  const boldPng = await download('exportSelected', 'range-bold.png'); assert.notDeepEqual(normalPng, boldPng);
  await tab('スタイル'); await color('文字色', '#102BD5');
  const partialPng = await download('exportSelected', 'partial-styles.png');
  const partialStats = await png(partialPng); assert.ok(partialStats.red > 1000 && partialStats.blue > 1000);
  const displayedStats = await png(await canvasPng()); assert.ok(displayedStats.red > 1000 && displayedStats.blue > 1000);
  await snap('02-partial-styles');
  mark('B: 範囲色・サイズ・字間・太字ON/OFF・全体設定より優先・画面/透明PNG', JSON.stringify(partialStats));
  const styled = await template('partial-styles');
  await tab('テキスト'); await number('文字サイズ', 70); await number('文字間隔', 12);
  await page.getByRole('button', { name: '太字', exact: true }).click();
  const priorityStats = await png(await download('exportSelected', 'global-overrides.png'));
  assert.ok(Math.abs(priorityStats.redWidth - partialStats.redWidth) <= 1 && Math.abs(priorityStats.redHeight - partialStats.redHeight) <= 1, 'Range size/tracking/bold must override global settings');
  await loadTemplate(styled);
  mark('B: 全体サイズ・字間・太字変更後も部分指定文字の実画素寸法を保持');
  await tab('テキスト'); await selectRange(0, 2);
  await page.getByRole('button', { name: '部分スタイルをすべて解除' }).click();
  await loadTemplate(styled);
  assert.deepEqual((await template('partial-roundtrip')).partialStyles, styled.partialStyles);
  assert.ok((await download('exportSelected', 'partial-roundtrip.png')).equals(partialPng), 'Partial PNG roundtrip bytes');
  mark('B: 部分スタイルのテンプレート往復（PNGバイト一致）');

  await tab('スタイル'); await page.getByLabel('文字の塗り', { exact: true }).selectOption('linear-gradient');
  await color('開始色', '#FFFF00'); await color('終了色', '#FF8000'); await number('グラデーション角度', 90);
  const gradient90 = await download('exportSelected', 'gradient-90.png'), gs = await png(gradient90);
  assert.ok(gs.yellow > 100 && gs.orange > 100 && gs.red > 1000);
  await number('グラデーション角度', 0);
  const gradient0 = await download('exportSelected', 'gradient-0.png'); assert.notDeepEqual(gradient0, gradient90);
  await number('グラデーション角度', 90);
  const gradientTemplate = await template('gradient');
  await page.getByLabel('文字の塗り', { exact: true }).selectOption('solid');
  await loadTemplate(gradientTemplate); assert.ok((await download('exportSelected', 'gradient-roundtrip.png')).equals(gradient90), 'Gradient PNG roundtrip bytes');
  await snap('03-gradient');
  mark('C: 単色/線形グラデーション・開始/終了色・角度・PNG・テンプレート往復');

  const opacityStats = [];
  for (const opacity of [0, 50, 100]) {
    await number('影の濃さ', opacity); assert.equal(await selectedNumber('shadow-opacity'), opacity / 100);
    opacityStats.push(await png(await download('exportSelected', 'shadow-' + opacity + '.png')));
  }
  assert.ok(opacityStats[0].alphaMass < opacityStats[1].alphaMass && opacityStats[1].alphaMass < opacityStats[2].alphaMass);
  await number('影の濃さ', 50); const shadow = await template('shadow-50');
  await number('影の濃さ', 0); await loadTemplate(shadow); assert.equal(await selectedNumber('shadow-opacity'), .5);
  mark('D: 影0/50/100%・PNG alpha量の増加・テンプレート復元');

  await tab('背景'); await page.getByLabel('背景タイプ', { exact: true }).selectOption('uploadedImage');
  const requestStart = requests.length;
  await page.getByLabel('テキスト背景ファイル').setInputFiles(referencePng);
  await page.getByAltText('読み込んだテキスト背景').waitFor();
  await pause(400);
  assert.equal(requests.slice(requestStart).filter((r) => /^https?:/.test(r.url) && !r.url.startsWith(new URL(appUrl).origin)).length, 0, 'Local image must not be transmitted');
  const initialBackgroundWidth = await selectedNumber('width');
  await number('左右の余白', 100); await number('上下の余白', 65); await number('背景の追加角度', -1.5);
  assert.equal(await selectedNumber('background-rotation'), -1.5);
  assert.ok(await selectedNumber('width') >= initialBackgroundWidth);
  await page.getByLabel('背景プリセット名').fill('受入テスト・黄色ブラシ');
  await page.getByRole('button', { name: '背景プリセットを保存', exact: true }).click();
  await page.getByLabel('保存済み背景プリセット').locator('option').filter({ hasText: '受入テスト・黄色ブラシ' }).waitFor({ state: 'attached' });
  const presetId = await page.getByLabel('保存済み背景プリセット').inputValue(); assert.ok(presetId);
  await snap('04-png-background-before-export');
  const pngTemplate = await template('png-background'), selectedWithBg = await download('exportSelected', 'png-background-transparent.png');
  assert.equal(pngTemplate.background.type, 'uploadedImage'); assert.equal(pngTemplate.background.image.sourceMimeType, 'image/png');
  assert.ok((await png(selectedWithBg)).yellow > gs.yellow + 10000);
  const fullWithBg = await download('exportProject', 'png-background-canvas.png'); assert.ok((await png(fullWithBg)).yellow > 10000);
  await snap('05-png-background-after-export');
  await page.getByLabel('背景タイプ', { exact: true }).selectOption('none'); await loadTemplate(pngTemplate);
  assert.ok((await download('exportSelected', 'png-background-roundtrip.png')).equals(selectedWithBg), 'Background PNG roundtrip bytes');
  mark('F: 参考PNGを通常ファイル入力で読込・余白/角度・両PNG・テンプレート・外部送信なし');
  await tab('テキスト'); await page.getByRole('button', { name: '完全中央', exact: true }).click();
  await dragSelection(); await scaleSelection(); await number('グループの回転', 12);
  const moved = await template('image-transformed');
  assert.equal(moved.transform.rotation, 12); assert.ok(moved.transform.scaleX > 0);
  await snap('06-image-group-transformed');
  const transformPng = await png(await download('exportSelected', 'image-transformed.png')); assert.ok(transformPng.yellow > 10000);
  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click(); assert.equal(await selectedNumber('rotation'), 0);
  await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click(); assert.equal(await selectedNumber('rotation'), 12);
  mark('F: PNG背景と文字の一体ドラッグ・Fabricハンドル拡縮・回転・Undo/Redo');

  await page.getByLabel('追加するテキスト').fill('SVG背景'); await page.getByRole('button', { name: 'テキストを追加', exact: true }).click();
  await number('文字サイズ', 110);
  await tab('背景'); await page.getByLabel('背景タイプ', { exact: true }).selectOption('uploadedImage');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 150"><defs><linearGradient id="g"><stop stop-color="#00ffff"/><stop offset="1" stop-color="#00bbdd"/></linearGradient></defs><path d="M20 10 H460 L495 75 L460 140 H20 L5 75 Z" fill="url(#g)"/></svg>';
  await page.getByLabel('テキスト背景ファイル').setInputFiles({ name: 'generic-cyan.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.getByAltText('読み込んだテキスト背景').waitFor(); await pause(300);
  const svgTemplate = await template('svg-background');
  assert.equal(svgTemplate.background.image.sourceMimeType, 'image/svg+xml');
  assert.notEqual(svgTemplate.background.image.id, pngTemplate.background.image.id);
  assert.ok((await png(await download('exportSelected', 'svg-background.png'))).cyan > 10000);
  await tab('テキスト'); await page.getByRole('button', { name: '完全中央', exact: true }).click();
  await dragSelection(); await scaleSelection(); await number('グループの回転', -8);
  const svgMoved = await template('svg-moved');
  await tab('背景'); await page.getByLabel('背景タイプ', { exact: true }).selectOption('none'); await loadTemplate(svgMoved);
  assert.ok((await png(await download('exportSelected', 'svg-roundtrip.png'))).cyan > 10000);
  await snap('07-multiple-png-svg-backgrounds');
  mark('F: 汎用SVGローカルPNG化・別テキストの別背景・一体変形・テンプレート');

  await page.getByLabel('保存済み背景プリセット').selectOption(presetId);
  await page.getByRole('button', { name: '背景プリセットを適用', exact: true }).click();
  assert.equal((await template('preset-applied')).background.image.id, pngTemplate.background.image.id);
  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.equal((await template('preset-undo')).background.image.id, svgTemplate.background.image.id);
  await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click();
  await page.getByRole('button', { name: '背景プリセットを削除', exact: true }).click();
  await pause(150); assert.equal(await page.getByLabel('保存済み背景プリセット').locator('option').count(), 1);
  assert.equal((await template('preset-after-delete')).background.image.id, pngTemplate.background.image.id);
  await loadTemplate(svgMoved);
  mark('F: ローカル背景プリセット保存・再適用・Undo/Redo・削除（使用中画像は保持）');

  const bad = structuredClone(svgMoved); bad.background.image.width += 10;
  await loadTemplate(bad);
  await page.getByText('背景画像の寸法が一致しません。', { exact: true }).waitFor();
  assert.equal((await template('after-invalid-template')).background.image.width, svgMoved.background.image.width);
  const externalStart = requests.length;
  await page.getByLabel('テキスト背景ファイル').setInputFiles({ name: 'external.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="150"><use href="https://example.invalid/external.svg#x"/></svg>') });
  await page.getByText('外部参照を含むSVGは読み込めません。', { exact: true }).waitFor();
  assert.equal(requests.slice(externalStart).filter((r) => r.url.includes('example.invalid')).length, 0);
  mark('F: 寸法改変テンプレート・外部参照SVGの拒否（外部リクエスト0）');

  await tab('出力'); const beforeGuides = await download('exportProject', 'guide-off.png');
  await page.getByRole('switch', { name: 'SNS配置ガイドを表示', exact: true }).click();
  for (const platform of ['instagram-reels', 'threads', 'youtube-shorts', 'x']) {
    await page.getByLabel('SNSガイドの種類').selectOption(platform);
    const overlay = page.locator('[data-social-platform="' + platform + '"]');
    await overlay.waitFor(); assert.equal(await overlay.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
    assert.ok((await download('exportProject', 'guide-' + platform + '.png')).equals(beforeGuides), 'Guide must not affect PNG bytes');
  }
  await page.getByLabel('SNSガイドの種類').selectOption('instagram-reels');
  await snap('08-social-guide');
  await dragSelection();
  assert.equal(await page.locator('.guide-overlay').count(), 1);
  mark('E: 4SNS切替・クリック非遮断・表示中ドラッグ・全PNGのガイドOFFとのバイト一致');

  const actions = ['templateLoad', 'templateSave', 'exportSelected', 'exportProject', 'exportAll'];
  for (const action of actions) {
    const a = toolbar.locator('[data-editor-action="' + action + '"]'), b = page.locator('.export-button-stack [data-editor-action="' + action + '"]');
    const label = await a.getAttribute('aria-label'); assert.equal(await b.getAttribute('aria-label'), label);
    assert.equal(await b.innerText(), label);
    assert.equal(await a.locator('svg').getAttribute('class'), await b.locator('svg').getAttribute('class'));
    for (const button of [a, b]) {
      await button.hover(); await page.getByRole('tooltip', { name: label, exact: true }).waitFor();
      await page.mouse.move(0, 0); await button.focus();
      await page.getByRole('tooltip', { name: label, exact: true }).waitFor();
      await button.press('Tab'); await page.mouse.move(0, 0);
    }
  }
  await snap('09-unified-export-ui'); mark('G: 5操作の共有アイコン・名称・aria・日本語hover/focus tooltip');
  await tab('背景');
  await page.getByLabel('背景プリセット名').fill('復元確認SVG');
  await page.getByRole('button', { name: '背景プリセットを保存', exact: true }).click();
  await page.getByLabel('保存済み背景プリセット').locator('option').filter({ hasText: '復元確認SVG' }).waitFor({ state: 'attached' });
  await tab('レイヤー'); await snap('10-layers');
  await pause(1800);
  const saved = await readSaved(); assert.equal(saved.objects.length, 2);
  await writeFile(path.join(output, 'saved-project.json'), JSON.stringify(saved));
  assert.equal(saved.objects.filter((o) => o.background.type === 'uploadedImage').length, 2);
  assert.ok(saved.objects.some((o) => o.partialStyles.length > 0 && o.fill.type === 'linear-gradient'));
  const beforeRestore = await download('exportProject', 'before-restore.png');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '前回の作業を復元しますか' }).waitFor();
  await page.getByRole('button', { name: '復元する', exact: true }).click();
  await pause(700);
  const restoredPng = await download('exportProject', 'after-restore.png');
  const restoreDiff = await comparePngPixels(restoredPng, beforeRestore);
  // Browser session boundaries can change edge antialiasing by 1–2/255.
  assert.ok(restoreDiff.dimensionsMatch && restoreDiff.max <= 2 && restoreDiff.changed < 1000, JSON.stringify(restoreDiff));
  await pause(1600); const restored = await readSaved();
  assert.deepEqual(restored.objects, saved.objects); assert.deepEqual(restored.canvas, saved.canvas);
  await tab('背景');
  assert.equal(await page.getByLabel('保存済み背景プリセット').locator('option').filter({ hasText: '復元確認SVG' }).count(), 1);
  await snap('11-restored'); mark('A/F: IndexedDB復元・背景プリセット再起動保持・保存値完全一致・PNG画素比較', JSON.stringify(restoreDiff));

  await tab('テキスト');
  const old = structuredClone(legacy); old.background.type = 'rough-band'; old.partialStyles = [];
  await loadTemplate(old); assert.equal((await template('legacy-loaded')).background.type, 'rough-band');
  assert.ok((await png(await download('exportSelected', 'legacy-loaded.png'))).alphaMass > 0);
  mark('A: Phase1のrough-band/schemaVersion1テンプレート読込互換');
  await page.getByLabel('選択中のテキスト内容').fill('😀赤\n青文字');
  await page.getByLabel('選択中のテキスト内容').blur();
  await number('グループの回転', 0);
  await selectRange(2, 3); await color('範囲の文字色', '#D20A11'); await apply();
  await selectRange(4, 5); await color('範囲の文字色', '#102BD5'); await apply();
  const unicode = await template('unicode-ranges');
  assert.deepEqual(unicode.partialStyles.map((r) => [r.start, r.end]), [[2, 3], [4, 5]]);
  const unicodeStats = await png(await download('exportSelected', 'unicode-ranges.png'));
  assert.ok(unicodeStats.red > 300 && unicodeStats.blue > 300);
  await toolbar.getByRole('button', { name: '元に戻す', exact: true }).click();
  assert.equal((await template('range-undo')).partialStyles.length, 1);
  await toolbar.getByRole('button', { name: 'やり直す', exact: true }).click();
  assert.equal((await template('range-redo')).partialStyles.length, 2);
  const textField = page.getByLabel('選択中のテキスト内容'); await textField.focus(); await textField.press('Control+Home'); await textField.pressSequentially('前'); await textField.blur();
  assert.deepEqual((await template('range-insert')).partialStyles.map((r) => [r.start, r.end]), [[3, 4], [5, 6]]);
  await selectRange(3, 4); await page.getByRole('button', { name: '選択範囲を解除', exact: true }).click();
  assert.deepEqual((await template('range-cleared')).partialStyles.map((r) => [r.start, r.end]), [[5, 6]]);
  mark('B: 絵文字UTF-16・改行範囲・部分適用Undo/Redo・前方挿入追従・選択解除');
  const migrationContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const migrationPage = await migrationContext.newPage();
  await migrationPage.route('**/phase2-migration-fixture', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated legacy database fixture</title>' }));
  await migrationPage.goto(new URL('/phase2-migration-fixture', appUrl).href);
  const oldProject = structuredClone(saved); delete oldProject.canvas.socialGuide;
  for (const object of oldProject.objects) { object.background.type = 'rough-band'; delete object.background.image; object.partialStyles = []; object.fill = { type: 'solid', color: '#000000' }; }
  await migrationPage.evaluate((project) => new Promise((resolve, reject) => {
    const request = indexedDB.open('text-graphic-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(project, 'autosave'); tx.oncomplete = () => { db.close(); resolve(true); }; };
  }), oldProject);
  await migrationPage.goto(appUrl, { waitUntil: 'networkidle' });
  await migrationPage.getByRole('heading', { name: '前回の作業を復元しますか' }).waitFor();
  await migrationPage.getByRole('button', { name: '復元する', exact: true }).click();
  await migrationPage.waitForTimeout(1200);
  assert.equal(await migrationPage.locator('.editor-shell').getAttribute('data-object-count'), '2');
  const migrationState = await migrationPage.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open('text-graphic-studio'); request.onsuccess = () => { const db = request.result; resolve({ version: db.version, stores: Array.from(db.objectStoreNames) }); db.close(); };
  }));
  assert.equal(migrationState.version, 2); assert.ok(migrationState.stores.includes('projects') && migrationState.stores.includes('background-presets'));
  await migrationPage.screenshot({ path: path.join(output, '12-legacy-db-migration.png'), fullPage: true }); screenshots.push('12-legacy-db-migration.png');
  await migrationContext.close(); mark('A: IndexedDB v1実データからv2へ移行・旧作業を確認ダイアログから復元');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ appUrl, browser: await browser.version(), viewport: '1600x1000', results, screenshots, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output }));
} catch (error) {
  await snap('failure').catch(() => {});
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ results, error: String(error.stack ?? error), errors, body: await page.locator('body').innerText().catch(() => '') }, null, 2));
  throw error;
} finally { await browser.close(); }
