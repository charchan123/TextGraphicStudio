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
  assert.match(renderer, /drawLeft = left \+ \(declaration\.deltaX \?\? 0\)/);
  assert.match(renderer, /box\.left \+ deltaX - weightAdjust/);
  assert.match(renderer, /strokeStyle = context\.fillStyle/);
  assert.match(renderer, /strokeWidth: Number\(complete\.strokeWidth \?\? 0\) \+ weightAdjust \* 2/);
  assert.match(graphicRenderer, /range\.glyphOffsetX !== undefined \|\| range\.fontWeightAdjust !== undefined/);
  assert.match(backgroundRenderer, /createFollowLinesBackground\(style, lines, outputScale\)/);
  assert.match(persistence, /value\.projectTextDefaults === undefined \|\| isProjectTextDefaults/);
  assert.equal(textPanel.includes('if (start >= end) return;'), true);
  assert.equal(textPanel.includes('frameId: activeFrameId'), true);
  assert.equal(partialStyleEditor.includes('open={expanded}'), true);
  assert.equal(partialStyleEditor.includes('open={valid}'), false);
  assert.equal(partialStyleEditor.includes('setTextSelection'), false);
  assert.equal(editorStore.includes('textSelection.frameId === state.studioProject.activeFrameId'), true);
  assert.equal(textPanel.includes('setPartialStyleExpanded(true)'), false);
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
  assert.equal(stylePanel.includes('<LineGapEditor'), false);
  assert.equal(stylePanel.includes('<h2>文字揃え</h2>'), false);
  assert.equal(stylePanel.includes('<h2>配置</h2>'), false);
  const styleSectionOrder = [
    '<h2>書体</h2>',
    '<h2>サイズ・文字組み</h2>',
    '<h2>塗り</h2>',
    '<StrokeEditor',
    '<h2>影</h2>',
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
    ],
  }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
