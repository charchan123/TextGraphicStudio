import assert from 'node:assert/strict';

import {
  buildPhotoshopBridgeFrame,
  buildPhotoshopBridgeFrameV1,
  calculatePhotoshopBridgeVisualBounds,
  letterSpacingPxToPhotoshopTracking,
  serializePhotoshopBridge,
  validatePhotoshopBridge,
} from '@/src/services/photoshopBridge';
import { createStudioProject } from '@/src/services/studioProject';
import { calculatePhotoshopBridgeCropBounds } from '@/src/services/photoshopBridgeBackground';
import { createGraphicText } from '@/src/store/defaults';

const exportedAt = '2026-09-27T00:00:00.000Z';
const project = createStudioProject(undefined, [{
  id: 'hiragino-w8',
  family: 'Hiragino Kaku Gothic ProN',
  fullName: 'Hiragino Kaku Gothic ProN W8',
  postscriptName: 'HiraKakuProN-W8',
  style: 'W8',
  weight: 800,
  source: 'local-access',
}], 'Bridge確認');
const frame = project.frames[0];
const first = frame.document.objects[0];
first.id = 'text-a';
first.name = '見出し';
first.text = '驚異の記録\n年間288試合！';
first.textLineIds = ['line-a', 'line-b'];
first.position = { x: 320, y: 480 };
first.size = { width: 240, height: 120 };
first.transform = { scaleX: 1.25, scaleY: 0.8, rotation: 30 };
first.typography = {
  ...first.typography,
  fontFamily: 'Hiragino Kaku Gothic ProN',
  fontRefId: 'hiragino-w8',
  fontSize: 80,
  fontWeight: 900,
  letterSpacing: 8,
  lineHeight: 1.4,
  glyphScaleX: 1.1,
  glyphScaleY: 0.9,
};
first.fill = { type: 'solid', color: '#123ABC' };
first.partialStyles = [{ start: 0, end: 1, fill: { type: 'solid', color: '#FF0000' }, glyphOffsetX: 12 }];
first.lineGapOffsets = [6];
first.background = {
  ...first.background,
  enabled: true,
  type: 'uploadedImage',
  imageMode: 'followLines',
  horizontalSlice: { enabled: true, leftRatio: 0.2, rightRatio: 0.15 },
  lineEdgeAdjustments: {
    'line-b': { leftInsetPx: 30, rightInsetPx: -20 },
  },
  image: {
    id: 'background-image',
    fileName: 'band.svg',
    sourceMimeType: 'image/svg+xml',
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8WQAAAABJRU5ErkJggg==',
    width: 900,
    height: 200,
    sourceSvg: {
      markup: '<svg>SHOULD_NOT_BE_EXPORTED</svg>',
      width: 900,
      height: 200,
      crop: { x: 2, y: 3, width: 896, height: 194 },
    },
  },
};

const second = createGraphicText('二つ目', 1, frame.document.canvas.width, frame.document.canvas.height);
second.id = 'text-b';
second.name = 'サブ';
second.zIndex = first.zIndex - 1;
second.fill = {
  type: 'linear-gradient',
  angle: 45,
  stops: [
    { offset: 0, color: '#FF0000' },
    { offset: 1, color: '#0000FF' },
  ],
};
second.background = structuredClone(first.background);
const third = createGraphicText('背景なし', 2, frame.document.canvas.width, frame.document.canvas.height);
third.id = 'text-c';
third.name = '背景なし';
third.zIndex = first.zIndex + 1;
third.background = { ...third.background, enabled: false };
frame.document.objects.push(second, third);

const renderPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8WQAAAABJRU5ErkJggg==';
const bridge = await buildPhotoshopBridgeFrame(project, exportedAt, async (object) => (
  object.background.enabled
    ? {
      dataUrl: renderPng,
      width: 180,
      height: 64,
      renderBounds: { left: 230, top: 448, right: 410, bottom: 512, width: 180, height: 64 },
    }
    : null
));
assert.equal(bridge.format, 'text-graphic-studio-photoshop-bridge');
assert.equal(bridge.version, 2);
assert.equal(bridge.exportedAt, exportedAt);
assert.equal(bridge.canvasWidth, frame.document.canvas.width);
assert.equal(bridge.canvasHeight, frame.document.canvas.height);
assert.equal(bridge.objects.length, 3);
assert.deepEqual(bridge.objects.map((object) => object.objectId), ['text-b', 'text-a', 'text-c']);

