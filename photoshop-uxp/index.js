'use strict';

const { app, core, constants, action } = require('photoshop');
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
  bridgeVersion: document.getElementById('bridge-version'),
  objectCount: document.getElementById('object-count'),
  backgroundCount: document.getElementById('background-count'),
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
  elements.bridgeVersion.textContent = `v${bridge.version}`;
  elements.objectCount.textContent = String(bridge.objects.length);
  elements.backgroundCount.textContent = String(bridgeLogic.countBackgrounds(bridge));
  elements.importFile.disabled = false;
}

function listPhotoshopFonts() {
  const fonts = [];
  for (let index = 0; index < app.fonts.length; index += 1) fonts.push(app.fonts[index]);
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

function activateTargetDocument(targetDocument) {
  if (!targetDocument || !Number.isFinite(targetDocument.id)) throw new Error('Import先Documentを確認できません。');
  if (app.activeDocument?.id !== targetDocument.id) app.activeDocument = targetDocument;
  if (app.activeDocument?.id !== targetDocument.id) throw new Error('Import先Documentをactiveにできません。');
}

function layerBelongsToDocument(layer, documentModel) {
  return Boolean(layer && layer.document && layer.document.id === documentModel.id);
}

async function closeTemporaryDocument(tempDocument, targetDocument, runtimeWarnings, objectName) {
  if (!tempDocument) return;
  try {
    await tempDocument.close(constants.SaveOptions.DONOTSAVECHANGES);
  } catch {
    try {
      tempDocument.closeWithoutSaving();
    } catch {
      runtimeWarnings.push(`${objectName}: 一時PNG Documentを自動で閉じられませんでした。`);
    }
  } finally {
    try {
      activateTargetDocument(targetDocument);
    } catch {
      runtimeWarnings.push(`${objectName}: 一時PNG処理後にImport先Documentへ戻せませんでした。`);
    }
  }
}

async function createNativeTextLayer(documentModel, group, object, fonts, resolution, runtimeWarnings, layerName) {
  activateTargetDocument(documentModel);
  const fontChoice = bridgeLogic.chooseFont(fonts, object.font);
  const color = createSolidColor(bridgeLogic.getFallbackFillColor(object.fill));
  const fontSize = bridgeLogic.pixelsToPhotoshopTextUnits(object.fontSizePx, resolution);
  const layerOptions = {
    name: layerName,
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
  if (!layerBelongsToDocument(layer, documentModel) || layer.kind !== constants.LayerKind.TEXT) {
    throw new Error('作成したnative Text LayerのDocumentまたはkindが不正です。');
  }
  return layer;
}

async function importBackgroundLayer(targetDocument, frameGroup, plan, runtimeWarnings, tempIndex) {
  if (!plan.background.asset) {
    if (plan.background.error) runtimeWarnings.push(plan.background.error);
    return null;
  }

  const asset = plan.background.asset;
  const bounds = plan.object.metadata?.background?.renderBounds;
  if (!bounds) {
    runtimeWarnings.push(`${plan.object.name}: 背景renderBoundsが無いため背景をskipしました。`);
    return null;
  }

  const tempFolder = await storage.localFileSystem.getTemporaryFolder();
  const file = await tempFolder.createFile(
    `tgs-${bridgeLogic.shortObjectId(plan.object.objectId)}-${tempIndex}.png`,
    { overwrite: true },
  );
  let tempDocument = null;
  let layer = null;
  try {
    await file.write(plan.background.bytes, { format: storage.formats.binary });
    tempDocument = await app.open(file);
    const sourceLayer = tempDocument.layers[0];
    if (!layerBelongsToDocument(sourceLayer, tempDocument)) {
      throw new Error('一時PNG DocumentのBackground Layerを取得できませんでした。');
    }
    layer = await sourceLayer.duplicate(targetDocument);
    if (!layerBelongsToDocument(layer, targetDocument)) {
      throw new Error('Background LayerがImport先Documentへ複製されませんでした。');
    }
    layer.name = plan.names.background;
    await closeTemporaryDocument(
      tempDocument,
      targetDocument,
      runtimeWarnings,
      plan.object.name,
    );
    tempDocument = null;
    activateTargetDocument(targetDocument);

    let placement = bridgeLogic.calculateTopLeftDelta(layer.boundsNoEffects ?? layer.bounds, bounds);
    if (!placement.ok) throw new Error(placement.error);
    if (placement.needsScale) {
      if (!Number.isFinite(placement.scaleX) || !Number.isFinite(placement.scaleY)) {
        throw new Error('Background Layerのscaleを計算できません。');
      }
      await layer.scale(placement.scaleX, placement.scaleY);
      placement = bridgeLogic.calculateTopLeftDelta(layer.boundsNoEffects ?? layer.bounds, bounds);
      if (!placement.ok) throw new Error(placement.error);
    }
    await layer.translate(placement.dx, placement.dy);
    const postCheck = bridgeLogic.validatePlacement(layer.boundsNoEffects ?? layer.bounds, bounds);
    if (!postCheck.ok) {
      throw new Error(
        `背景位置の調整に失敗しました（Δx=${postCheck.deltaLeft.toFixed(2)}, Δy=${postCheck.deltaTop.toFixed(2)}）。`,
      );
    }
    layer.move(frameGroup, constants.ElementPlacement.PLACEINSIDE);
    layer.sendToBack();
    return {
      layer,
      target: placement.target,
      result: postCheck.actual,
      duplicateDocument: 'target',
    };
  } catch (error) {
    if (layer && layerBelongsToDocument(layer, targetDocument)) {
      try {
        await layer.delete();
      } catch {
        // A failed background must never remain at the temporary document's origin.
      }
    }
    throw error;
  } finally {
    if (tempDocument) {
      await closeTemporaryDocument(
        tempDocument,
        targetDocument,
        runtimeWarnings,
        plan.object.name,
      );
    }
    try {
      activateTargetDocument(targetDocument);
    } catch {
      // closeTemporaryDocument already reports reactivation failures.
    }
    try {
      await file.delete();
    } catch {
      // plugin-temp is removed by UXP; an individual cleanup failure is non-fatal.
    }
  }
}

async function convertObjectGroupToSmartObject(documentModel, objectGroup, targetGroup, finalName) {
  activateTargetDocument(documentModel);
  const descriptors = bridgeLogic.buildConvertToSmartObjectDescriptors(objectGroup.id);
  await action.batchPlay(descriptors, { synchronousExecution: false, modalBehavior: 'execute' });
  const smartObject = documentModel.activeLayers[0];
  if (
    !smartObject
    || smartObject.id === objectGroup.id
    || !layerBelongsToDocument(smartObject, documentModel)
    || smartObject.kind !== constants.LayerKind.SMARTOBJECT
  ) throw new Error('変換後のSmart Object Layerを取得できません。');
  smartObject.name = finalName;
  smartObject.move(targetGroup, constants.ElementPlacement.PLACEINSIDE);
  smartObject.bringToFront();
  return smartObject;
}

async function openSmartObjectContents(targetDocument, smartObject) {
  activateTargetDocument(targetDocument);
  const descriptors = bridgeLogic.buildOpenSmartObjectContentsDescriptors(
    targetDocument.id,
    smartObject.id,
  );
  await action.batchPlay(descriptors, { synchronousExecution: false, modalBehavior: 'execute' });
  const contentDocument = app.activeDocument;
  if (!contentDocument || contentDocument.id === targetDocument.id) {
    throw new Error('Smart Object contents Documentを開けませんでした。');
  }
  return contentDocument;
}

function getLayerBoundsCenter(layer) {
  const bounds = bridgeLogic.boundsToNumbers(layer.boundsNoEffects ?? layer.bounds);
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)) return null;
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}

