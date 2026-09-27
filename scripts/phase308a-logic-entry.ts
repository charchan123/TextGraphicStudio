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
import { calculateHorizontalSliceGeometry, normalizeHorizontalSlice } from '@/src/services/horizontalSlice';
import {
  calculateAdjustedLineBackgroundBounds,
  getLineEdgeAdjustment,
  getLogicalLineEdgeAdjustment,
  inferTextEditRange,
  normalizeLineEdgeAdjustments,
  reconcileTextLineIdentity,
  resolveTextEditRange,
  setLineEdgeAdjustment,
} from '@/src/services/lineEdgeAdjustments';
import { updateGraphicTextContent } from '@/src/services/textContent';
import { isPartialTextStyle, isProjectTextDefaults } from '@/src/services/styleValidation';
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

assert.equal(isPartialTextStyle({ start: 0, end: 1, fontWeightAdjust: 0 }), true);
assert.equal(isPartialTextStyle({ start: 0, end: 1, fontWeightAdjust: 16 }), true);
assert.equal(isPartialTextStyle({ start: 0, end: 1, fontWeightAdjust: 16.5 }), false);
// Compatibility accepts Phase 3.0.13 Lite data long enough to normalize it;
// UI and all new writes remain constrained to the positive-only 0..16 range.
assert.equal(isPartialTextStyle({ start: 0, end: 1, fontWeightAdjust: -1.5 }), true);
const legacyNegativePreset = cloneQuickPartialOperation({ style: { fontSize: 160, fontWeightAdjust: -1.5 } });
assert.equal(legacyNegativePreset.style.fontWeightAdjust, 0);
assert.equal('fontSize' in legacyNegativePreset.style, false);

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

const baseSlice = { enabled: true, leftRatio: 0.2, rightRatio: 0.2 };
const sourceSizeSlice = calculateHorizontalSliceGeometry(1000, 200, 1000, 200, baseSlice);
assert.equal(sourceSizeSlice.sourceLeftWidth, 200);
assert.equal(sourceSizeSlice.sourceCenterWidth, 600);
assert.equal(sourceSizeSlice.sourceRightWidth, 200);
assert.equal(sourceSizeSlice.targetLeftWidth, 200);
assert.equal(sourceSizeSlice.targetCenterWidth, 600);
assert.equal(sourceSizeSlice.targetRightWidth, 200);
const expandedSlice = calculateHorizontalSliceGeometry(1000, 200, 1600, 200, baseSlice);
assert.equal(expandedSlice.targetLeftWidth, 200);
assert.equal(expandedSlice.targetCenterWidth, 1200);
assert.equal(expandedSlice.targetRightWidth, 200);
const shrunkSlice = calculateHorizontalSliceGeometry(1000, 200, 700, 200, baseSlice);
assert.equal(shrunkSlice.targetLeftWidth, 200);
assert.equal(shrunkSlice.targetCenterWidth, 300);
assert.equal(shrunkSlice.targetRightWidth, 200);
const minimumSlice = calculateHorizontalSliceGeometry(1000, 200, 100, 200, baseSlice);
assert.equal(minimumSlice.targetWidth, 401);
assert.equal(minimumSlice.targetCenterWidth, 1);
assert.ok(minimumSlice.targetCenterWidth > 0);
assert.deepEqual(normalizeHorizontalSlice({ enabled: true, leftRatio: 2, rightRatio: -1 }), {
  enabled: true, leftRatio: 0.45, rightRatio: 0,
});

