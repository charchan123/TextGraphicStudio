'use strict';

const BRIDGE_FORMAT = 'text-graphic-studio-photoshop-bridge';
const BRIDGE_VERSION = 2;
const LEGACY_BRIDGE_VERSION = 1;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const SMART_OBJECT_SAFETY_CANVAS = Object.freeze({
  widthPadding: 480,
  widthScale: 1.8,
  heightPadding: 200,
  heightScale: 1.5,
});

function validateBridge(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['JSON root must be an object.'] };
  }
  if (value.format !== BRIDGE_FORMAT) errors.push('Unsupported Bridge format.');
  if (value.version !== LEGACY_BRIDGE_VERSION && value.version !== BRIDGE_VERSION) {
    errors.push('Unsupported Bridge version.');
  }
  if (!Number.isFinite(value.canvasWidth) || value.canvasWidth <= 0) errors.push('canvasWidth is invalid.');
  if (!Number.isFinite(value.canvasHeight) || value.canvasHeight <= 0) errors.push('canvasHeight is invalid.');
  if (!Array.isArray(value.objects)) {
    errors.push('objects must be an array.');
  } else {
    value.objects.forEach((object, index) => {
      if (!object || object.type !== 'text') errors.push(`objects[${index}].type must be text.`);
      if (typeof object?.objectId !== 'string') errors.push(`objects[${index}].objectId is invalid.`);
      if (typeof object?.text !== 'string') errors.push(`objects[${index}].text is invalid.`);
      if (!Number.isFinite(object?.fontSizePx) || object.fontSizePx <= 0) errors.push(`objects[${index}].fontSizePx is invalid.`);
      if (!Number.isFinite(object?.center?.x) || !Number.isFinite(object?.center?.y)) errors.push(`objects[${index}].center is invalid.`);
    });
  }
  if (value.version === BRIDGE_VERSION && !Array.isArray(value.assets)) {
    errors.push('Bridge v2 assets must be an array.');
  }
  return { ok: errors.length === 0, errors };
}

function isValidBase64(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function base64ToBytes(value) {
  if (!isValidBase64(value)) throw new Error('PNG assetのbase64が不正です。');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64_ALPHABET.indexOf(value[index]);
    const b = BASE64_ALPHABET.indexOf(value[index + 1]);
    const c = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2]);
    const d = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3]);
    const bits = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < output.length) output[outputIndex++] = (bits >> 16) & 255;
    if (outputIndex < output.length) output[outputIndex++] = (bits >> 8) & 255;
    if (outputIndex < output.length) output[outputIndex++] = bits & 255;
  }
  return output;
}

function validateAsset(asset) {
  if (!asset || typeof asset !== 'object') return { ok: false, error: 'assetがObjectではありません。' };
  if (typeof asset.assetId !== 'string' || !asset.assetId) return { ok: false, error: 'assetIdが不正です。' };
  if (asset.kind !== 'background-render' && asset.kind !== 'background-source-raster') {
    return { ok: false, error: `${asset.assetId}: kindが不正です。` };
  }
  if (asset.mimeType !== 'image/png' || asset.encoding !== 'base64') {
    return { ok: false, error: `${asset.assetId}: PNG/base64 assetではありません。` };
  }
  if (!Number.isFinite(asset.width) || asset.width <= 0 || !Number.isFinite(asset.height) || asset.height <= 0) {
    return { ok: false, error: `${asset.assetId}: sizeが不正です。` };
  }
  if (!isValidBase64(asset.data)) return { ok: false, error: `${asset.assetId}: base64が不正です。` };
  const bytes = base64ToBytes(asset.data);
  const png = bytes.length >= 8
    && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  return png ? { ok: true, bytes } : { ok: false, error: `${asset.assetId}: PNG signatureが不正です。` };
}

function getAsset(bridge, assetId) {
  if (!assetId) return null;
  return (bridge.assets ?? []).find((asset) => asset.assetId === assetId) ?? null;
}

function resolveRenderedBackground(bridge, object) {
  const reference = object.metadata?.background?.renderedAssetId;
  if (!reference) return { asset: null, error: null };
  const asset = getAsset(bridge, reference);
  if (!asset) return { asset: null, error: `${object.name || object.objectId}: 背景asset ${reference} が見つかりません。` };
  const validation = validateAsset(asset);
  if (!validation.ok) return { asset: null, error: `${object.name || object.objectId}: ${validation.error}` };
  if (asset.kind !== 'background-render') {
    return { asset: null, error: `${object.name || object.objectId}: 背景参照先がrender assetではありません。` };
  }
  return { asset, bytes: validation.bytes, error: null };
}

