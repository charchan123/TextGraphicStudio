import assert from 'node:assert/strict';
import {
  clearRangeStyleLeaf,
  clearRangeStyles,
  getRangeOverrideState,
  setRangeStyleLeaf,
  shiftRangeNumericLeaf,
} from '@/src/services/partialStyles';
import { applyQuickPartialOperation, cloneQuickPartialOperation } from '@/src/services/quickPartialPresets';
import {
  calculateTextRangeHorizontalGeometry,
  getDynamicGlyphOffsetXRange,
  getPartialHorizontalAlignmentDelta,
  shiftGraphicTextRangeX,
} from '@/src/services/partialHorizontalPosition';
import { createTextDefaultsFile, parseTextDefaultsFile, readTextDefaultsFile } from '@/src/services/textDefaultsFileService';
import { normalizeStudioProject } from '@/src/services/studioProject';
import { toProjectTextDefaults } from '@/src/services/textDefaults';
import { getOutputPreviewKeyboardAction, getOutputPreviewTargetIndex } from '@/src/services/outputPreviewNavigation';
import { graphicPngFileName } from '@/src/services/exportFileNames';
import { getHistoryShortcutAction, handleHistoryShortcut, performRedo, performUndo } from '@/src/services/historyShortcuts';
import { useEditorStore } from '@/src/store/editorStore';

const keyboardEvent = (overrides: Partial<KeyboardEvent> = {}) => {
  let defaultPrevented = false;
  let propagationStopped = false;
  const event = {
    altKey: false,
    ctrlKey: false,
    get defaultPrevented() { return defaultPrevented; },
    isComposing: false,
    key: '',
    metaKey: false,
    preventDefault: () => { defaultPrevented = true; },
    repeat: false,
    shiftKey: false,
    stopPropagation: () => { propagationStopped = true; },
    target: { kind: 'textarea' },
    ...overrides,
  } as unknown as KeyboardEvent;
  return { event, prevented: () => defaultPrevented, stopped: () => propagationStopped };
};

assert.equal(getHistoryShortcutAction(keyboardEvent({ ctrlKey: true, key: 'z' }).event), 'undo');
assert.equal(getHistoryShortcutAction(keyboardEvent({ ctrlKey: true, key: 'Z', shiftKey: true }).event), 'redo');
assert.equal(getHistoryShortcutAction(keyboardEvent({ ctrlKey: true, key: 'y' }).event), 'redo');
assert.equal(getHistoryShortcutAction(keyboardEvent({ metaKey: true, key: 'z' }).event), 'undo');
assert.equal(getHistoryShortcutAction(keyboardEvent({ metaKey: true, key: 'z', shiftKey: true }).event), 'redo');
assert.equal(getHistoryShortcutAction(keyboardEvent({ ctrlKey: true, altKey: true, key: 'z' }).event), null);

let shortcutUndoCalls = 0;
let shortcutRedoCalls = 0;
const shortcutCommands = { undo: () => { shortcutUndoCalls += 1; }, redo: () => { shortcutRedoCalls += 1; } };
const textareaUndo = keyboardEvent({ ctrlKey: true, key: 'z' });
assert.equal(handleHistoryShortcut(textareaUndo.event, shortcutCommands), true);
assert.equal(shortcutUndoCalls, 1);
assert.equal(textareaUndo.prevented(), true);
assert.equal(textareaUndo.stopped(), true);
// The same event cannot be consumed twice even if a listener were accidentally duplicated.
assert.equal(handleHistoryShortcut(textareaUndo.event, shortcutCommands), false);
assert.equal(shortcutUndoCalls, 1);
const repeatedUndo = keyboardEvent({ ctrlKey: true, key: 'z', repeat: true });
assert.equal(handleHistoryShortcut(repeatedUndo.event, shortcutCommands), true);
assert.equal(shortcutUndoCalls, 1);
assert.equal(repeatedUndo.prevented(), true);
const ctrlY = keyboardEvent({ ctrlKey: true, key: 'y' });
handleHistoryShortcut(ctrlY.event, shortcutCommands);
assert.equal(shortcutRedoCalls, 1);
const ctrlShiftZ = keyboardEvent({ ctrlKey: true, key: 'z', shiftKey: true });
handleHistoryShortcut(ctrlShiftZ.event, shortcutCommands);
assert.equal(shortcutRedoCalls, 2);