const lineBaseline = calculateAdjustedLineBackgroundBounds({ width: 100, centerX: 100 }, 10, undefined);
assert.deepEqual(lineBaseline, { baselineLeft: 40, baselineRight: 160, left: 40, right: 160, centerX: 100, width: 120 });
const lineLeftInset = calculateAdjustedLineBackgroundBounds({ width: 100, centerX: 100 }, 10, { leftInsetPx: 30, rightInsetPx: 0 });
assert.deepEqual(lineLeftInset, { baselineLeft: 40, baselineRight: 160, left: 70, right: 160, centerX: 115, width: 90 });
const lineRightInset = calculateAdjustedLineBackgroundBounds({ width: 100, centerX: 100 }, 10, { leftInsetPx: 0, rightInsetPx: 30 });
assert.deepEqual(lineRightInset, { baselineLeft: 40, baselineRight: 160, left: 40, right: 130, centerX: 85, width: 90 });
const lineExpanded = calculateAdjustedLineBackgroundBounds({ width: 100, centerX: 100 }, 10, { leftInsetPx: -30, rightInsetPx: -30 });
assert.deepEqual(lineExpanded, { baselineLeft: 40, baselineRight: 160, left: 10, right: 190, centerX: 100, width: 180 });
const lineCollapsed = calculateAdjustedLineBackgroundBounds({ width: 10, centerX: 0 }, 0, { leftInsetPx: 30, rightInsetPx: 30 });
assert.equal(lineCollapsed.width, 1);
let lineAdjustments = setLineEdgeAdjustment(undefined, 'line-b', { leftInsetPx: 30 });
assert.deepEqual(getLineEdgeAdjustment(lineAdjustments, 'line-a'), { leftInsetPx: 0, rightInsetPx: 0 });
assert.deepEqual(getLineEdgeAdjustment(lineAdjustments, 'line-b'), { leftInsetPx: 30, rightInsetPx: 0 });
assert.deepEqual(getLineEdgeAdjustment(lineAdjustments, undefined), { leftInsetPx: 0, rightInsetPx: 0 });
lineAdjustments = setLineEdgeAdjustment(lineAdjustments, 'line-b', { leftInsetPx: 0, rightInsetPx: 0 });
assert.equal(lineAdjustments, undefined);

const logicalLineIds = ['render-a', 'render-blank', 'render-b', 'render-c'];
const logicalLineAdjustments = {
  'render-blank': { leftInsetPx: 17, rightInsetPx: 19 },
  'render-b': { leftInsetPx: 100, rightInsetPx: 100 },
};
const renderableLogicalLineIndexes = [0, 2, 3];
assert.deepEqual(
  renderableLogicalLineIndexes.map((logicalLineIndex) =>
    getLogicalLineEdgeAdjustment(logicalLineAdjustments, logicalLineIds, logicalLineIndex)),
  [
    { leftInsetPx: 0, rightInsetPx: 0 },
    { leftInsetPx: 100, rightInsetPx: 100 },
    { leftInsetPx: 0, rightInsetPx: 0 },
  ],
);
assert.deepEqual(
  getLogicalLineEdgeAdjustment(logicalLineAdjustments, logicalLineIds, 1),
  { leftInsetPx: 17, rightInsetPx: 19 },
);
const consecutiveBlankLineIds = ['consecutive-a', 'blank-one', 'blank-two', 'consecutive-b', 'consecutive-c'];
const consecutiveBlankAdjustments = { 'consecutive-b': { leftInsetPx: -50, rightInsetPx: -50 } };
assert.deepEqual(
  [0, 3, 4].map((logicalLineIndex) =>
    getLogicalLineEdgeAdjustment(consecutiveBlankAdjustments, consecutiveBlankLineIds, logicalLineIndex)),
  [
    { leftInsetPx: 0, rightInsetPx: 0 },
    { leftInsetPx: -50, rightInsetPx: -50 },
    { leftInsetPx: 0, rightInsetPx: 0 },
  ],
);
assert.deepEqual(
  [1, 2].map((logicalLineIndex) =>
    getLogicalLineEdgeAdjustment(consecutiveBlankAdjustments, consecutiveBlankLineIds, logicalLineIndex)),
  [
    { leftInsetPx: 0, rightInsetPx: 0 },
    { leftInsetPx: 0, rightInsetPx: 0 },
  ],
);
assert.deepEqual(
  [1, 2].map((logicalLineIndex) =>
    getLogicalLineEdgeAdjustment(
      { 'leading-a': { leftInsetPx: 8, rightInsetPx: 3 } },
      ['leading-blank', 'leading-a', 'trailing-blank'],
      logicalLineIndex,
    )),
  [
    { leftInsetPx: 8, rightInsetPx: 3 },
    { leftInsetPx: 0, rightInsetPx: 0 },
  ],
);
const blankFilledIdentity = reconcileTextLineIdentity({
  oldText: 'ここに\n\n入力して\nください。',
  newText: 'ここに\nテキストを\n入力して\nください。',
  oldLineIds: logicalLineIds,
  oldAdjustments: logicalLineAdjustments,
});
assert.deepEqual(blankFilledIdentity.textLineIds, logicalLineIds);
assert.deepEqual(
  getLogicalLineEdgeAdjustment(blankFilledIdentity.lineEdgeAdjustments, blankFilledIdentity.textLineIds, 2),
  { leftInsetPx: 100, rightInsetPx: 100 },
);
assert.deepEqual(
  getLogicalLineEdgeAdjustment(blankFilledIdentity.lineEdgeAdjustments, blankFilledIdentity.textLineIds, 1),
  { leftInsetPx: 17, rightInsetPx: 19 },
);
const blankInsertedIdentity = reconcileTextLineIdentity({
  oldText: 'A\nB\nC',
  newText: 'A\n\nB\nC',
  oldLineIds: ['insert-blank-a', 'insert-blank-b', 'insert-blank-c'],
  oldAdjustments: { 'insert-blank-b': { leftInsetPx: -25, rightInsetPx: 12 } },
});
assert.equal(blankInsertedIdentity.textLineIds[2], 'insert-blank-b');
assert.deepEqual(
  getLogicalLineEdgeAdjustment(blankInsertedIdentity.lineEdgeAdjustments, blankInsertedIdentity.textLineIds, 2),
  { leftInsetPx: -25, rightInsetPx: 12 },
);
assert.deepEqual(
  getLogicalLineEdgeAdjustment(blankInsertedIdentity.lineEdgeAdjustments, blankInsertedIdentity.textLineIds, 1),
  { leftInsetPx: 0, rightInsetPx: 0 },
);

