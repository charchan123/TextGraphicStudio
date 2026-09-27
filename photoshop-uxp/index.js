'use strict';

const { app, core, constants } = require('photoshop');
const { storage } = require('uxp');
const bridgeLogic = require('./lib/bridge.js');

let selectedBridge = null;

const elements = {
  selectFile: document.getElementById('select-file'),
  importFile: document.getElementById('import-file'),
  fileName: document.getElementById('file-name'),
  projectName: document.getElementById('project-name'),
  frameName: document.getElementById('frame-name'),
  canvasSize: document.getElementById('canvas-size'),
  objectCount: document.getElementById('object-count'),
  report: document.getElementById('report'),
};

function setReport(kind, lines) {
  elements.report.className = `report is-${kind}`;
  elements.report.textContent = Array.isArray(lines) ? lines.join('\n') : String(lines);
}

function setPreview(fileName, bridge) {
  elements.fileName.textContent = fileName;
  elements.projectName.textContent = bridge.projectName || '名称未設定';
  elements.frameName.textContent = bridge.frameLabel || bridge.frameId;
  elements.canvasSize.textContent = `${bridge.canvasWidth} × ${bridge.canvasHeight}`;
  elements.objectCount.textContent = String(bridge.objects.length);
  elements.importFile.disabled = false;
}

function listPhotoshopFonts() {
  const fonts = [];
  for (let index = 0; index < app.fonts.length; index += 1) {
    fonts.push(app.fonts[index]);
  }
  return fonts;
}

function createSolidColor(hex) {
  const color = new app.SolidColor();
  const rgb = bridgeLogic.hexToRgb(hex);
  color.rgb.red = rgb.red;
  color.rgb.green = rgb.green;
  color.rgb.blue = rgb.blue;
  return color;
}

function normalizeLayerName(value, fallback) {
  const name = String(value || fallback).replace(/[\r\n]+/g, ' ').trim();
  return `TGS_${name || fallback}`;
}

function getUniqueGroupName(documentModel, requestedName) {
  const existing = new Set(Array.from(documentModel.layers).map((layer) => layer.name));
  if (!existing.has(requestedName)) return requestedName;
  let suffix = 2;
  while (existing.has(`${requestedName} ${suffix}`)) suffix += 1;
  return `${requestedName} ${suffix}`;
}

function needsFauxBold(object, resolvedFont) {
  if ((object.font?.weight ?? 400) < 700) return false;
  return !/(bold|black|heavy|semibold|demibold|w[7-9])/i.test(
    `${resolvedFont?.style ?? ''} ${resolvedFont?.postScriptName ?? ''}`,
  );
}

function needsFauxItalic(object, resolvedFont) {
  if (object.metadata?.fontStyle !== 'italic') return false;
  return !/(italic|oblique)/i.test(`${resolvedFont?.style ?? ''} ${resolvedFont?.postScriptName ?? ''}`);
}

function setParagraphAlignment(textItem, alignment) {
  const values = {
    left: constants.Justification?.LEFT,
    center: constants.Justification?.CENTER,
    right: constants.Justification?.RIGHT,
  };
  const value = values[alignment];
  if (value !== undefined && textItem.paragraphStyle) textItem.paragraphStyle.justification = value;
}

async function createNativeTextLayer(documentModel, group, object, fonts, resolution, runtimeWarnings, index) {
  const fontChoice = bridgeLogic.chooseFont(fonts, object.font);
  const colorHex = bridgeLogic.getFallbackFillColor(object.fill);
  const color = createSolidColor(colorHex);
  const fontSize = bridgeLogic.pixelsToPhotoshopTextUnits(object.fontSizePx, resolution);
  const layerOptions = {
    name: normalizeLayerName(object.name, `テキスト${index + 1}`),
    contents: object.text.replace(/\r\n?|\n/g, '\r'),
    fontSize,
    position: { x: object.center.x, y: object.center.y },
    textColor: color,
  };
  if (fontChoice.font?.postScriptName) layerOptions.fontName = fontChoice.font.postScriptName;

  if (!fontChoice.font) {
    runtimeWarnings.push(
      `${object.name}: Fontが見つかりません（${object.font?.postScriptName || `${object.font?.family || '不明'} ${object.font?.style || ''}`}）。Photoshop既定Fontを使用しました。`,
    );
  } else if (fontChoice.match === 'family-style') {
    runtimeWarnings.push(`${object.name}: PostScript名が一致しなかったためfamily + styleでFontを選択しました。`);
  }

  const layer = await documentModel.createTextLayer(layerOptions);
  layer.textItem.contents = layerOptions.contents;
  const style = layer.textItem.characterStyle;
  if (fontChoice.font?.postScriptName) style.font = fontChoice.font.postScriptName;
  style.size = fontSize;
  style.color = color;
  style.tracking = Math.max(-1000, Math.min(1000, object.tracking));
  style.useAutoLeading = false;
  style.leading = Math.max(0, bridgeLogic.pixelsToPhotoshopTextUnits(object.lineHeightPx, resolution));
  style.horizontalScale = Math.max(0.01, Math.min(1000, object.horizontalScale));
  style.verticalScale = Math.max(0.01, Math.min(1000, object.verticalScale));
  style.fauxBold = needsFauxBold(object, fontChoice.font);
  style.fauxItalic = needsFauxItalic(object, fontChoice.font);
  setParagraphAlignment(layer.textItem, object.metadata?.textAlign);
  layer.visible = object.visible !== false;

  layer.move(group, constants.ElementPlacement.PLACEINSIDE);
  layer.bringToFront();

  const delta = bridgeLogic.calculateCenterDelta(layer.boundsNoEffects, object.center);
  await layer.translate(delta.x, delta.y);
  if (object.rotationDeg) await layer.rotate(object.rotationDeg);
  return layer;
}

