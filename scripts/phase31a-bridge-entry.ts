import assert from 'node:assert/strict';

import {
  buildPhotoshopBridgeFrame,
  calculatePhotoshopBridgeVisualBounds,
  letterSpacingPxToPhotoshopTracking,
  serializePhotoshopBridge,
  validatePhotoshopBridge,
} from '@/src/services/photoshopBridge';
import { createStudioProject } from '@/src/services/studioProject';
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
    dataUrl: 'data:image/png;base64,SHOULD_NOT_BE_EXPORTED',
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
frame.document.objects.push(second);

const bridge = buildPhotoshopBridgeFrame(project, exportedAt);
assert.equal(bridge.format, 'text-graphic-studio-photoshop-bridge');
assert.equal(bridge.version, 1);
assert.equal(bridge.exportedAt, exportedAt);
assert.equal(bridge.canvasWidth, frame.document.canvas.width);
assert.equal(bridge.canvasHeight, frame.document.canvas.height);
assert.equal(bridge.objects.length, 2);
assert.deepEqual(bridge.objects.map((object) => object.objectId), ['text-b', 'text-a']);

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
assert.equal(exported.metadata.glyphOffsets[0]?.glyphOffsetX, 12);
assert.ok(exported.warnings.some((warning) => warning.code === 'partial-styles'));
assert.ok(exported.warnings.some((warning) => warning.code === 'glyph-offsets'));
assert.ok(exported.warnings.some((warning) => warning.code === 'line-gap-offsets'));
assert.ok(exported.warnings.some((warning) => warning.code === 'background'));
assert.ok(bridge.objects.find((object) => object.objectId === 'text-b')?.warnings.some((warning) => warning.code === 'gradient'));

const bounds = calculatePhotoshopBridgeVisualBounds({
  ...first,
  position: { x: 100, y: 200 },
  size: { width: 100, height: 40 },
  transform: { scaleX: 2, scaleY: 1, rotation: 0 },
});
assert.deepEqual(bounds, { left: 0, top: 180, right: 200, bottom: 220, width: 200, height: 40 });
assert.equal(letterSpacingPxToPhotoshopTracking(3, 60), 50);
assert.equal(validatePhotoshopBridge(bridge), true);
assert.equal(validatePhotoshopBridge({ ...bridge, version: 2 }), false);
assert.equal(validatePhotoshopBridge({ ...bridge, objects: [{ type: 'image' }] }), false);
const serialized = serializePhotoshopBridge(bridge);
assert.match(serialized, /"version": 1/);
assert.doesNotMatch(serialized, /SHOULD_NOT_BE_EXPORTED/);

console.log('Phase 3.1A TGS bridge checks passed (34 checks).');