const identityIds = ['id-a', 'id-b', 'id-c', 'id-d'];
const identityAdjustments = { 'id-c': { leftInsetPx: -50, rightInsetPx: -50 } };
const reconcile = (
  oldText: string,
  newText: string,
  oldLineIds: readonly string[],
  oldAdjustments?: Record<string, { leftInsetPx: number; rightInsetPx: number }>,
) => reconcileTextLineIdentity({ oldText, newText, oldLineIds, oldAdjustments });
const insertedIdentity = reconcile('A\nB\nC\nD', 'A\nB\nX\nC\nD', identityIds, identityAdjustments);
assert.deepEqual(insertedIdentity.textLineIds.filter((id) => identityIds.includes(id)), identityIds);
assert.equal(insertedIdentity.textLineIds[3], 'id-c');
assert.deepEqual(getLineEdgeAdjustment(insertedIdentity.lineEdgeAdjustments, 'id-c'), { leftInsetPx: -50, rightInsetPx: -50 });
assert.deepEqual(getLineEdgeAdjustment(insertedIdentity.lineEdgeAdjustments, insertedIdentity.textLineIds[2]), { leftInsetPx: 0, rightInsetPx: 0 });
const deletedIdentity = reconcile('A\nB\nC\nD', 'A\nB\nD', identityIds, identityAdjustments);
assert.deepEqual(deletedIdentity.textLineIds, ['id-a', 'id-b', 'id-d']);
assert.equal(deletedIdentity.lineEdgeAdjustments, undefined);
const aboveDeletedIdentity = reconcile('A\nB\nC\nD', 'A\nC\nD', identityIds, identityAdjustments);
assert.equal(aboveDeletedIdentity.textLineIds[1], 'id-c');
assert.deepEqual(getLineEdgeAdjustment(aboveDeletedIdentity.lineEdgeAdjustments, 'id-c'), { leftInsetPx: -50, rightInsetPx: -50 });
const editedIdentity = reconcile('A\n年間288試合！\nC', 'A\n年間300試合！\nC', ['edit-a', 'edit-target', 'edit-c'], {
  'edit-target': { leftInsetPx: -50, rightInsetPx: -50 },
});
assert.equal(editedIdentity.textLineIds[1], 'edit-target');
assert.deepEqual(getLineEdgeAdjustment(editedIdentity.lineEdgeAdjustments, 'edit-target'), { leftInsetPx: -50, rightInsetPx: -50 });
const topInsertedIdentity = reconcile('A\nB\nC', 'TITLE\nA\nB\nC', ['top-a', 'top-b', 'top-c'], {
  'top-c': { leftInsetPx: 30, rightInsetPx: -20 },
});
assert.equal(topInsertedIdentity.textLineIds[3], 'top-c');
assert.deepEqual(getLineEdgeAdjustment(topInsertedIdentity.lineEdgeAdjustments, 'top-c'), { leftInsetPx: 30, rightInsetPx: -20 });
const duplicateIdentity = reconcile('A\n同じ\n同じ\nD', 'TITLE\nA\n同じ\n同じ\nD', ['dup-a', 'dup-first', 'dup-second', 'dup-d'], {
  'dup-second': { leftInsetPx: -40, rightInsetPx: 0 },
});
assert.equal(duplicateIdentity.textLineIds[2], 'dup-first');
assert.equal(duplicateIdentity.textLineIds[3], 'dup-second');
assert.deepEqual(getLineEdgeAdjustment(duplicateIdentity.lineEdgeAdjustments, 'dup-second'), { leftInsetPx: -40, rightInsetPx: 0 });
const multipleInsertedIdentity = reconcile('A\nB\nC', 'A\nX\nY\nB\nC', ['multi-a', 'multi-b', 'multi-c']);
assert.equal(multipleInsertedIdentity.textLineIds[3], 'multi-b');
assert.equal(multipleInsertedIdentity.textLineIds[4], 'multi-c');
const bottomInsertedIdentity = reconcile('A\nB\nC', 'A\nB\nC\nBOTTOM', ['bottom-a', 'bottom-b', 'bottom-c']);
assert.deepEqual(bottomInsertedIdentity.textLineIds.slice(0, 3), ['bottom-a', 'bottom-b', 'bottom-c']);
const multipleDeletedIdentity = reconcile('A\nX\nY\nB\nC', 'A\nB\nC', ['del-a', 'del-x', 'del-y', 'del-b', 'del-c']);
assert.deepEqual(multipleDeletedIdentity.textLineIds, ['del-a', 'del-b', 'del-c']);
const splitIdentity = reconcile('ABCDEF', 'ABC\nDEF', ['split-source'], { 'split-source': { leftInsetPx: 12, rightInsetPx: 4 } });
assert.equal(splitIdentity.textLineIds[0], 'split-source');
assert.notEqual(splitIdentity.textLineIds[1], 'split-source');
const mergeIdentity = reconcile('ABC\nDEF', 'ABCDEF', ['merge-first', 'merge-second'], { 'merge-first': { leftInsetPx: 7, rightInsetPx: 3 } });
assert.equal(mergeIdentity.textLineIds[0], 'merge-first');
assert.deepEqual(getLineEdgeAdjustment(mergeIdentity.lineEdgeAdjustments, 'merge-first'), { leftInsetPx: 7, rightInsetPx: 3 });
assert.deepEqual(getLineEdgeAdjustment(mergeIdentity.lineEdgeAdjustments, 'merge-second'), { leftInsetPx: 0, rightInsetPx: 0 });