const fillRed = { type: 'solid' as const, color: '#FF0000' };
assert.equal(getOutputPreviewKeyboardAction('ArrowLeft'), 'previous');
assert.equal(getOutputPreviewKeyboardAction('ArrowRight'), 'next');
assert.equal(getOutputPreviewKeyboardAction('Escape'), 'close');
assert.equal(getOutputPreviewKeyboardAction('Enter'), null);
assert.equal(getOutputPreviewTargetIndex(0, 4, 'previous'), 0);
assert.equal(getOutputPreviewTargetIndex(1, 4, 'previous'), 0);
assert.equal(getOutputPreviewTargetIndex(1, 4, 'next'), 2);
assert.equal(getOutputPreviewTargetIndex(3, 4, 'next'), 3);
assert.equal(graphicPngFileName('テキスト 1'), 'テキスト1.png');
assert.equal(graphicPngFileName('テキスト 12'), 'テキスト12.png');
assert.equal(graphicPngFileName('甲子園 決勝'), '甲子園 決勝.png');
const none = getRangeOverrideState([], 0, 2, 'fill');
assert.equal(none.presence, 'none');

let styles = setRangeStyleLeaf([], 0, 2, 'fill', fillRed);
assert.deepEqual(getRangeOverrideState(styles, 0, 2, 'fill'), { presence: 'all', value: fillRed, valueMixed: false });
styles = setRangeStyleLeaf(styles, 0, 2, 'fontSize', 140);
assert.equal(getRangeOverrideState(styles, 0, 2, 'fontSize').value, 140);

const mixedFill = getRangeOverrideState([{ start: 0, end: 1, fill: fillRed }], 0, 2, 'fill');
assert.equal(mixedFill.presence, 'mixed');
styles = clearRangeStyleLeaf(styles, 0, 2, 'fontSize');
assert.equal(getRangeOverrideState(styles, 0, 2, 'fontSize').presence, 'none');
assert.equal(getRangeOverrideState(styles, 0, 2, 'fill').presence, 'all');
assert.deepEqual(clearRangeStyles(styles, 0, 2), []);

const shifted = shiftRangeNumericLeaf([
  { start: 0, end: 1, glyphOffsetX: -10 },
  { start: 1, end: 2, glyphOffsetX: 5 },
], 0, 2, 'glyphOffsetX', -20);
assert.equal(getRangeOverrideState(shifted, 0, 1, 'glyphOffsetX').value, -30);
assert.equal(getRangeOverrideState(shifted, 1, 2, 'glyphOffsetX').value, -15);
assert.equal(getRangeOverrideState(shifted, 0, 2, 'glyphOffsetX').presence, 'mixed');
const xy = setRangeStyleLeaf(shifted, 0, 2, 'glyphOffsetY', 8);
assert.equal(getRangeOverrideState(xy, 0, 2, 'glyphOffsetY').value, 8);

const referenceGlyphs = [
  { start: 0, end: 1, left: -300, right: -250 },
  { start: 1, end: 2, left: 0, right: 40 },
  { start: 2, end: 3, left: 50, right: 100 },
  { start: 3, end: 4, left: 450, right: 500 },
];
const renderedGlyphs = [
  referenceGlyphs[0],
  { start: 1, end: 2, left: 180, right: 220 },
  { start: 2, end: 3, left: 230, right: 280 },
  referenceGlyphs[3],
];
const horizontalGeometry = calculateTextRangeHorizontalGeometry(referenceGlyphs, renderedGlyphs, 1, 3)!;
assert.deepEqual(horizontalGeometry.reference, { left: -300, right: 500 });
assert.deepEqual(horizontalGeometry.selection, { left: 180, right: 280 });
assert.equal(getPartialHorizontalAlignmentDelta(horizontalGeometry, 'left'), -480);
assert.equal(getPartialHorizontalAlignmentDelta(horizontalGeometry, 'center'), -130);
assert.equal(getPartialHorizontalAlignmentDelta(horizontalGeometry, 'right'), 220);
const stableRange = getDynamicGlyphOffsetXRange(horizontalGeometry, 150);
assert.deepEqual(stableRange, { min: -330, max: 370 });
assert.ok(stableRange.max - stableRange.min > 200);

