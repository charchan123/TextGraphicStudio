import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const work = await mkdtemp(join(tmpdir(), 'tgs-phase308a-'));
const output = join(work, 'check.mjs');
try {
  await build({
    absWorkingDir: process.cwd(),
    entryPoints: ['scripts/phase308a-logic-entry.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: output,
    logLevel: 'silent',
  });
  await import(pathToFileURL(output).href + '?run=' + Date.now());

  const renderer = await readFile('src/canvas/StyledGraphicText.ts', 'utf8');
  const graphicRenderer = await readFile('src/canvas/graphicTextRenderer.ts', 'utf8');
  const backgroundRenderer = await readFile('src/canvas/backgroundRenderer.ts', 'utf8');
  const persistence = await readFile('src/services/persistence.ts', 'utf8');
  const textPanel = await readFile('src/components/panels/TextPanel.tsx', 'utf8');
  const partialStyleEditor = await readFile('src/components/panels/PartialStyleEditor.tsx', 'utf8');
  const stylePanel = await readFile('src/components/panels/StylePanel.tsx', 'utf8');
  const editorStore = await readFile('src/store/editorStore.ts', 'utf8');
  const fabricCanvas = await readFile('src/canvas/FabricCanvas.tsx', 'utf8');
  const toolbar = await readFile('src/components/EditorToolbar.tsx', 'utf8');
  const previewDialog = await readFile('src/components/OutputPreviewDialog.tsx', 'utf8');
  const editorApp = await readFile('src/components/EditorApp.tsx', 'utf8');
  const fontPicker = await readFile('src/components/FontPicker.tsx', 'utf8');
  const globalCss = await readFile('app/globals.css', 'utf8');
  const keyboardShortcuts = await readFile('src/hooks/useKeyboardShortcuts.ts', 'utf8');
  const historyShortcuts = await readFile('src/services/historyShortcuts.ts', 'utf8');
  const quickPartialPresets = await readFile('src/services/quickPartialPresets.ts', 'utf8');
  const partialHorizontalPosition = await readFile('src/services/partialHorizontalPosition.ts', 'utf8');
  const horizontalSlice = await readFile('src/services/horizontalSlice.ts', 'utf8');
  const textBackgroundEditor = await readFile('src/components/panels/TextBackgroundEditor.tsx', 'utf8');
  const documentData = await readFile('src/services/documentData.ts', 'utf8');
  const styleValidation = await readFile('src/services/styleValidation.ts', 'utf8');
  const textDefaultsFileService = await readFile('src/services/textDefaultsFileService.ts', 'utf8');
  const lineEdgeAdjustments = await readFile('src/services/lineEdgeAdjustments.ts', 'utf8');
  const textContent = await readFile('src/services/textContent.ts', 'utf8');
  const textDefaults = await readFile('src/services/textDefaults.ts', 'utf8');
  assert.match(renderer, /drawLeft = left \+ \(declaration\.deltaX \?\? 0\)/);
  assert.match(renderer, /box\.left \+ deltaX - weightAdjust/);
  assert.match(renderer, /strokeStyle = context\.fillStyle/);
  assert.match(renderer, /strokeWidth: Number\(complete\.strokeWidth \?\? 0\) \+ weightAdjust \* 2/);
  assert.doesNotMatch(renderer, /renderOpticallyThinnedFill/);
  assert.doesNotMatch(renderer, /globalCompositeOperation = 'destination-out'/);
  assert.doesNotMatch(renderer, /weightAdjust < 0/);
  assert.match(graphicRenderer, /\|\| \(model\.typography\.fontWeightAdjust \?\? 0\) > 0/);
  assert.match(styleValidation, /bounded\(fontWeightAdjust, 0, 16\)/);
  assert.match(stylePanel, /label="文字の太さ補正"[\s\S]*min=\{0\} max=\{16\}/);
  assert.match(partialStyleEditor, /selected\.typography\.fontWeightAdjust \?\? 0, 0, 16, 'px'/);
  assert.doesNotMatch(stylePanel, /マイナスで細く/);
  assert.match(graphicRenderer, /range\.glyphOffsetX !== undefined \|\| range\.fontWeightAdjust !== undefined/);
  assert.match(backgroundRenderer, /createFollowLinesBackground\(style, lines, lineIds, outputScale\)/);
  assert.match(backgroundRenderer, /drawHorizontalThreeSlice/);
  assert.match(backgroundRenderer, /style\.horizontalSlice === undefined/);
  assert.match(backgroundRenderer, /drawThreeSlice\(context, style, width, height\)/);
  assert.match(backgroundRenderer, /drawUploadedLine\(context, style, entry\.width, entry\.height\)/);
  assert.match(backgroundRenderer, /createHorizontalSliceBackground\(style, width, height, outputScale\)/);
  assert.match(horizontalSlice, /targetLeftWidth \+ targetRightWidth \+ 1/);
  assert.match(horizontalSlice, /targetCenterWidth: Math\.max\(1,/);
  assert.equal(textBackgroundEditor.includes('label="横3分割伸縮"'), true);
  assert.equal(textBackgroundEditor.includes('label="左端固定"'), true);
  assert.equal(textBackgroundEditor.includes('label="右端固定"'), true);
  assert.match(documentData, /horizontalSlice: background\.horizontalSlice/);
  assert.match(styleValidation, /value\.horizontalSlice\.leftRatio/);
  assert.equal(textDefaultsFileService.includes('delete background.horizontalSlice'), false);
  assert.match(backgroundRenderer, /calculateAdjustedLineBackgroundBounds/);
  assert.match(renderer, /logicalLineIndex: lineIndex/);
  assert.match(backgroundRenderer, /getLogicalLineEdgeAdjustment\(style\.lineEdgeAdjustments, lineIds, line\.logicalLineIndex\)/);
  assert.doesNotMatch(backgroundRenderer, /lineIds\[lineIndex\]/);
  assert.match(graphicRenderer, /model\.textLineIds/);
  assert.match(backgroundRenderer, /line: \{ \.\.\.line, centerX: adjusted\.centerX \}/);
  assert.match(backgroundRenderer, /explicitSliceWidth\(style, adjusted\.width, height\)/);
  assert.match(lineEdgeAdjustments, /baselineLeft \+ current\.leftInsetPx/);
  assert.match(lineEdgeAdjustments, /baselineRight - current\.rightInsetPx/);
  assert.match(lineEdgeAdjustments, /width: Math\.max\(1, right - left\)/);
  assert.doesNotMatch(lineEdgeAdjustments, /findExactLineMatches|oldLines\[[^\]]+\] === newLines/);
  assert.match(lineEdgeAdjustments, /inferTextEditRange/);
  assert.match(lineEdgeAdjustments, /oldText\.slice\(0, editRange\.oldStart\)/);
  assert.match(lineEdgeAdjustments, /Align from the end of the unchanged suffix/);
  assert.match(lineEdgeAdjustments, /editStartsInsideSourceLine \|\| singleLineReplacement \|\| collapsedInsertion/);
  assert.match(lineEdgeAdjustments, /normalizeLineEdgeAdjustments\(normalizedAdjustments, resolvedIds\)/);
  assert.match(textContent, /reconcileTextLineIdentity/);
  assert.match(textContent, /resolveTextEditRange/);
  assert.match(textContent, /textLineIds: lineIdentity\.textLineIds/);
  assert.match(textDefaults, /delete background\.lineEdgeAdjustments/);
  assert.equal(textBackgroundEditor.includes("(background.imageMode ?? 'fixed') === 'followLines'"), true);
  assert.equal(textBackgroundEditor.includes('行ごとの背景調整'), true);
  assert.equal(textBackgroundEditor.includes('左端補正'), true);
  assert.equal(textBackgroundEditor.includes('右端補正'), true);
  assert.equal(textBackgroundEditor.includes('すべてリセット'), true);
  assert.match(persistence, /value\.projectTextDefaults === undefined \|\| isProjectTextDefaults/);
  assert.equal(textPanel.includes('if (start >= end) return;'), true);
  assert.equal(textPanel.includes('frameId: activeFrameId'), true);
  assert.equal(partialStyleEditor.includes('open={expanded}'), true);
  assert.equal(partialStyleEditor.includes('open={valid}'), false);
  assert.equal(partialStyleEditor.includes('setTextSelection'), false);
  assert.equal(editorStore.includes('textSelection.frameId === state.studioProject.activeFrameId'), true);
  assert.equal(textPanel.includes('setPartialStyleExpanded(true)'), false);
  assert.equal(textPanel.includes('onBeforeInput='), true);
  assert.equal(textPanel.includes('inputType: inputEvent.inputType'), true);
  assert.equal(textPanel.includes('onBeforeInput={(event) => {\n            event.preventDefault()'), false);
  assert.equal(partialStyleEditor.includes('onToggle={(event) => onExpandedChange(event.currentTarget.open)}'), true);
  assert.equal(fabricCanvas.includes('suppressSelectionClearRef.current = true'), true);
  assert.equal(fabricCanvas.includes('if (!suppressSelectionClearRef.current) useEditorStore.getState().selectObject(null)'), true);
  assert.equal(toolbar.includes('storyboard-layout-controls'), false);
  assert.equal(toolbar.includes("onStoryboardPlacementChange(placement)"), true);
  assert.equal(toolbar.includes("['left', '左に表示', PanelLeft]"), true);
  assert.equal(toolbar.includes("['top', '上に表示', PanelTop]"), true);
  assert.equal(toolbar.includes("['hidden', '非表示', EyeOff]"), true);
  assert.match(globalCss, /\.editor-toolbar \{ display: flex;/);
  assert.match(globalCss, /\.toolbar-export \{[^}]*overflow-x: auto;/);
  assert.match(globalCss, /\.brand-block \{ flex: 0 0 252px;/);
  assert.doesNotMatch(globalCss, /@media \(max-width: 1280px\)[^{]*\{[^}]*\.brand-meta \{ display: none;/);
  assert.match(globalCss, /@media \(max-width: 1040px\)[\s\S]*\.brand-block \{ flex: 0 0 184px; \}[\s\S]*\.brand-meta \{ display: none; \}/);
  assert.match(globalCss, /@media \(max-width: 860px\)[\s\S]*\.brand-block \{ flex: 0 0 36px; \}[\s\S]*\.brand-copy \{ display: none; \}/);
  assert.equal(toolbar.includes('<svg viewBox="0 0 36 36"'), true);
  assert.equal(toolbar.includes('brand-edit-frame'), true);
  assert.equal(toolbar.includes('brand-type-glyph'), true);
  assert.equal(toolbar.includes('brand-text-caret'), true);
  assert.equal(toolbar.includes('brand-selection-handle'), true);
  assert.equal(toolbar.includes('<div className="brand-mark" aria-hidden="true">T</div>'), false);
  assert.equal(toolbar.includes('aria-label="新規"'), true);
  assert.equal(previewDialog.includes("window.addEventListener('keydown', handleKeyDown, true)"), true);
  assert.equal(previewDialog.includes('getFrameDisplayLabel(frame.frameIndex)'), true);
  assert.equal(previewDialog.includes("aria-current={current ? 'true' : undefined}"), true);
  assert.equal(editorApp.includes('onSelectFrame={goToOutputPreviewFrame}'), true);
  assert.equal(editorApp.includes("navigateOutputPreview('previous')"), true);
  assert.equal(editorApp.includes("navigateOutputPreview('next')"), true);
  assert.equal(editorApp.includes('renderProjectThumbnailDataUrl(candidate.document, 96, 96)'), true);
  const previewNavigationSource = editorApp.slice(editorApp.indexOf('const goToOutputPreviewFrame'), editorApp.indexOf('const handleProjectExport'));
  assert.equal(previewNavigationSource.includes('setActiveFrame'), false);
  assert.equal(fontPicker.includes('const reloadLocalFonts = () => loadLocalFonts(false)'), true);
  assert.equal(fontPicker.includes('setAvailable(fonts)'), true);
  assert.equal(fontPicker.includes('PCフォント一覧を再読み込み'), true);
  assert.equal(fontPicker.includes('新しくインストールしたフォントが表示されない場合はChromeを再起動してください'), true);
  assert.equal(fontPicker.includes('.ttc'), false);
  assert.equal((keyboardShortcuts.match(/window\.addEventListener\('keydown', onKeyDown\)/g) ?? []).length, 1);
  assert.equal((keyboardShortcuts.match(/window\.removeEventListener\('keydown', onKeyDown\)/g) ?? []).length, 1);
  assert.equal(keyboardShortcuts.includes('handleHistoryShortcut(event, { undo: performUndo, redo: performRedo })'), true);
  assert.equal(keyboardShortcuts.indexOf('handleHistoryShortcut(event') < keyboardShortcuts.indexOf('isEditableTarget(event.target)'), true);
  assert.equal(keyboardShortcuts.includes('state.undo()'), false);
  assert.equal(keyboardShortcuts.includes('state.redo()'), false);
  assert.equal(historyShortcuts.includes('if (event.repeat) return true;'), true);
  assert.equal(historyShortcuts.includes('event.preventDefault();'), true);
  assert.equal(historyShortcuts.includes('event.stopPropagation();'), true);
  assert.equal(toolbar.includes('onClick={performUndo}'), true);
  assert.equal(toolbar.includes('onClick={performRedo}'), true);
  assert.equal(quickPartialPresets.includes('delete cloned.fontSize'), true);
  assert.equal(quickPartialPresets.includes('const style = cloneStyle(operation.style)'), true);
  assert.equal(partialStyleEditor.includes('style.fontSize ='), false);
  assert.equal(partialStyleEditor.includes('style.glyphOffsetX = glyphOffsetX.value'), true);
  assert.equal(partialStyleEditor.includes('measureGraphicTextHorizontalGeometry(selected, start, end)'), true);
  const horizontalControl = partialStyleEditor.slice(
    partialStyleEditor.indexOf("option('glyphOffsetX'"),
    partialStyleEditor.indexOf("numeric('glyphOffsetY'"),
  );
  assert.equal(horizontalControl.includes('min={-100}'), false);
  assert.equal(horizontalControl.includes('getDynamicGlyphOffsetXRange'), false);
  assert.equal(horizontalControl.includes('左端へ'), true);
  assert.equal(horizontalControl.includes('中央へ'), true);
  assert.equal(horizontalControl.includes('右端へ'), true);
  assert.equal(horizontalControl.includes('range-horizontal-actions'), true);
  assert.match(globalCss, /\.range-horizontal-actions\s*\{\s*margin-top:\s*8px;\s*\}/);
  assert.match(graphicRenderer, /measureGraphicTextHorizontalGeometry/);
  assert.match(graphicRenderer, /measurementText\.getCharacterLayout\(graphemeIndex\)/);
  assert.match(graphicRenderer, /delete referenceRange\.glyphOffsetX/);
  assert.match(graphicRenderer, /measureHorizontalGlyphLayouts\(referenceModel\)/);
  assert.match(graphicRenderer, /measureHorizontalGlyphLayouts\(model\)/);
  assert.match(graphicRenderer, /padding: 3,/);
  assert.doesNotMatch(graphicRenderer, /padding: 3 \+ glyphOffsetPadding/);
  assert.match(graphicRenderer, /textGroup\.inkPadding[\s\S]*glyphOffsetPadding \* 2/);
  assert.match(partialHorizontalPosition, /referenceGlyphs: GlyphHorizontalLayout\[\]/);
  assert.match(partialHorizontalPosition, /renderedGlyphs: GlyphHorizontalLayout\[\]/);
  assert.match(partialHorizontalPosition, /shiftRangeNumericLeaf\(model\.partialStyles, start, end, 'glyphOffsetX', delta, 0\)/);
  assert.match(backgroundRenderer, /style\.imageMode === 'followLines'/);
  assert.match(backgroundRenderer, /const width = textWidth \+ style\.paddingX \* 2/);
  assert.match(backgroundRenderer, /const height = textHeight \+ style\.paddingY \* 2/);
  assert.match(backgroundRenderer, /renderer\(style, width, height\)/);

  const textSectionOrder = [
    '<h2>本文入力</h2>',
    '<h2>選択中の本文</h2>',
    '<PartialStyleEditor',
    '<LineGapEditor',
    '<h2>文字揃え</h2>',
    '<h2>配置</h2>',
  ].map((marker) => textPanel.indexOf(marker));
  assert.ok(textSectionOrder.every((index) => index >= 0));
  assert.deepEqual([...textSectionOrder].sort((left, right) => left - right), textSectionOrder);
  assert.equal((textPanel.match(/<LineGapEditor/g) ?? []).length, 1);
  assert.equal(textPanel.split('<h2>配置</h2>').length - 1, 1);
  assert.equal(textPanel.includes('グループの回転'), false);
  assert.equal(stylePanel.includes('<LineGapEditor'), false);
  assert.equal(stylePanel.includes('<h2>文字揃え</h2>'), false);
  assert.equal(stylePanel.includes('<h2>配置</h2>'), false);
  const styleSectionOrder = [
    '<h2>書体</h2>',
    '<h2>サイズ・文字組み</h2>',
    '<h2>塗り</h2>',
    '<StrokeEditor',
    '<h2>影</h2>',
    '<h2>グループの回転</h2>',
    '<h2>Project共通Text基本設定</h2>',
  ].map((marker) => stylePanel.indexOf(marker));
  assert.ok(styleSectionOrder.every((index) => index >= 0));
  assert.deepEqual([...styleSectionOrder].sort((left, right) => left - right), styleSectionOrder);
  [
    '<FontPicker',
    'fontWeight:',
    'label="字形の傾き"',
    'label="文字の太さ補正"',
    'label="文字サイズ"',
    'label="文字間隔"',
    'label="行間"',
    'label="文字幅"',
    'label="文字高さ"',
    'id="text-fill-type"',
    'label="影を使用"',
    'label="グループの回転"',
  ].forEach((marker) => assert.equal(stylePanel.includes(marker), true));
  console.log(JSON.stringify({
    passed: true,
    checks: [
      'shared Fabric render path',
      'followLines visual bounds',
      'persistence schema',
      'selection retention',
      'independent partial accordion',
      'programmatic Fabric selection clear suppression',
      'text defaults portable round-trip',
      'Text tab section order',
      'Style tab section order',
      'responsive compact Storyboard control',
      'Preview keyboard and shared navigation state',
      'Preview thumbnail order and labels',
      'PC font list reload',
      'project rotation defaults and persistence',
      'selected PNG default filename normalization',
      'non-overlapping responsive brand region',
      'inline SVG brand mark',
      'single-step shared Undo/Redo keyboard commands',
      'font-size-free Quick Partial Presets',
      'dynamic glyphOffsetX visual range and alignment',
      'stable glyphOffsetX reference bounds and interaction frame',
      'partial horizontal control spacing',
      'horizontal 3-slice geometry and minimum width',
      'legacy/fixed/followLines shared background rendering',
      'horizontal 3-slice defaults and portable persistence',
      'per-line followLines edge geometry and safe minimum',
      'per-line metadata persistence and defaults exclusion',
      'per-line compact numeric controls and resets',
      'position-based logical line identity reconciliation',
      'beforeinput metadata capture without native edit prevention',
      'ID-keyed renderer lookup and text-edit atomicity',
      'blank logical-line renderer mapping without adjustment leakage',
      'negative font-weight rollback with positive-only rendering and legacy-data normalization',
    ],
  }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
