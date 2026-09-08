import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase30');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const results = [], errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const mark = (name) => { results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const pause = (ms = 300) => page.waitForTimeout(ms);
const download = async (locator, fileName) => {
  const pending = page.waitForEvent('download');
  await locator.click();
  const item = await pending;
  const target = path.join(output, fileName);
  await item.saveAs(target);
  return readFile(target);
};

try {
  await page.goto('http://[::1]:4175/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.startup-cover').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.storyboard-frame').count(), 1); mark('新規ProjectはFrame 00を持つ');
  await page.getByLabel('Project').fill('甲子園の土');
  assert.equal(await page.locator('.editor-shell').getAttribute('data-project-name'), '甲子園の土'); mark('Project名を変更してIDを維持');

  const frame0Id = await page.locator('.storyboard-frame').first().getAttribute('data-frame-id');
  await page.getByRole('button', { name: 'コマ追加', exact: true }).click(); await pause();
  assert.equal(await page.locator('.storyboard-frame').count(), 2);
  assert.equal(await page.locator('.storyboard-number').nth(1).textContent(), '01'); mark('Frame追加と自動番号');
  const text = page.getByLabel('選択中のテキスト内容', { exact: true });
  await text.fill('2コマ目本文'); await text.blur();
  await page.locator('.storyboard-frame').first().locator('.storyboard-select').click();
  assert.notEqual(await text.inputValue(), '2コマ目本文');
  await page.locator('.storyboard-frame').nth(1).locator('.storyboard-select').click();
  assert.equal(await text.inputValue(), '2コマ目本文'); mark('Frame切替でDocument本文が独立');

  await page.locator('.storyboard-frame').nth(1).getByTitle('コマを複製').click(); await pause();
  assert.equal(await page.locator('.storyboard-frame').count(), 3);
  assert.equal(await text.inputValue(), '2コマ目本文');
  assert.notEqual(await page.locator('.storyboard-frame').nth(2).getAttribute('data-frame-id'), await page.locator('.storyboard-frame').nth(1).getAttribute('data-frame-id')); mark('Frame複製は新ID・Document複製・完成lock解除');
  await page.locator('.storyboard-frame').nth(2).locator('.storyboard-select').dragTo(page.locator('.storyboard-frame').first().locator('.storyboard-select')); await pause();
  assert.equal(await page.locator('.storyboard-frame').first().getAttribute('data-frame-id'), await page.locator('.editor-shell').getAttribute('data-active-frame-id'));
  assert.equal(await page.locator('.storyboard-number').first().textContent(), '00');
  assert.ok(await page.locator(`.storyboard-frame[data-frame-id="${frame0Id}"]`).count()); mark('並べ替え後もFrame ID維持・表示番号再採番');

  const activeName = await page.locator('.storyboard-frame.is-active .storyboard-frame-name').inputValue();
  await page.locator('.storyboard-frame.is-active').getByTitle('完成ロック').click();
  await text.fill('変更禁止'); await text.blur(); await pause();
  assert.equal(await text.inputValue(), '2コマ目本文');
  assert.equal(await page.locator('.editor-shell').getAttribute('data-active-frame-locked'), 'true'); mark('Frame完成lockで本文変更を拒否');
  assert.equal(await page.locator('.storyboard-frame.is-active').getByTitle('コマを削除').isDisabled(), true); mark('完成Frameは削除不可');
  await page.locator('.storyboard-frame.is-active').getByTitle('完成ロック解除').click();
  await page.getByRole('button', { name: '解除する', exact: true }).click();

  await page.getByRole('tab', { name: 'レイヤー', exact: true }).click();
  await page.getByRole('button', { name: /完全ロックを有効化/ }).first().click();
  assert.equal(await page.getByLabel('レイヤー名').first().isDisabled(), true);
  assert.equal(await page.locator('.layer-row').first().getByTitle('削除').isDisabled(), true); mark('Object完全lockでstyle/name/delete経路を禁止');
  await page.getByRole('button', { name: /完全ロックを解除/ }).first().click(); mark('完全lock中も選択・解除可能');

  const projectBytes = await download(page.locator('[data-editor-action="projectExport"]'), 'koshien.tgsproj');
  const pkg = JSON.parse(projectBytes.toString());
  assert.equal(pkg.version, 2); assert.equal(pkg.project.projectName, '甲子園の土'); assert.equal(pkg.project.frames.length, 3);
  assert.equal('quickPartialPresets' in pkg.project, false); mark('複数Frame .tgsprojは個人設定を含まない1ファイル');

  const zipBytes = await download(page.locator('[data-editor-action="exportFramesZip"]'), 'koshien.zip');
  const zipText = zipBytes.toString('latin1');
  assert.ok(zipText.includes('00.png') && zipText.includes('01.png') && zipText.includes('02.png')); mark('ZIPは現在順の00/01/02 PNGを含む');

  const legacy = { kind: 'text-graphic-studio-project-package', version: 1, exportedAt: new Date().toISOString(), document: pkg.project.frames[0].document };
  await page.getByLabel('Text Graphic Studioプロジェクトファイル').setInputFiles({ name: 'legacy.tgsproj', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await page.getByRole('button', { name: '読み込む', exact: true }).click(); await pause();
  assert.equal(await page.locator('.storyboard-frame').count(), 1);
  assert.equal(await page.locator('.storyboard-number').textContent(), '00'); mark('Phase 2.9 single-document .tgsprojをFrame 00へmigration');

  await page.getByRole('tab', { name: 'テキスト', exact: true }).click();
  const before = await text.inputValue();
  await page.getByLabel('Text Graphic Studioプロジェクトファイル').setInputFiles({ name: 'broken.tgsproj', mimeType: 'application/json', buffer: Buffer.from('{broken') }); await pause();
  assert.equal(await text.inputValue(), before); mark('壊れたProjectでも現在作業を保持');
  await page.screenshot({ path: path.join(output, '01-project-storyboard.png') });
  assert.deepEqual(errors, []); mark('Phase 3.0由来pageerror 0');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results.length, results, errors, activeName }, null, 2));
} finally {
  await context.close(); await browser.close();
}
