'use strict';

const BRIDGE_FORMAT = 'text-graphic-studio-photoshop-bridge';
const BRIDGE_VERSION = 1;

function validateBridge(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['JSON root must be an object.'] };
  }
  if (value.format !== BRIDGE_FORMAT) errors.push('Unsupported Bridge format.');
  if (value.version !== BRIDGE_VERSION) errors.push('Unsupported Bridge version.');
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
  return { ok: errors.length === 0, errors };
}

function unitNumber(value) {
  if (Number.isFinite(value)) return value;
  if (value && Number.isFinite(value.value)) return value.value;
  if (value && Number.isFinite(value._value)) return value._value;
  return NaN;
}

function validateCanvasSize(bridge, document) {
  const actualWidth = unitNumber(document?.width);
  const actualHeight = unitNumber(document?.height);
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
  const familyStyle = list.find((font) => (
    normalized(font.family) === family
    && normalized(font.style) === style
  ));
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

function getImportOrder(objects) {
  return [...objects].sort((left, right) => left.zIndex - right.zIndex);
}

function hexToRgb(hex) {
  const value = String(hex ?? '').replace('#', '').trim();
  const normalizedHex = value.length === 3
    ? value.split('').map((part) => part + part).join('')
    : value.padStart(6, '0').slice(0, 6);
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
  validateBridge,
  validateCanvasSize,
  chooseFont,
  pixelsToPhotoshopTextUnits,
  calculateCenterDelta,
  getImportOrder,
  hexToRgb,
  getFallbackFillColor,
  summarizeWarnings,
  unitNumber,
};