function countBackgrounds(bridge) {
  return (bridge.objects ?? []).filter((object) => Boolean(object.metadata?.background?.renderedAssetId)).length;
}

function shortObjectId(value) {
  const normalizedId = String(value ?? '').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 12);
  return normalizedId || 'text';
}

function getLayerNames(object, index) {
  const shortId = shortObjectId(object.objectId);
  const displayName = String(object.name || `テキスト${index + 1}`).replace(/[\r\n]+/g, ' ').trim();
  return {
    text: `TGS_TEXT_${shortId}`,
    background: `TGS_BG_${shortId}`,
    objectGroup: `TGS_OBJ_${shortId}`,
    smartObject: `TGS_${displayName || `テキスト${index + 1}`}`,
  };
}

function buildImportPlan(bridge) {
  return getImportOrder(bridge.objects).map((object, index) => ({
    object,
    names: getLayerNames(object, index),
    background: bridge.version === BRIDGE_VERSION ? resolveRenderedBackground(bridge, object) : { asset: null, error: null },
    smartObject: bridge.version === BRIDGE_VERSION,
  }));
}

function buildConvertToSmartObjectDescriptors(layerId) {
  return [
    {
      _obj: 'select',
      _target: [{ _ref: 'layer', _id: layerId }],
      makeVisible: false,
      _options: { dialogOptions: 'dontDisplay' },
    },
    {
      _obj: 'newPlacedLayer',
      _options: { dialogOptions: 'dontDisplay' },
    },
  ];
}

function buildOpenSmartObjectContentsDescriptors(documentId, layerId) {
  return [
    {
      _obj: 'select',
      _target: [{ _ref: 'layer', _id: layerId }],
      documentID: documentId,
      makeVisible: false,
      _options: { dialogOptions: 'dontDisplay' },
    },
    {
      _obj: 'placedLayerEditContents',
      documentID: documentId,
      layerID: layerId,
      _options: { dialogOptions: 'dontDisplay' },
    },
  ];
}

function calculateSmartObjectSafetyCanvas(currentWidth, currentHeight, canvasWidth, canvasHeight) {
  const values = [currentWidth, currentHeight, canvasWidth, canvasHeight];
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Smart Object Canvas sizeが不正です。');
  }
  const desiredWidth = Math.max(
    currentWidth + SMART_OBJECT_SAFETY_CANVAS.widthPadding,
    currentWidth * SMART_OBJECT_SAFETY_CANVAS.widthScale,
  );
  const desiredHeight = Math.max(
    currentHeight + SMART_OBJECT_SAFETY_CANVAS.heightPadding,
    currentHeight * SMART_OBJECT_SAFETY_CANVAS.heightScale,
  );
  return {
    width: Math.ceil(Math.max(currentWidth, Math.min(canvasWidth, desiredWidth))),
    height: Math.ceil(Math.max(currentHeight, Math.min(canvasHeight, desiredHeight))),
  };
}

function unitNumber(value) {
  if (Number.isFinite(value)) return value;
  if (value && Number.isFinite(value.value)) return value.value;
  if (value && Number.isFinite(value._value)) return value._value;
  return NaN;
}

function validateCanvasSize(bridge, documentModel) {
  const actualWidth = unitNumber(documentModel?.width);
  const actualHeight = unitNumber(documentModel?.height);
  const matches = Math.abs(actualWidth - bridge.canvasWidth) < 0.01
    && Math.abs(actualHeight - bridge.canvasHeight) < 0.01;
  return { matches, actualWidth, actualHeight };
}

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function chooseFont(fonts, requested) {
  const list = Array.from(fonts ?? []);
  const requestedPostScript = normalized(requested?.postScriptName);
  if (requestedPostScript) {
    const exact = list.find((font) => normalized(font.postScriptName) === requestedPostScript);
    if (exact) return { font: exact, match: 'postScriptName' };
  }
  const family = normalized(requested?.family);
  const style = normalized(requested?.style);
  const familyStyle = list.find((font) => normalized(font.family) === family && normalized(font.style) === style);
  if (familyStyle) return { font: familyStyle, match: 'family-style' };
  return { font: null, match: 'missing' };
}