const blankDeletedIdentity = reconcile(
  'ここにテキストを\n\nテストです。\nこれはテスト。',
  'ここにテキストを\nテストです。\nこれはテスト。',
  ['blank-head', 'blank-line', 'blank-target', 'blank-tail'],
  { 'blank-target': { leftInsetPx: -50, rightInsetPx: -50 } },
);
assert.deepEqual(blankDeletedIdentity.textLineIds, ['blank-head', 'blank-target', 'blank-tail']);
assert.deepEqual(getLineEdgeAdjustment(blankDeletedIdentity.lineEdgeAdjustments, 'blank-target'), { leftInsetPx: -50, rightInsetPx: -50 });
assert.deepEqual(getLineEdgeAdjustment(blankDeletedIdentity.lineEdgeAdjustments, 'blank-tail'), { leftInsetPx: 0, rightInsetPx: 0 });

const punctuationIdentity = reconcile(
  'ここにテキストを\nテストです\nテストです。\nこれはテスト。',
  'ここにテキストを\nテストです。\nテストです。\nこれはテスト。',
  ['punct-head', 'punct-first', 'punct-second', 'punct-tail'],
  { 'punct-second': { leftInsetPx: -50, rightInsetPx: -50 } },
);
assert.deepEqual(punctuationIdentity.textLineIds, ['punct-head', 'punct-first', 'punct-second', 'punct-tail']);
assert.deepEqual(getLineEdgeAdjustment(punctuationIdentity.lineEdgeAdjustments, 'punct-second'), { leftInsetPx: -50, rightInsetPx: -50 });
assert.deepEqual(getLineEdgeAdjustment(punctuationIdentity.lineEdgeAdjustments, 'punct-first'), { leftInsetPx: 0, rightInsetPx: 0 });