const exported = bridge.objects.find((object) => object.objectId === 'text-a');
assert.ok(exported);
assert.equal(exported.text, '驚異の記録\n年間288試合！');
assert.equal(exported.font.postScriptName, 'HiraKakuProN-W8');
assert.equal(exported.font.family, 'Hiragino Kaku Gothic ProN');
assert.equal(exported.font.style, 'W8');
assert.equal(exported.fontSizePx, 80);
assert.deepEqual(exported.fill, { type: 'solid', color: '#123ABC', alpha: 1 });
assert.equal(exported.letterSpacingPx, 8);
assert.equal(exported.tracking, 100);
assert.equal(exported.lineHeightPx, 112);
assert.equal(exported.horizontalScale, 137.5);
assert.equal(exported.verticalScale, 72);
assert.equal(exported.rotationDeg, 30);
assert.deepEqual(exported.center, { x: 320, y: 480 });
assert.equal(exported.visualBounds.width > 300, true);
assert.equal(exported.visualBounds.height > 200, true);
assert.deepEqual(exported.metadata.background.textLineIds, ['line-a', 'line-b']);
assert.deepEqual(exported.metadata.background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.deepEqual(exported.metadata.background.lineEdgeAdjustments?.['line-b'], { leftInsetPx: 30, rightInsetPx: -20 });
assert.equal(exported.metadata.background.image?.fileName, 'band.svg');
assert.equal('dataUrl' in (exported.metadata.background.image ?? {}), false);
assert.equal('markup' in (exported.metadata.background.image?.sourceSvg ?? {}), false);
assert.equal(exported.metadata.background.renderedAssetId, 'bg-render-text-a');
assert.equal(exported.metadata.background.sourceRasterAssetId, 'bg-source-1');
assert.deepEqual(exported.metadata.background.renderBounds, {
  left: 230, top: 448, right: 410, bottom: 512, width: 180, height: 64,
});
assert.equal(bridge.assets.filter((asset) => asset.kind === 'background-render').length, 2);
assert.equal(bridge.assets.filter((asset) => asset.kind === 'background-source-raster').length, 1);
assert.equal(bridge.assets.every((asset) => asset.mimeType === 'image/png' && asset.encoding === 'base64'), true);
assert.equal(
  bridge.objects.find((object) => object.objectId === 'text-b')?.metadata.background.sourceRasterAssetId,
  'bg-source-1',
);
assert.equal(
  bridge.objects.find((object) => object.objectId === 'text-c')?.metadata.background.renderedAssetId,
  undefined,
);
assert.equal(exported.metadata.glyphOffsets[0]?.glyphOffsetX, 12);
assert.ok(exported.warnings.some((warning) => warning.code === 'partial-styles'));
assert.ok(exported.warnings.some((warning) => warning.code === 'glyph-offsets'));
assert.ok(exported.warnings.some((warning) => warning.code === 'line-gap-offsets'));
assert.equal(exported.warnings.some((warning) => warning.code === 'background'), false);
assert.ok(bridge.objects.find((object) => object.objectId === 'text-b')?.warnings.some((warning) => warning.code === 'gradient'));

const bounds = calculatePhotoshopBridgeVisualBounds({
  ...first,
  position: { x: 100, y: 200 },
  size: { width: 100, height: 40 },
  transform: { scaleX: 2, scaleY: 1, rotation: 0 },
});
assert.deepEqual(bounds, { left: 0, top: 180, right: 200, bottom: 220, width: 200, height: 40 });
assert.deepEqual(
  calculatePhotoshopBridgeCropBounds(330, 900, 10, 8, 400, 100),
  { left: 340, top: 908, right: 740, bottom: 1008, width: 400, height: 100 },
);
assert.equal(letterSpacingPxToPhotoshopTracking(3, 60), 50);
assert.equal(validatePhotoshopBridge(bridge), true);
const legacy = buildPhotoshopBridgeFrameV1(project, exportedAt);
assert.equal(legacy.version, 1);
assert.equal(validatePhotoshopBridge(legacy), true);
assert.equal(validatePhotoshopBridge({ ...bridge, version: 99 }), false);
assert.equal(validatePhotoshopBridge({ ...bridge, objects: [{ type: 'image' }] }), false);
const serialized = serializePhotoshopBridge(bridge);
assert.match(serialized, /"version": 2/);
assert.doesNotMatch(serialized, /SHOULD_NOT_BE_EXPORTED/);

console.log('Phase 3.1B TGS bridge checks passed.');