function pixelsToPhotoshopTextUnits(px, resolution) {
  const safeResolution = Number.isFinite(resolution) && resolution > 0 ? resolution : 72;
  return (px * 72) / safeResolution;
}

function calculateCenterDelta(bounds, targetCenter) {
  const centerX = (unitNumber(bounds.left) + unitNumber(bounds.right)) / 2;
  const centerY = (unitNumber(bounds.top) + unitNumber(bounds.bottom)) / 2;
  return { x: targetCenter.x - centerX, y: targetCenter.y - centerY };
}

function boundsToNumbers(bounds) {
  const result = {
    left: unitNumber(bounds?.left),
    top: unitNumber(bounds?.top),
    right: unitNumber(bounds?.right),
    bottom: unitNumber(bounds?.bottom),
  };
  result.width = result.right - result.left;
  result.height = result.bottom - result.top;
  return result;
}

function calculateTopLeftDelta(currentBounds, targetBounds) {
  const current = boundsToNumbers(currentBounds);
  const target = boundsToNumbers(targetBounds);
  if (![current.left, current.top, current.width, current.height, target.left, target.top, target.width, target.height].every(Number.isFinite)) {
    return { ok: false, error: 'Layer boundsを数値へ変換できません。' };
  }
  return {
    ok: true,
    current,
    target,
    needsScale: Math.abs(current.width - target.width) > 0.01 || Math.abs(current.height - target.height) > 0.01,
    scaleX: current.width > 0 ? (target.width / current.width) * 100 : NaN,
    scaleY: current.height > 0 ? (target.height / current.height) * 100 : NaN,
    dx: target.left - current.left,
    dy: target.top - current.top,
  };
}

function validatePlacement(actualBounds, targetBounds, tolerance = 3) {
  const actual = boundsToNumbers(actualBounds);
  const target = boundsToNumbers(targetBounds);
  const deltaLeft = actual.left - target.left;
  const deltaTop = actual.top - target.top;
  const ok = Number.isFinite(deltaLeft) && Number.isFinite(deltaTop)
    && Math.abs(deltaLeft) <= tolerance && Math.abs(deltaTop) <= tolerance;
  return { ok, actual, target, deltaLeft, deltaTop };
}

function getImportOrder(objects) {
  return [...objects].sort((left, right) => left.zIndex - right.zIndex);
}

function hexToRgb(hex) {
  const value = String(hex ?? '').replace('#', '').trim();
  const normalizedHex = value.length === 3 ? value.split('').map((part) => part + part).join('') : value.padStart(6, '0').slice(0, 6);
  return {
    red: parseInt(normalizedHex.slice(0, 2), 16),
    green: parseInt(normalizedHex.slice(2, 4), 16),
    blue: parseInt(normalizedHex.slice(4, 6), 16),
  };
}

function getFallbackFillColor(fill) {
  return fill?.type === 'solid' ? fill.color : fill?.fallbackColor ?? '#000000';
}

function summarizeWarnings(objects, runtimeWarnings) {
  const warnings = [];
  objects.forEach((object) => {
    (object.warnings ?? []).forEach((warning) => warnings.push(`${object.name || object.objectId}: ${warning.message}`));
  });
  return warnings.concat(runtimeWarnings ?? []);
}

module.exports = {
  BRIDGE_FORMAT,
  BRIDGE_VERSION,
  LEGACY_BRIDGE_VERSION,
  validateBridge,
  validateAsset,
  validateCanvasSize,
  isValidBase64,
  base64ToBytes,
  getAsset,
  resolveRenderedBackground,
  countBackgrounds,
  shortObjectId,
  getLayerNames,
  buildImportPlan,
  buildConvertToSmartObjectDescriptors,
  buildOpenSmartObjectContentsDescriptors,
  calculateSmartObjectSafetyCanvas,
  chooseFont,
  pixelsToPhotoshopTextUnits,
  calculateCenterDelta,
  boundsToNumbers,
  calculateTopLeftDelta,
  validatePlacement,
  getImportOrder,
  hexToRgb,
  getFallbackFillColor,
  summarizeWarnings,
  unitNumber,
};