const pasteIdentity = reconcile(
  'A\nBfoo\nC\nD',
  'A\nBX\nY\nZfoo\nC\nD',
  ['paste-a', 'paste-b', 'paste-c', 'paste-d'],
  { 'paste-b': { leftInsetPx: 9, rightInsetPx: 2 } },
);
assert.equal(pasteIdentity.textLineIds[1], 'paste-b');
assert.equal(pasteIdentity.textLineIds[4], 'paste-c');
assert.equal(pasteIdentity.textLineIds[5], 'paste-d');
assert.deepEqual(getLineEdgeAdjustment(pasteIdentity.lineEdgeAdjustments, 'paste-b'), { leftInsetPx: 9, rightInsetPx: 2 });

const selectionRange = resolveTextEditRange('A\nB\nC\nD', 'A\nX\nD', {
  selectionStart: 2,
  selectionEnd: 6,
  inputType: 'insertText',
  data: 'X\n',
});
assert.deepEqual(selectionRange, { oldStart: 2, oldEnd: 6, newStart: 2, newEnd: 4, inputType: 'insertText' });
const selectionReplacedIdentity = reconcileTextLineIdentity({
  oldText: 'A\nB\nC\nD',
  newText: 'A\nX\nD',
  oldLineIds: ['replace-a', 'replace-b', 'replace-c', 'replace-d'],
  oldAdjustments: { 'replace-d': { leftInsetPx: 14, rightInsetPx: 6 } },
  editRange: selectionRange,
});
assert.equal(selectionReplacedIdentity.textLineIds[0], 'replace-a');
assert.equal(selectionReplacedIdentity.textLineIds[2], 'replace-d');
assert.notEqual(selectionReplacedIdentity.textLineIds[1], 'replace-b');
assert.notEqual(selectionReplacedIdentity.textLineIds[1], 'replace-c');
assert.deepEqual(getLineEdgeAdjustment(selectionReplacedIdentity.lineEdgeAdjustments, 'replace-d'), { leftInsetPx: 14, rightInsetPx: 6 });