const moveSelection = (delta: number) => renderedGlyphs.map((glyph, index) => index === 1 || index === 2
  ? { ...glyph, left: glyph.left + delta, right: glyph.right + delta }
  : glyph);
const rightAlignedGeometry = calculateTextRangeHorizontalGeometry(referenceGlyphs, moveSelection(220), 1, 3)!;
assert.deepEqual(rightAlignedGeometry.reference, horizontalGeometry.reference);
assert.equal(rightAlignedGeometry.selection.right, rightAlignedGeometry.reference.right);
assert.equal(getPartialHorizontalAlignmentDelta(rightAlignedGeometry, 'right'), 0);
assert.deepEqual(getDynamicGlyphOffsetXRange(rightAlignedGeometry, 370), stableRange);
const leftAlignedGeometry = calculateTextRangeHorizontalGeometry(referenceGlyphs, moveSelection(-480), 1, 3)!;
assert.equal(leftAlignedGeometry.selection.left, leftAlignedGeometry.reference.left);
assert.deepEqual(getDynamicGlyphOffsetXRange(leftAlignedGeometry, -330), stableRange);
const centeredGeometry = calculateTextRangeHorizontalGeometry(referenceGlyphs, moveSelection(-130), 1, 3)!;
assert.equal(
  (centeredGeometry.selection.left + centeredGeometry.selection.right) / 2,
  (centeredGeometry.reference.left + centeredGeometry.reference.right) / 2,
);

const state = () => useEditorStore.getState();
const seeded = {
  ...state().lastUsedTextDefaults,
  typography: { ...state().lastUsedTextDefaults.typography, fontSize: 123, fontWeightAdjust: 4 },
};
state().hydrateLastUsedTextDefaults(seeded);
state().createNewProject();
assert.equal(state().studioProject.projectTextDefaults?.typography.fontSize, 123);
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 4);
assert.equal(state().project.objects[0].text, 'ここにテキストを入力してください。');

const historyObjectId = state().project.objects[0].id;
const historyPositionA = state().project.objects[0].position.x;
for (const positionX of [historyPositionA + 1, historyPositionA + 2, historyPositionA + 3]) {
  state().updateObject(historyObjectId, (object) => ({ ...object, position: { ...object.position, x: positionX } }));
}
performUndo();
assert.equal(state().project.objects[0].position.x, historyPositionA + 2);
performRedo();
assert.equal(state().project.objects[0].position.x, historyPositionA + 3);
handleHistoryShortcut(keyboardEvent({ ctrlKey: true, key: 'z' }).event);
assert.equal(state().project.objects[0].position.x, historyPositionA + 2);
handleHistoryShortcut(keyboardEvent({ ctrlKey: true, key: 'z' }).event);
assert.equal(state().project.objects[0].position.x, historyPositionA + 1);
handleHistoryShortcut(keyboardEvent({ ctrlKey: true, key: 'y' }).event);
assert.equal(state().project.objects[0].position.x, historyPositionA + 2);
handleHistoryShortcut(keyboardEvent({ ctrlKey: true, key: 'z', shiftKey: true }).event);
assert.equal(state().project.objects[0].position.x, historyPositionA + 3);

const firstId = state().project.objects[0].id;
const activeFrameId = state().studioProject.activeFrameId;
const heldSelection = {
  frameId: activeFrameId,
  objectId: firstId,
  text: state().project.objects[0].text,
  start: 0,
  end: 2,
};
state().setPartialStyleExpanded(false);
state().setTextSelection(heldSelection);
assert.equal(state().partialStyleExpanded, false);
state().setPartialStyleExpanded(true);

state().beginTransaction();
assert.deepEqual(state().textSelection, heldSelection);
state().updateObject(firstId, (object) => ({
  ...object,
  partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'fontSize', 130),
}), false);
assert.deepEqual(state().textSelection, heldSelection);
state().finishTransaction();
assert.deepEqual(state().textSelection, heldSelection);

