import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const work = await mkdtemp(join(tmpdir(), 'tgs-phase307-'));
const output = join(work, 'check.mjs');
const root = process.cwd().replaceAll('\\', '/');
const source = `
import assert from 'node:assert/strict';
import { normalizeProjectDocument } from '${root}/src/services/documentData.ts';
import { useEditorStore } from '${root}/src/store/editorStore.ts';

const state = () => useEditorStore.getState();
const background = (id, positionY = 0) => ({
  id,
  fileName: id + '.png',
  mimeType: 'image/png',
  dataUrl: 'data:image/png;base64,AA==',
  naturalWidth: 1080,
  naturalHeight: 1920,
  fitMode: 'height-center',
  positionY,
});

state().createNewProject();
state().addFrame();
const firstFrameId = state().getStudioProjectSnapshot().frames[0].frameId;
const targetFrameId = state().studioProject.activeFrameId;
state().setBackgroundImage(background('source'));

state().beginTransaction();
state().setCanvasBackgroundPositionY(100, false);
state().setCanvasBackgroundPositionY(300, false);
state().finishTransaction();
assert.equal(state().project.backgroundImage.positionY, 300);
state().undo();
assert.equal(state().project.backgroundImage.positionY, 0);
state().redo();
assert.equal(state().project.backgroundImage.positionY, 300);

state().selectFrame(firstFrameId);
assert.equal(state().project.backgroundImage, null);
state().selectFrame(targetFrameId);
assert.equal(state().project.backgroundImage.positionY, 300);

state().duplicateFrame(targetFrameId);
assert.equal(state().project.backgroundImage.positionY, 300);
assert.notEqual(state().studioProject.activeFrameId, targetFrameId);

const duplicateFrameId = state().studioProject.activeFrameId;
state().setFrameCompletedLocked(duplicateFrameId, true);
state().setCanvasBackgroundPositionY(-150);
assert.equal(state().project.backgroundImage.positionY, 300);
state().setBackgroundImage(background('blocked-replacement'));
assert.equal(state().project.backgroundImage.id, 'source');
state().setFrameCompletedLocked(duplicateFrameId, false);

state().setBackgroundImage(background('completed-background', 0));
assert.equal(state().project.backgroundImage.positionY, 0);
state().undo();
assert.equal(state().project.backgroundImage.id, 'source');
assert.equal(state().project.backgroundImage.positionY, 300);

const legacy = normalizeProjectDocument({
  ...state().project,
  backgroundImage: {
    ...state().project.backgroundImage,
    positionY: undefined,
  },
});
assert.equal(legacy.backgroundImage.positionY, 0);

console.log(JSON.stringify({
  passed: true,
  checks: [
    'transactional position Y undo and redo',
    'frame switch persistence',
    'frame duplicate preservation',
    'complete-lock mutation guards',
    'replacement reset and single undo',
    'legacy project default zero',
  ],
}, null, 2));
`;

try {
  await build({
    absWorkingDir: process.cwd(),
    stdin: { contents: source, loader: 'ts', resolveDir: process.cwd(), sourcefile: 'phase307-check.ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: output,
    logLevel: 'silent',
  });
  await import(`${pathToFileURL(output).href}?run=${Date.now()}`);

  const exportSource = await readFile(join(process.cwd(), 'src/services/exportService.ts'), 'utf8');
  const backgroundRenderer = exportSource.match(/export const renderProjectBackgroundPngBlob[\s\S]*?(?=export const exportGraphicPng)/)?.[0] ?? '';
  assert.match(backgroundRenderer, /applyProjectBackground/);
  assert.match(backgroundRenderer, /rgba\(0,0,0,0\)/);
  assert.doesNotMatch(backgroundRenderer, /project\.objects|createFabricGraphicText|prepareGraphicAssets/);
  assert.match(exportSource, /top: outputHeight \/ 2 \+ \(project\.backgroundImage\.positionY \?\? 0\) \* outputScale/);
  assert.match(exportSource, /String\(index\)\.padStart\(2, '0'\).*_background\.png/);

  const canvasSource = await readFile(join(process.cwd(), 'src/canvas/FabricCanvas.tsx'), 'utf8');
  assert.match(canvasSource, /background\.positionY \?\? 0/);
  console.log(JSON.stringify({
    passed: true,
    checks: [
      'background-only renderer excludes TextObjects',
      'transparent background-only Canvas',
      'shared offset renderer for Preview thumbnail and regular export',
      'editor Canvas offset',
      'frame-index background filename',
    ],
  }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
