import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

const work = await mkdtemp(join(tmpdir(), 'tgs-phase31a-'));
const output = join(work, 'check.mjs');

try {
  await build({
    absWorkingDir: process.cwd(),
    entryPoints: ['scripts/phase31a-bridge-entry.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: output,
    logLevel: 'silent',
  });
  await import(pathToFileURL(output).href + '?run=' + Date.now());

  const helperSource = await readFile('photoshop-uxp/lib/bridge.js', 'utf8');
  const helperModule = { exports: {} };
  vm.runInNewContext(helperSource, { module: helperModule, exports: helperModule.exports });
  const helper = helperModule.exports;
  const bridge = {
    format: helper.BRIDGE_FORMAT,
    version: helper.BRIDGE_VERSION,
    canvasWidth: 1080,
    canvasHeight: 1920,
    objects: [{
      type: 'text',
      objectId: 'text-1',
      name: 'テキスト1',
      text: '日本語\n改行',
      fontSizePx: 100,
      center: { x: 540, y: 960 },
      zIndex: 2,
      warnings: [{ message: '部分文字スタイルは未対応です。' }],
    }],
  };
  assert.equal(helper.validateBridge(bridge).ok, true);
  assert.equal(helper.validateBridge({ ...bridge, version: 99 }).ok, false);
  assert.equal(helper.validateCanvasSize(bridge, { width: 1080, height: 1920 }).matches, true);
  assert.equal(helper.validateCanvasSize(bridge, { width: 1920, height: 1080 }).matches, false);
  const fonts = [
    { postScriptName: 'ArialMT', family: 'Arial', style: 'Regular' },
    { postScriptName: 'HiraKakuProN-W8', family: 'Hiragino Kaku Gothic ProN', style: 'W8' },
  ];
  assert.equal(helper.chooseFont(fonts, { postScriptName: 'HiraKakuProN-W8' }).match, 'postScriptName');
  assert.equal(helper.chooseFont(fonts, { family: 'Arial', style: 'Regular' }).match, 'family-style');
  assert.equal(helper.chooseFont(fonts, { family: 'Missing', style: 'Regular' }).match, 'missing');
  assert.equal(helper.pixelsToPhotoshopTextUnits(100, 72), 100);
  assert.equal(helper.pixelsToPhotoshopTextUnits(100, 300), 24);
  assert.deepEqual(
    { ...helper.calculateCenterDelta({ left: 10, right: 110, top: 20, bottom: 80 }, { x: 80, y: 70 }) },
    { x: 20, y: 20 },
  );
  assert.equal(
    JSON.stringify(helper.getImportOrder([{ zIndex: 8 }, { zIndex: 1 }, { zIndex: 4 }]).map((value) => value.zIndex)),
    JSON.stringify([1, 4, 8]),
  );
  assert.deepEqual({ ...helper.hexToRgb('#123ABC') }, { red: 18, green: 58, blue: 188 });
  assert.equal(helper.getFallbackFillColor({ type: 'linear-gradient', fallbackColor: '#FF0000' }), '#FF0000');
  assert.equal(helper.summarizeWarnings(bridge.objects, ['Font missing']).length, 2);

  const manifest = JSON.parse(await readFile('photoshop-uxp/manifest.json', 'utf8'));
  assert.equal(manifest.manifestVersion, 5);
  assert.equal(manifest.host.app, 'PS');
  assert.equal(manifest.host.minVersion, '24.2.0');
  assert.equal(manifest.requiredPermissions.localFileSystem, 'request');
  assert.equal(manifest.entrypoints[0].id, 'tgsBridgePanel');

  const pluginSource = await readFile('photoshop-uxp/index.js', 'utf8');
  new Function(pluginSource);
  assert.match(pluginSource, /getFileForOpening/);
  assert.match(pluginSource, /core\.executeAsModal/);
  assert.match(pluginSource, /createTextLayer/);
  assert.match(pluginSource, /createLayerGroup/);
  assert.match(pluginSource, /boundsNoEffects/);
  assert.match(pluginSource, /layer\.translate/);
  assert.match(pluginSource, /layer\.rotate/);
  assert.match(pluginSource, /ElementPlacement\.PLACEINSIDE/);
  assert.match(pluginSource, /textContent/);
  assert.doesNotMatch(pluginSource, /innerHTML/);

  const pluginStyles = await readFile('photoshop-uxp/styles.css', 'utf8');
  assert.doesNotMatch(pluginStyles, /display\s*:\s*grid/i);
  assert.doesNotMatch(pluginStyles, /grid-template|grid-column|grid-row/i);
  assert.doesNotMatch(pluginStyles, /\bgap\s*:/i);
  assert.match(pluginStyles, /\.panel\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/);
  assert.match(pluginStyles, /html,\s*\nbody\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/);
  assert.match(pluginStyles, /\.preview div\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*row;/);

  console.log('Phase 3.1A Photoshop plugin pure checks passed (34 checks).');
} finally {
  await rm(work, { recursive: true, force: true });
}