state().updateObject(firstId, (object) => ({
  ...object,
  partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'fill', object.fill),
}));
assert.deepEqual(state().textSelection, heldSelection);
assert.equal(state().partialStyleExpanded, true);
state().updateObject(firstId, (object) => ({
  ...object,
  partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'fill', fillRed),
}));
assert.deepEqual(state().textSelection, heldSelection);
assert.equal(getRangeOverrideState(state().project.objects[0].partialStyles, 0, 2, 'fill').value?.type, 'solid');
state().updateObject(firstId, (object) => ({
  ...object,
  partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'letterSpacing', 12),
}));
assert.deepEqual(state().textSelection, heldSelection);
assert.equal(getRangeOverrideState(state().project.objects[0].partialStyles, 0, 2, 'letterSpacing').value, 12);

state().selectObject(null);
assert.equal(state().textSelection, null);
state().selectObject(firstId);
state().setTextSelection(heldSelection);
state().updateObject(firstId, (object) => ({
  ...object,
  typography: { ...object.typography, fontWeightAdjust: 6 },
}));
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 6);
assert.equal(state().studioProject.projectTextDefaults?.typography.fontWeightAdjust, 6);
state().undo();
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 4);
assert.equal(state().studioProject.projectTextDefaults?.typography.fontWeightAdjust, 4);
state().redo();
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 6);
assert.equal(state().studioProject.projectTextDefaults?.typography.fontWeightAdjust, 6);

const defaultsBeforePartial = JSON.stringify(state().studioProject.projectTextDefaults);
state().updateObject(firstId, (object) => ({
  ...object,
  partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'fontWeightAdjust', 10),
}));
assert.equal(getRangeOverrideState(state().project.objects[0].partialStyles, 0, 2, 'fontWeightAdjust').value, 10);
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 6);
assert.equal(JSON.stringify(state().studioProject.projectTextDefaults), defaultsBeforePartial);

const legacyPresetOperation = { style: { fontSize: 155, fill: fillRed, glyphOffsetX: -20 } };
const normalizedPresetOperation = cloneQuickPartialOperation(legacyPresetOperation);
assert.equal('fontSize' in normalizedPresetOperation.style, false);
assert.equal(normalizedPresetOperation.style.glyphOffsetX, -20);
const withPreset = applyQuickPartialOperation(state().project.objects[0], 0, 2, legacyPresetOperation);
assert.equal(getRangeOverrideState(withPreset.partialStyles, 0, 2, 'fontSize').value, 130);
assert.equal(getRangeOverrideState(withPreset.partialStyles, 0, 2, 'glyphOffsetX').value, -20);
assert.deepEqual(getRangeOverrideState(withPreset.partialStyles, 0, 2, 'fill').value, fillRed);

const pastCount = state().past.length;
state().beginTransaction();
state().updateObject(firstId, (object) => ({ ...object, partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'fontSize', 160) }), false);
state().updateObject(firstId, (object) => ({ ...object, partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 2, 'fontSize', 170) }), false);
state().finishTransaction();
assert.equal(state().past.length, pastCount + 1);
assert.equal(getRangeOverrideState(state().project.objects[0].partialStyles, 0, 2, 'fontSize').value, 170);

state().setTextSelection(heldSelection);
state().updateObject(firstId, (object) => {
  let partialStyles = setRangeStyleLeaf(object.partialStyles, 0, 1, 'glyphOffsetX', -10);
  partialStyles = setRangeStyleLeaf(partialStyles, 1, 2, 'glyphOffsetX', -20);
  return { ...object, partialStyles };
});
const horizontalPastCount = state().past.length;
const horizontalText = state().project.objects[0].text;
state().updateObject(firstId, (object) => shiftGraphicTextRangeX(object, 0, 2, -15));
assert.equal(state().past.length, horizontalPastCount + 1);
assert.deepEqual(state().textSelection, heldSelection);
assert.equal(state().project.objects[0].text, horizontalText);
assert.equal(getRangeOverrideState(state().project.objects[0].partialStyles, 0, 1, 'glyphOffsetX').value, -25);
assert.equal(getRangeOverrideState(state().project.objects[0].partialStyles, 1, 2, 'glyphOffsetX').value, -35);

state().setTextSelection(heldSelection);
state().updateObject(firstId, (object) => ({ ...object, text: object.text + '!' }));
assert.equal(state().textSelection, null);
state().undo();