async function selectBridgeFile() {
  try {
    const file = await storage.localFileSystem.getFileForOpening({
      allowMultiple: false,
      types: ['json'],
    });
    if (!file) return;
    const raw = await file.read();
    const parsed = JSON.parse(raw);
    const validation = bridgeLogic.validateBridge(parsed);
    if (!validation.ok) {
      selectedBridge = null;
      elements.importFile.disabled = true;
      setReport('error', ['Bridgeファイルが不正です。', ...validation.errors]);
      return;
    }
    selectedBridge = parsed;
    setPreview(file.name, parsed);
    const warnings = bridgeLogic.summarizeWarnings(parsed.objects, []);
    setReport(warnings.length ? 'warning' : 'idle', warnings.length
      ? ['読み込み前の注意:', ...warnings.map((warning) => `・${warning}`)]
      : 'Bridgeファイルを確認しました。Photoshopへ読み込めます。');
  } catch (error) {
    selectedBridge = null;
    elements.importFile.disabled = true;
    setReport('error', error instanceof Error ? error.message : 'Bridgeファイルを読み込めませんでした。');
  }
}

async function importBridge() {
  if (!selectedBridge) {
    setReport('error', '先にTGS Bridgeファイルを選択してください。');
    return;
  }
  if (app.documents.length === 0) {
    setReport('error', 'Photoshopで先にドキュメントを開いてください。');
    return;
  }

  const documentModel = app.activeDocument;
  const canvas = bridgeLogic.validateCanvasSize(selectedBridge, documentModel);
  if (!canvas.matches) {
    setReport('error', [
      'キャンバスサイズが一致しません。',
      `TGS: ${selectedBridge.canvasWidth} × ${selectedBridge.canvasHeight}`,
      `Photoshop: ${canvas.actualWidth} × ${canvas.actualHeight}`,
    ]);
    return;
  }

  elements.importFile.disabled = true;
  setReport('idle', '読み込み中…');
  const runtimeWarnings = [];
  let importedCount = 0;
  try {
    await core.executeAsModal(async () => {
      const groupBaseName = `TGS_${selectedBridge.frameLabel || selectedBridge.frameId}`;
      const group = await documentModel.createLayerGroup({
        name: getUniqueGroupName(documentModel, groupBaseName),
      });
      const fonts = listPhotoshopFonts();
      const resolution = bridgeLogic.unitNumber(documentModel.resolution) || 72;
      const objects = bridgeLogic.getImportOrder(selectedBridge.objects);

      for (let index = 0; index < objects.length; index += 1) {
        const object = objects[index];
        try {
          await createNativeTextLayer(
            documentModel,
            group,
            object,
            fonts,
            resolution,
            runtimeWarnings,
            index,
          );
          importedCount += 1;
        } catch (error) {
          runtimeWarnings.push(`${object.name || object.objectId}: Text Layerを作成できませんでした（${error instanceof Error ? error.message : String(error)}）。`);
        }
      }
    }, { commandName: 'Import Text Graphic Studio Frame' });

    const warnings = bridgeLogic.summarizeWarnings(selectedBridge.objects, runtimeWarnings);
    const report = [
      'Import完了',
      `Text Layers: ${importedCount} / ${selectedBridge.objects.length}`,
    ];
    if (warnings.length) report.push('', 'Warnings:', ...warnings.map((warning) => `・${warning}`));
    setReport(warnings.length ? 'warning' : 'success', report);
  } catch (error) {
    setReport('error', [
      'Importを完了できませんでした。',
      error instanceof Error ? error.message : String(error),
    ]);
  } finally {
    elements.importFile.disabled = false;
  }
}

elements.selectFile.addEventListener('click', () => {
  void selectBridgeFile();
});

elements.importFile.addEventListener('click', () => {
  void importBridge();
});