async function addSmartObjectSafetyCanvas(targetDocument, smartObject, bridge) {
  const originalCenter = getLayerBoundsCenter(smartObject);
  let contentDocument = null;
  let contentSaved = false;
  let before = null;
  let after = null;
  try {
    contentDocument = await openSmartObjectContents(targetDocument, smartObject);
    before = {
      width: bridgeLogic.unitNumber(contentDocument.width),
      height: bridgeLogic.unitNumber(contentDocument.height),
    };
    after = bridgeLogic.calculateSmartObjectSafetyCanvas(
      before.width,
      before.height,
      bridge.canvasWidth,
      bridge.canvasHeight,
    );
    if (after.width !== before.width || after.height !== before.height) {
      await contentDocument.resizeCanvas(after.width, after.height);
    }
    await contentDocument.save();
    contentSaved = true;
    await contentDocument.close(constants.SaveOptions.SAVECHANGES);
    contentDocument = null;
  } finally {
    if (contentDocument) {
      try {
        await contentDocument.close(
          contentSaved
            ? constants.SaveOptions.SAVECHANGES
            : constants.SaveOptions.DONOTSAVECHANGES,
        );
      } catch {
        // The caller reports the safety-canvas failure; preserve the Smart Object layer.
      }
    }
    activateTargetDocument(targetDocument);
  }

  if (originalCenter && layerBelongsToDocument(smartObject, targetDocument)) {
    const currentCenter = getLayerBoundsCenter(smartObject);
    if (currentCenter) {
      const dx = originalCenter.x - currentCenter.x;
      const dy = originalCenter.y - currentCenter.y;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        await smartObject.translate(dx, dy);
      }
    }
  }
  return { before, after };
}