state().addGraphic('既存別Text');
const otherObjectId = state().selectedId!;
const otherRotation = state().project.objects.find((object) => object.id === otherObjectId)!.transform.rotation;
state().selectObject(firstId);
const previousRotation = state().project.objects.find((object) => object.id === firstId)!.transform.rotation;
state().updateObject(firstId, (object) => ({
  ...object,
  transform: { ...object.transform, rotation: -8 },
}));
assert.equal(state().project.objects.find((object) => object.id === firstId)!.transform.rotation, -8);
assert.equal(state().studioProject.projectTextDefaults?.rotation, -8);
assert.equal(state().project.objects.find((object) => object.id === otherObjectId)!.transform.rotation, otherRotation);
state().undo();
assert.equal(state().project.objects.find((object) => object.id === firstId)!.transform.rotation, previousRotation);
assert.equal(state().studioProject.projectTextDefaults?.rotation, previousRotation);
state().redo();
assert.equal(state().project.objects.find((object) => object.id === firstId)!.transform.rotation, -8);
assert.equal(state().studioProject.projectTextDefaults?.rotation, -8);

state().addFrame();
assert.equal(state().textSelection, null);
assert.equal(state().project.objects[0].text, 'ここにテキストを入力してください。');
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 6);
assert.equal(state().project.objects[0].transform.rotation, -8);
state().addGraphic('追加Text');
assert.equal(state().project.objects.at(-1)?.typography.fontWeightAdjust, 6);
assert.equal(state().project.objects.at(-1)?.transform.rotation, -8);

const sourceSnapshot = state().getStudioProjectSnapshot();
const sourceFrameId = sourceSnapshot.activeFrameId;
const sourceObject = sourceSnapshot.frames.find((frame) => frame.frameId === sourceFrameId)!.document.objects[0];
state().duplicateFrame(sourceFrameId);
assert.deepEqual(state().project.objects[0].typography, sourceObject.typography);
assert.deepEqual(state().project.objects[0].partialStyles, sourceObject.partialStyles);

const existingBeforeDefaultsImport = JSON.stringify(state().project.objects);
const importedDefaults = {
  ...toProjectTextDefaults(state().project.objects[0]),
  typography: { ...state().project.objects[0].typography, fontRefId: 'local:test', fontSize: 88, fontWeightAdjust: 3 },
};
state().setProjectTextDefaults(importedDefaults);
assert.equal(JSON.stringify(state().project.objects), existingBeforeDefaultsImport);
state().addGraphic('import後');
assert.equal(state().project.objects.at(-1)?.typography.fontSize, 88);
assert.equal(state().project.objects.at(-1)?.typography.fontWeightAdjust, 3);

const textDefaultsFile = createTextDefaultsFile(importedDefaults, [{
  id: 'local:test', family: 'Test Sans', fullName: 'Test Sans Regular', source: 'local-access',
}]);
const parsedDefaults = parseTextDefaultsFile(JSON.parse(JSON.stringify(textDefaultsFile)));
assert.equal(parsedDefaults.defaults.typography.fontWeightAdjust, 3);
assert.equal(parsedDefaults.defaults.rotation, -8);
assert.equal(parsedDefaults.fontReferences[0].id, 'local:test');

const embeddedDefaults = {
  ...importedDefaults,
  background: {
    ...importedDefaults.background,
    enabled: true,
    type: 'uploadedImage' as const,
    imageMode: 'followLines' as const,
    image: {
      id: 'background:test',
      fileName: 'large-background.png',
      sourceMimeType: 'image/png' as const,
      dataUrl: 'data:image/png;base64,' + 'A'.repeat(1_600_000),
      width: 1080,
      height: 1920,
    },
  },
};
const portableFile = createTextDefaultsFile(embeddedDefaults, [{
  id: 'local:test',
  family: 'Test Sans',
  fullName: 'Test Sans Regular',
  source: 'local-access',
  binary: 'data:font/ttf;base64,' + 'A'.repeat(1000),
} as never, {
  id: 'local:unused', family: 'Unused Font', fullName: 'Unused Font Regular', source: 'local-access',
}]);
const portableJson = JSON.stringify(portableFile);
assert.equal(portableJson.includes('data:image/png'), false);
assert.equal(portableJson.includes('data:font/ttf'), false);
assert.equal(portableFile.defaults.background.type, 'none');
assert.equal(portableFile.defaults.background.enabled, false);
assert.equal(portableFile.fontReferences?.length, 1);
assert.equal(portableFile.fontReferences?.[0].id, 'local:test');
const selfImported = await readTextDefaultsFile(new File([portableJson], 'defaults.tgsstyle.json', { type: 'application/json' }));
assert.equal(JSON.stringify(selfImported.defaults), JSON.stringify(portableFile.defaults));
assert.equal(selfImported.defaults.rotation, -8);
assert.deepEqual(selfImported.fontReferences, portableFile.fontReferences);

