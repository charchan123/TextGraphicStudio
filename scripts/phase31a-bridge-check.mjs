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
    assets: [{
      assetId: 'render-1',
      kind: 'background-render',
      mimeType: 'image/png',
      encoding: 'base64',
      width: 1,
      height: 1,
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8WQAAAABJRU5ErkJggg==',
    }],
    objects: [{
      type: 'text',
      objectId: 'text-1',
      name: 'テキスト1',
      text: '日本語\n改行',
      fontSizePx: 100,
      center: { x: 540, y: 960 },
      zIndex: 2,
      metadata: {
        background: {
          renderedAssetId: 'render-1',
          renderBounds: { left: 20, top: 30, right: 21, bottom: 31, width: 1, height: 1 },
        },
      },
      warnings: [{ message: '部分文字スタイルは未対応です。' }],
    }],
  };
  assert.equal(helper.validateBridge(bridge).ok, true);
  assert.equal(helper.validateBridge({ ...bridge, version: 1, assets: undefined }).ok, true);
  assert.equal(helper.validateBridge({ ...bridge, version: 99 }).ok, false);
  assert.equal(helper.validateAsset(bridge.assets[0]).ok, true);
  assert.equal(helper.validateAsset({ ...bridge.assets[0], data: 'bad' }).ok, false);
  assert.equal(helper.base64ToBytes(bridge.assets[0].data)[0], 137);
  assert.equal(helper.getAsset(bridge, 'render-1').assetId, 'render-1');
  assert.equal(helper.getAsset(bridge, 'missing'), null);
  assert.equal(helper.resolveRenderedBackground(bridge, bridge.objects[0]).asset.assetId, 'render-1');
  assert.equal(
    helper.resolveRenderedBackground(
      { ...bridge, assets: [] },
      bridge.objects[0],
    ).error.includes('見つかりません'),
    true,
  );
  assert.equal(helper.countBackgrounds(bridge), 1);
  const plan = helper.buildImportPlan(bridge);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].smartObject, true);
  assert.equal(plan[0].names.text, 'TGS_TEXT_text-1');
  assert.equal(plan[0].names.background, 'TGS_BG_text-1');
  assert.equal(plan[0].names.objectGroup, 'TGS_OBJ_text-1');
  assert.equal(plan[0].names.smartObject, 'TGS_テキスト1');
  const descriptors = helper.buildConvertToSmartObjectDescriptors(123);
  assert.equal(descriptors[0]._target[0]._id, 123);
  assert.equal(descriptors[1]._obj, 'newPlacedLayer');
  const openDescriptors = helper.buildOpenSmartObjectContentsDescriptors(45, 123);
  assert.equal(openDescriptors[0]._target[0]._id, 123);
  assert.equal(openDescriptors[0].documentID, 45);
  assert.equal(openDescriptors[1]._obj, 'placedLayerEditContents');
  assert.equal(openDescriptors[1].documentID, 45);
  assert.equal(openDescriptors[1].layerID, 123);
  assert.deepEqual(
    { ...helper.calculateSmartObjectSafetyCanvas(630, 174, 1080, 1920) },
    { width: 1080, height: 374 },
  );
  assert.deepEqual(
    { ...helper.calculateSmartObjectSafetyCanvas(100, 50, 1080, 1920) },
    { width: 580, height: 250 },
  );
  assert.deepEqual(
    { ...helper.calculateSmartObjectSafetyCanvas(1200, 2000, 1080, 1920) },
    { width: 1200, height: 2000 },
  );
  const placement = helper.calculateTopLeftDelta(
    { left: 0, top: 0, right: 400, bottom: 100 },
    { left: 340, top: 908, right: 740, bottom: 1008 },
  );
  assert.equal(placement.ok, true);
  assert.equal(placement.needsScale, false);
  assert.equal(placement.dx, 340);
  assert.equal(placement.dy, 908);
  assert.equal(
    helper.validatePlacement(
      { left: 341, top: 907, right: 741, bottom: 1007 },
      { left: 340, top: 908, right: 740, bottom: 1008 },
    ).ok,
    true,
  );
  const textOnlyPlan = helper.buildImportPlan({
    ...bridge,
    objects: [{ ...bridge.objects[0], metadata: { background: {} } }],
  });
  assert.equal(textOnlyPlan[0].smartObject, true);
  assert.equal(textOnlyPlan[0].background.asset, null);
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
  assert.match(pluginSource, /getTemporaryFolder/);
  assert.match(pluginSource, /createFile/);
  assert.match(pluginSource, /storage\.formats\.binary/);
  assert.match(pluginSource, /app\.open/);
  assert.match(pluginSource, /sourceLayer\.duplicate\(targetDocument\)/);
  assert.doesNotMatch(pluginSource, /tempDocument\.duplicateLayers/);
  assert.doesNotMatch(pluginSource, /app\.activeDocument\.duplicateLayers/);
  assert.match(pluginSource, /layerBelongsToDocument\(sourceLayer, tempDocument\)/);
  assert.match(pluginSource, /layerBelongsToDocument\(layer, targetDocument\)/);
  assert.match(pluginSource, /close\(constants\.SaveOptions\.DONOTSAVECHANGES\)/);
  assert.match(pluginSource, /closeWithoutSaving/);
  assert.equal(
    pluginSource.indexOf('layer = await sourceLayer.duplicate(targetDocument)')
      < pluginSource.indexOf('await closeTemporaryDocument('),
    true,
  );
  assert.equal(
    pluginSource.indexOf('await closeTemporaryDocument(')
      < pluginSource.indexOf('let placement = bridgeLogic.calculateTopLeftDelta'),
    true,
  );
  assert.match(pluginSource, /finally\s*{[\s\S]*if \(tempDocument\)[\s\S]*closeTemporaryDocument/);
  assert.match(pluginSource, /closeTemporaryDocument[\s\S]*activateTargetDocument\(targetDocument\)/);
  assert.match(pluginSource, /action\.batchPlay/);
  assert.match(helperSource, /newPlacedLayer/);
  assert.match(helperSource, /placedLayerEditContents/);
  assert.match(pluginSource, /buildConvertToSmartObjectDescriptors/);
  assert.match(pluginSource, /buildOpenSmartObjectContentsDescriptors/);
  assert.match(pluginSource, /const contentDocument = app\.activeDocument/);
  assert.match(pluginSource, /contentDocument\.resizeCanvas\(after\.width, after\.height\)/);
  assert.doesNotMatch(pluginSource, /contentDocument\.resizeImage/);
  assert.match(pluginSource, /await contentDocument\.save\(\)/);
  assert.match(pluginSource, /contentDocument\.close\(constants\.SaveOptions\.SAVECHANGES\)/);
  assert.match(pluginSource, /finally\s*{[\s\S]*activateTargetDocument\(targetDocument\)/);
  assert.match(pluginSource, /Smart Object編集余白の確保に失敗しました/);
  assert.match(pluginSource, /Smart Objectは保持しました/);
  assert.match(pluginSource, /app\.activeDocument\s*=\s*targetDocument/);
  assert.match(pluginSource, /fromLayers:\s*groupLayers/);
  assert.match(pluginSource, /LayerKind\.TEXT/);
  assert.match(pluginSource, /LayerKind\.SMARTOBJECT/);
  assert.match(pluginSource, /validateObjectGroup/);
  assert.equal(
    pluginSource.indexOf('const textLayer = await createNativeTextLayer') < pluginSource.indexOf('const importedBackground = await importBackgroundLayer'),
    true,
  );
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

  console.log('Phase 3.1B Photoshop plugin pure checks passed.');
} finally {
  await rm(work, { recursive: true, force: true });
}