assert.deepEqual(inferTextEditRange('A\nB\nC\nD', 'A\nB\nX\nC\nD'), {
  oldStart: 4, oldEnd: 4, newStart: 4, newEnd: 6,
});
const japaneseRange = resolveTextEditRange('日本語入力', '日本語の入力', {
  selectionStart: 3,
  selectionEnd: 3,
  inputType: 'insertCompositionText',
  data: 'の',
});
assert.equal(japaneseRange.inputType, 'insertCompositionText');
const japaneseIdentity = reconcileTextLineIdentity({
  oldText: '日本語入力',
  newText: '日本語の入力',
  oldLineIds: ['japanese-line'],
  oldAdjustments: { 'japanese-line': { leftInsetPx: 18, rightInsetPx: -3 } },
  editRange: japaneseRange,
});
assert.deepEqual(japaneseIdentity.textLineIds, ['japanese-line']);
assert.deepEqual(getLineEdgeAdjustment(japaneseIdentity.lineEdgeAdjustments, 'japanese-line'), { leftInsetPx: 18, rightInsetPx: -3 });
assert.deepEqual(normalizeLineEdgeAdjustments([
  { leftInsetPx: 0, rightInsetPx: 0 },
  { leftInsetPx: 25, rightInsetPx: -5 },
], ['legacy-a', 'legacy-b']), { 'legacy-b': { leftInsetPx: 25, rightInsetPx: -5 } });

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
const legacyNegativeDefaults = {
  ...state().studioProject.projectTextDefaults!,
  typography: {
    ...state().studioProject.projectTextDefaults!.typography,
    fontWeightAdjust: -1.5,
  },
};
assert.equal(isProjectTextDefaults(legacyNegativeDefaults), true);
assert.equal(toProjectTextDefaults(legacyNegativeDefaults).typography.fontWeightAdjust, 0);

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