function validateObjectGroup(documentModel, objectGroup, textLayer, backgroundLayer) {
  if (!layerBelongsToDocument(objectGroup, documentModel)) {
    return { ok: false, error: 'Object GroupがImport先Documentにありません。' };
  }
  if (!layerBelongsToDocument(textLayer, documentModel) || textLayer.kind !== constants.LayerKind.TEXT) {
    return { ok: false, error: 'native Text LayerがObject Groupにありません。' };
  }
  const childIds = new Set(Array.from(objectGroup.layers ?? []).map((layer) => layer.id));
  if (!childIds.has(textLayer.id)) return { ok: false, error: 'Text LayerがGroupへ格納されていません。' };
  if (backgroundLayer && (!layerBelongsToDocument(backgroundLayer, documentModel) || !childIds.has(backgroundLayer.id))) {
    return { ok: false, error: 'Background LayerがGroupへ格納されていません。' };
  }
  return { ok: true, childCount: childIds.size };
}

async function selectBridgeFile() {
  try {
    const file = await storage.localFileSystem.getFileForOpening({ allowMultiple: false, types: ['json'] });
    if (!file) return;
    const parsed = JSON.parse(await file.read());
    const validation = bridgeLogic.validateBridge(parsed);
    if (!validation.ok) {
      selectedBridge = null;
      elements.importFile.disabled = true;
      setReport('error', ['Bridgeファイルが不正です。', ...validation.errors]);
      return;
    }
    selectedBridge = parsed;
    setPreview(file.name, parsed);
    const planWarnings = bridgeLogic.buildImportPlan(parsed)
      .map((item) => item.background.error)
      .filter(Boolean);
    const warnings = bridgeLogic.summarizeWarnings(parsed.objects, planWarnings);
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

  const targetDocument = app.activeDocument;
  const targetDocumentId = targetDocument.id;
  const canvas = bridgeLogic.validateCanvasSize(selectedBridge, targetDocument);
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
  let importedTextCount = 0;
  let importedBackgroundCount = 0;
  let smartObjectCount = 0;
  const debugDetails = [];
  try {
    await core.executeAsModal(async () => {
      if (targetDocument.id !== targetDocumentId) throw new Error('Import先Document referenceが変化しました。');
      activateTargetDocument(targetDocument);
      const frameGroup = await targetDocument.createLayerGroup({
        name: getUniqueGroupName(targetDocument, `TGS_${selectedBridge.frameLabel || selectedBridge.frameId}`),
      });
      const fonts = listPhotoshopFonts();
      const resolution = bridgeLogic.unitNumber(targetDocument.resolution) || 72;
      const plan = bridgeLogic.buildImportPlan(selectedBridge);

      for (let index = 0; index < plan.length; index += 1) {
        const item = plan[index];
        try {
          if (selectedBridge.version === bridgeLogic.LEGACY_BRIDGE_VERSION) {
            await createNativeTextLayer(
              targetDocument,
              frameGroup,
              item.object,
              fonts,
              resolution,
              runtimeWarnings,
              normalizeLayerName(item.object.name, `テキスト${index + 1}`),
            );
            importedTextCount += 1;
            continue;
          }

          const textLayer = await createNativeTextLayer(
            targetDocument,
            frameGroup,
            item.object,
            fonts,
            resolution,
            runtimeWarnings,
            item.names.text,
          );
          importedTextCount += 1;
          debugDetails.push(`${bridgeLogic.shortObjectId(item.object.objectId)} Text: YES / target Document`);

          let backgroundLayer = null;
          try {
            const importedBackground = await importBackgroundLayer(
              targetDocument,
              frameGroup,
              item,
              runtimeWarnings,
              index,
            );
            if (importedBackground) {
              backgroundLayer = importedBackground.layer;
              importedBackgroundCount += 1;
              debugDetails.push(
                `${bridgeLogic.shortObjectId(item.object.objectId)} BG duplicate: YES / ${importedBackground.duplicateDocument} Document`,
              );
              debugDetails.push(
                `${bridgeLogic.shortObjectId(item.object.objectId)} BG: target ${importedBackground.target.left.toFixed(1)},${importedBackground.target.top.toFixed(1)} / result ${importedBackground.result.left.toFixed(1)},${importedBackground.result.top.toFixed(1)}`,
              );
            }
          } catch (error) {
            debugDetails.push(`${bridgeLogic.shortObjectId(item.object.objectId)} BG duplicate: FAIL`);
            runtimeWarnings.push(
              `${item.object.name}: BackgroundをImportできませんでした（${error instanceof Error ? error.message : String(error)}）。Textは保持しました。`,
            );
          }

          activateTargetDocument(targetDocument);
          const groupLayers = backgroundLayer ? [backgroundLayer, textLayer] : [textLayer];
          const objectGroup = await targetDocument.createLayerGroup({
            name: item.names.objectGroup,
            fromLayers: groupLayers,
          });
          objectGroup.move(frameGroup, constants.ElementPlacement.PLACEINSIDE);
          if (backgroundLayer) backgroundLayer.sendToBack();
          textLayer.bringToFront();
          const groupValidation = validateObjectGroup(
            targetDocument,
            objectGroup,
            textLayer,
            backgroundLayer,
          );
          debugDetails.push(
            `${bridgeLogic.shortObjectId(item.object.objectId)} Group children: ${groupValidation.childCount ?? 0}`,
          );
          if (!groupValidation.ok) {
            runtimeWarnings.push(
              `${item.object.name}: Text/Background Group構築に失敗しました（${groupValidation.error}）。Smart Object化をskipしました。`,
            );
            continue;
          }
          try {
            const smartObject = await convertObjectGroupToSmartObject(
              targetDocument,
              objectGroup,
              frameGroup,
              item.names.smartObject,
            );
            smartObjectCount += 1;
            debugDetails.push(`${bridgeLogic.shortObjectId(item.object.objectId)} Smart Object: YES`);
            try {
              const safetyCanvas = await addSmartObjectSafetyCanvas(
                targetDocument,
                smartObject,
                selectedBridge,
              );
              debugDetails.push(
                `${bridgeLogic.shortObjectId(item.object.objectId)} Smart Object canvas: ${safetyCanvas.before.width}×${safetyCanvas.before.height} → ${safetyCanvas.after.width}×${safetyCanvas.after.height}`,
              );
            } catch (error) {
              runtimeWarnings.push(
                `${item.object.name}: Smart Object編集余白の確保に失敗しました（${error instanceof Error ? error.message : String(error)}）。Smart Objectは保持しました。`,
              );
            }
          } catch (error) {
            objectGroup.name = item.names.smartObject;
            runtimeWarnings.push(
              `${item.object.name}: Smart Object化に失敗しました。Groupのまま保持しました（${error instanceof Error ? error.message : String(error)}）。`,
            );
          }
        } catch (error) {
          runtimeWarnings.push(
            `${item.object.name || item.object.objectId}: importできませんでした（${error instanceof Error ? error.message : String(error)}）。`,
          );
        }
      }
    }, { commandName: 'Import Text Graphic Studio Frame' });

    const warnings = bridgeLogic.summarizeWarnings(selectedBridge.objects, runtimeWarnings);
    const report = [
      'Import完了',
      `Text Layers: ${importedTextCount} / ${selectedBridge.objects.length}`,
      `Backgrounds: ${importedBackgroundCount}`,
      `Smart Objects: ${smartObjectCount}`,
    ];
    if (selectedBridge.version === bridgeLogic.BRIDGE_VERSION) {
      report.push('', '文字変更後の背景再フィットはPhase 3.1Cで対応予定です。');
      if (debugDetails.length) report.push('', 'Debug:', ...debugDetails.map((line) => `・${line}`));
    }
    if (warnings.length) report.push('', 'Warnings:', ...warnings.map((warning) => `・${warning}`));
    setReport(warnings.length ? 'warning' : 'success', report);
  } catch (error) {
    setReport('error', ['Importを完了できませんでした。', error instanceof Error ? error.message : String(error)]);
  } finally {
    elements.importFile.disabled = false;
  }
}

elements.selectFile.addEventListener('click', () => { void selectBridgeFile(); });
elements.importFile.addEventListener('click', () => { void importBridge(); });