const existingBeforeRoundTrip = JSON.stringify(state().project.objects);
state().setProjectTextDefaults(selfImported.defaults, selfImported.fontReferences);
assert.equal(JSON.stringify(state().project.objects), existingBeforeRoundTrip);
state().addGraphic('round-trip後');
assert.equal(state().project.objects.at(-1)?.typography.fontSize, 88);
assert.equal(state().project.objects.at(-1)?.typography.fontRefId, 'local:test');

const legacyLargeFile = {
  type: 'text-graphic-studio-text-defaults',
  version: 1,
  defaults: embeddedDefaults,
  fontReferences: portableFile.fontReferences,
};
const legacyImported = await readTextDefaultsFile(new File(
  [JSON.stringify(legacyLargeFile)],
  'legacy-large.tgsstyle.json',
  { type: 'application/json' },
));
assert.equal(legacyImported.defaults.background.image?.dataUrl.length, 1_600_022);
await assert.rejects(
  readTextDefaultsFile(new File(['{'], 'invalid.tgsstyle.json', { type: 'application/json' })),
  /読み取れませんでした/,
);
await assert.rejects(
  readTextDefaultsFile(new File(['x'.repeat(10 * 1024 * 1024 + 1)], 'too-large.tgsstyle.json')),
  /10MB以内/,
);

const roundTrip = normalizeStudioProject(JSON.parse(JSON.stringify(state().getStudioProjectSnapshot())));
assert.equal(roundTrip.projectTextDefaults?.typography.fontWeightAdjust, 3);
assert.equal(roundTrip.projectTextDefaults?.rotation, -8);
assert.equal(roundTrip.frames.at(-1)?.document.objects.at(-1)?.typography.fontWeightAdjust, 3);

const oldProject = { ...roundTrip, projectTextDefaults: undefined };
const derived = normalizeStudioProject(oldProject);
assert.deepEqual(derived.projectTextDefaults, { ...toProjectTextDefaults(derived.frames[0].document.objects[0]), rotation: 0 });
const legacyDefaults = { ...roundTrip.projectTextDefaults };
delete legacyDefaults.rotation;
assert.equal(normalizeStudioProject({ ...roundTrip, projectTextDefaults: legacyDefaults }).projectTextDefaults?.rotation, 0);
const noText = normalizeStudioProject({
  ...oldProject,
  frames: oldProject.frames.map((frame) => ({ ...frame, document: { ...frame.document, objects: [] } })),
}, seeded);
assert.equal(noText.projectTextDefaults?.typography.fontSize, 123);

const lockedFrameId = state().studioProject.activeFrameId;
state().setFrameCompletedLocked(lockedFrameId, true);
const lockedDefaults = JSON.stringify(state().studioProject.projectTextDefaults);
const lockedWeight = state().project.objects[0].typography.fontWeightAdjust;
state().updateObject(state().project.objects[0].id, (object) => ({
  ...object,
  typography: { ...object.typography, fontWeightAdjust: 12 },
}));
assert.equal(state().project.objects[0].typography.fontWeightAdjust, lockedWeight);
assert.equal(JSON.stringify(state().studioProject.projectTextDefaults), lockedDefaults);
state().setFrameCompletedLocked(lockedFrameId, false);
state().toggleObjectFullLock(state().project.objects[0].id);
state().updateObject(state().project.objects[0].id, (object) => ({
  ...object,
  partialStyles: setRangeStyleLeaf(object.partialStyles, 0, 1, 'glyphOffsetX', -20),
}));
assert.equal(JSON.stringify(state().studioProject.projectTextDefaults), lockedDefaults);

console.log(JSON.stringify({ passed: true, checks: 139 }, null, 2));