const sliceObjectId = state().project.objects[0].id;
const previousHorizontalSlice = state().project.objects[0].background.horizontalSlice;
state().updateObject(sliceObjectId, (object) => ({
  ...object,
  background: { ...object.background, horizontalSlice: { enabled: true, leftRatio: 0.2, rightRatio: 0.15 } },
}));
assert.deepEqual(state().project.objects[0].background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.deepEqual(state().studioProject.projectTextDefaults?.background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
state().undo();
assert.deepEqual(state().project.objects[0].background.horizontalSlice, previousHorizontalSlice);
state().redo();
assert.deepEqual(state().project.objects[0].background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.equal('lineEdgeAdjustments' in (state().studioProject.projectTextDefaults?.background ?? {}), false);

state().addFrame();
assert.equal(state().textSelection, null);
assert.equal(state().project.objects[0].text, 'ここにテキストを入力してください。');
assert.equal(state().project.objects[0].typography.fontWeightAdjust, 6);
assert.equal(state().project.objects[0].transform.rotation, -8);
assert.deepEqual(state().project.objects[0].background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.equal(state().project.objects[0].background.lineEdgeAdjustments, undefined);
state().addGraphic('追加Text');
assert.equal(state().project.objects.at(-1)?.typography.fontWeightAdjust, 6);
assert.equal(state().project.objects.at(-1)?.transform.rotation, -8);
assert.deepEqual(state().project.objects.at(-1)?.background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.equal(state().project.objects.at(-1)?.background.lineEdgeAdjustments, undefined);

const edgeObjectId = state().project.objects[0].id;
state().updateObject(edgeObjectId, (object) => updateGraphicTextContent(object, 'A\nB\nC\nD'));
const edgeLineIds = state().project.objects[0].textLineIds!;
const edgeCLineId = edgeLineIds[2];
const edgePastCount = state().past.length;
state().beginTransaction();
state().updateObject(edgeObjectId, (object) => ({
  ...object,
  background: { ...object.background, lineEdgeAdjustments: setLineEdgeAdjustment(object.background.lineEdgeAdjustments, edgeCLineId, { leftInsetPx: 30 }) },
}), false);
state().finishTransaction();
assert.equal(state().past.length, edgePastCount + 1);
assert.deepEqual(state().project.objects[0].background.lineEdgeAdjustments, {
  [edgeCLineId]: { leftInsetPx: 30, rightInsetPx: 0 },
});
assert.equal('lineEdgeAdjustments' in (state().studioProject.projectTextDefaults?.background ?? {}), false);
state().undo();
assert.equal(state().project.objects[0].background.lineEdgeAdjustments, undefined);
state().redo();
assert.equal(state().project.objects[0].background.lineEdgeAdjustments?.[edgeCLineId].leftInsetPx, 30);

const beforeLineInsert = structuredClone(state().project.objects[0]);
state().updateObject(edgeObjectId, (object) => updateGraphicTextContent(object, 'A\nB\nX\nC\nD'));
assert.equal(state().project.objects[0].textLineIds?.[3], edgeCLineId);
assert.equal(state().project.objects[0].background.lineEdgeAdjustments?.[edgeCLineId].leftInsetPx, 30);
assert.deepEqual(getLineEdgeAdjustment(state().project.objects[0].background.lineEdgeAdjustments, state().project.objects[0].textLineIds?.[2]), { leftInsetPx: 0, rightInsetPx: 0 });
state().undo();
assert.equal(state().project.objects[0].text, beforeLineInsert.text);
assert.deepEqual(state().project.objects[0].textLineIds, beforeLineInsert.textLineIds);
assert.deepEqual(state().project.objects[0].background.lineEdgeAdjustments, beforeLineInsert.background.lineEdgeAdjustments);
state().redo();
assert.equal(state().project.objects[0].text, 'A\nB\nX\nC\nD');
assert.equal(state().project.objects[0].textLineIds?.[3], edgeCLineId);
assert.equal(state().project.objects[0].background.lineEdgeAdjustments?.[edgeCLineId].leftInsetPx, 30);

const rowResetPastCount = state().past.length;
state().updateObject(edgeObjectId, (object) => ({
  ...object,
  background: { ...object.background, lineEdgeAdjustments: setLineEdgeAdjustment(object.background.lineEdgeAdjustments, edgeCLineId, { leftInsetPx: 0, rightInsetPx: 0 }) },
}));
assert.equal(state().past.length, rowResetPastCount + 1);
assert.equal(state().project.objects[0].background.lineEdgeAdjustments, undefined);
state().undo();
assert.equal(state().project.objects[0].background.lineEdgeAdjustments?.[edgeCLineId].leftInsetPx, 30);

state().updateObject(edgeObjectId, (object) => ({
  ...object,
  background: {
    ...object.background,
    lineEdgeAdjustments: setLineEdgeAdjustment(
      setLineEdgeAdjustment(object.background.lineEdgeAdjustments, object.textLineIds![0], { leftInsetPx: -20 }),
      edgeCLineId,
      { leftInsetPx: 30, rightInsetPx: 15 },
    ),
  },
}));
const allResetPastCount = state().past.length;
state().updateObject(edgeObjectId, (object) => ({
  ...object,
  background: { ...object.background, lineEdgeAdjustments: undefined },
}));
assert.equal(state().past.length, allResetPastCount + 1);
assert.equal(state().project.objects[0].background.lineEdgeAdjustments, undefined);
state().undo();
assert.equal(state().project.objects[0].background.lineEdgeAdjustments?.[edgeCLineId].rightInsetPx, 15);

state().selectObject(edgeObjectId);
state().duplicateSelected();
const duplicatedEdgeObject = state().project.objects.find((object) => object.id === state().selectedId)!;
assert.deepEqual(duplicatedEdgeObject.background.lineEdgeAdjustments, state().project.objects[0].background.lineEdgeAdjustments);
assert.notEqual(duplicatedEdgeObject.background.lineEdgeAdjustments, state().project.objects[0].background.lineEdgeAdjustments);
assert.deepEqual(duplicatedEdgeObject.textLineIds, state().project.objects[0].textLineIds);
assert.notEqual(duplicatedEdgeObject.textLineIds, state().project.objects[0].textLineIds);

const sourceSnapshot = state().getStudioProjectSnapshot();
const sourceFrameId = sourceSnapshot.activeFrameId;
const sourceObject = sourceSnapshot.frames.find((frame) => frame.frameId === sourceFrameId)!.document.objects[0];
state().duplicateFrame(sourceFrameId);
assert.deepEqual(state().project.objects[0].typography, sourceObject.typography);
assert.deepEqual(state().project.objects[0].partialStyles, sourceObject.partialStyles);
assert.deepEqual(state().project.objects[0].background.lineEdgeAdjustments, sourceObject.background.lineEdgeAdjustments);
assert.notEqual(state().project.objects[0].background.lineEdgeAdjustments, sourceObject.background.lineEdgeAdjustments);
assert.deepEqual(state().project.objects[0].textLineIds, sourceObject.textLineIds);
assert.notEqual(state().project.objects[0].textLineIds, sourceObject.textLineIds);

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
const legacyNegativeDefaultsFile = JSON.parse(JSON.stringify(textDefaultsFile));
legacyNegativeDefaultsFile.defaults.typography.fontWeightAdjust = -1.5;
assert.equal(parseTextDefaultsFile(legacyNegativeDefaultsFile).defaults.typography.fontWeightAdjust, 0);
assert.equal(parsedDefaults.defaults.rotation, -8);
assert.equal(parsedDefaults.fontReferences[0].id, 'local:test');

const embeddedDefaults = {
  ...importedDefaults,
  background: {
    ...importedDefaults.background,
    enabled: true,
    type: 'uploadedImage' as const,
    imageMode: 'followLines' as const,
    horizontalSlice: { enabled: true, leftRatio: 0.2, rightRatio: 0.15 },
    lineEdgeAdjustments: { 'style-line': { leftInsetPx: 35, rightInsetPx: 0 } },
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
assert.deepEqual(portableFile.defaults.background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.equal('lineEdgeAdjustments' in portableFile.defaults.background, false);
assert.equal(portableJson.includes('leftInsetPx'), false);
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
assert.deepEqual(roundTrip.projectTextDefaults?.background.horizontalSlice, { enabled: true, leftRatio: 0.2, rightRatio: 0.15 });
assert.equal('lineEdgeAdjustments' in (roundTrip.projectTextDefaults?.background ?? {}), false);
assert.equal(roundTrip.frames.some((frame) => frame.document.objects.some((object) => Object.values(object.background.lineEdgeAdjustments ?? {}).some((adjustment) => adjustment.leftInsetPx === 30))), true);
assert.equal(roundTrip.frames.every((frame) => frame.document.objects.every((object) => object.textLineIds?.length === object.text.replace(/\r\n?/g, '\n').split('\n').length)), true);
assert.equal(roundTrip.frames.at(-1)?.document.objects.at(-1)?.typography.fontWeightAdjust, 3);

const legacyNegativeProject = JSON.parse(JSON.stringify(roundTrip));
legacyNegativeProject.projectTextDefaults.typography.fontWeightAdjust = -1.5;
legacyNegativeProject.frames[0].document.objects[0].typography.fontWeightAdjust = -1;
legacyNegativeProject.frames[0].document.objects[0].partialStyles = [
  { start: 0, end: 1, fontWeightAdjust: -2 },
];
const normalizedLegacyNegativeProject = normalizeStudioProject(legacyNegativeProject);
assert.equal(normalizedLegacyNegativeProject.projectTextDefaults?.typography.fontWeightAdjust, 0);
assert.equal(normalizedLegacyNegativeProject.frames[0].document.objects[0].typography.fontWeightAdjust, 0);
assert.equal(normalizedLegacyNegativeProject.frames[0].document.objects[0].partialStyles[0].fontWeightAdjust, 0);

const oldProject = { ...roundTrip, projectTextDefaults: undefined };
const derived = normalizeStudioProject(oldProject);
assert.deepEqual(derived.projectTextDefaults, { ...toProjectTextDefaults(derived.frames[0].document.objects[0]), rotation: 0 });
const legacyDefaults = { ...roundTrip.projectTextDefaults };
delete legacyDefaults.rotation;
assert.equal(normalizeStudioProject({ ...roundTrip, projectTextDefaults: legacyDefaults }).projectTextDefaults?.rotation, 0);
const legacySliceProject = structuredClone(roundTrip);
delete legacySliceProject.projectTextDefaults!.background.horizontalSlice;
legacySliceProject.frames.forEach((frame) => frame.document.objects.forEach((object) => { delete object.background.horizontalSlice; }));
const normalizedLegacySliceProject = normalizeStudioProject(legacySliceProject);
assert.equal(normalizedLegacySliceProject.projectTextDefaults?.background.horizontalSlice, undefined);
assert.equal(normalizedLegacySliceProject.frames[0].document.objects[0].background.horizontalSlice, undefined);
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

console.log(JSON.stringify({ passed: true, checks: 250 }, null, 2));
