import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const work = await mkdtemp(join(tmpdir(), 'tgs-phase305-'));
const output = join(work, 'check.mjs');
const source = `
import assert from 'node:assert/strict';
import { useEditorStore } from '${process.cwd().replaceAll('\\', '/')}/src/store/editorStore.ts';
import { updateGraphicTextContent } from '${process.cwd().replaceAll('\\', '/')}/src/services/textContent.ts';

const state = () => useEditorStore.getState();
state().createNewProject();
state().addFrame();
state().addFrame();
state().addFrame();
let snapshot = state().getStudioProjectSnapshot();
const ids = snapshot.frames.map((frame) => ({ frameId: frame.frameId, objectId: frame.document.objects[0].id }));
const originalActiveFrameId = snapshot.activeFrameId;

snapshot = {
  ...snapshot,
  frames: snapshot.frames.map((frame, index) => ({
    ...frame,
    completedLocked: index === 3,
    document: {
      ...frame.document,
      objects: frame.document.objects.map((object) => ({
        ...object,
        text: index === 0 ? '甲子園の土' : index === 1 ? '甲子園' : object.text,
        locked: index === 0,
        fullyLocked: index === 2,
        partialStyles: index === 0 ? [{ start: 0, end: 3, glyphOffsetY: 5 }] : object.partialStyles,
        lineGapOffsets: index === 0 ? [] : object.lineGapOffsets,
      })),
    },
  })),
};
state().replaceStudioProject(snapshot);

const before = state().getStudioProjectSnapshot();
const beforeObject = before.frames[0].document.objects[0];
const success = state().applyProjectTextChanges([
  { ...ids[0], text: '甲子園の砂' },
  { ...ids[1], text: '夏の甲子園\\n決勝' },
]);
assert.deepEqual(success, { ok: true, changedCount: 2 });
const after = state().getStudioProjectSnapshot();
assert.equal(after.activeFrameId, originalActiveFrameId);
assert.equal(after.frames[0].document.objects[0].text, '甲子園の砂');
assert.deepEqual(after.frames[0].document.objects[0].partialStyles, beforeObject.partialStyles);
assert.equal(after.frames[1].document.objects[0].text, '夏の甲子園\\n決勝');
assert.equal(after.frames[1].document.objects[0].lineGapOffsets.length, 1);
const stripTextLayout = ({ text, partialStyles, lineGapOffsets, ...rest }) => rest;
assert.deepEqual(stripTextLayout(after.frames[0].document.objects[0]), stripTextLayout(beforeObject));

const beforeInvalid = JSON.stringify(state().getStudioProjectSnapshot());
const invalid = state().applyProjectTextChanges([
  { ...ids[0], text: '途中更新してはいけない' },
  { frameId: ids[1].frameId, objectId: 'missing-object', text: '失敗' },
]);
assert.equal(invalid.ok, false);
assert.equal(JSON.stringify(state().getStudioProjectSnapshot()), beforeInvalid);

const fullyLocked = state().applyProjectTextChanges([{ ...ids[2], text: '変更不可' }]);
assert.equal(fullyLocked.ok, false);
const frameLocked = state().applyProjectTextChanges([{ ...ids[3], text: '変更不可' }]);
assert.equal(frameLocked.ok, false);

const shortened = updateGraphicTextContent({
  ...after.frames[0].document.objects[0],
  text: '甲子園の土',
  partialStyles: [{ start: 0, end: 5, glyphOffsetY: 5 }],
}, '甲子園');
assert.equal(shortened.text, '甲子園');
assert.ok(shortened.partialStyles.every((style) => style.end <= shortened.text.length));

console.log(JSON.stringify({
  passed: true,
  checks: [
    'same-length partial style preservation',
    'longer and multiline normalization',
    'shorter range normalization',
    'position lock remains text-editable',
    'frame and full lock guards',
    'missing object transactional rollback',
    'active frame preservation',
  ],
}, null, 2));
`;

try {
  await build({
    absWorkingDir: process.cwd(),
    stdin: { contents: source, loader: 'ts', resolveDir: process.cwd(), sourcefile: 'phase305-check.ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: output,
    logLevel: 'silent',
  });
  await import(`${pathToFileURL(output).href}?run=${Date.now()}`);
} finally {
  await rm(work, { recursive: true, force: true });
}

assert.ok(true);
