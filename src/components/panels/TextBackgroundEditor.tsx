'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { BACKGROUND_TYPES } from '@/src/canvas/backgroundRenderer';
import { loadTextBackgroundFile, prepareBackgroundImage } from '@/src/services/textBackgroundAssets';
import { deleteBackgroundPreset, listBackgroundPresets, saveBackgroundPreset } from '@/src/services/persistence';
import { createObjectId } from '@/src/store/defaults';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';
import type { BackgroundPreset, GraphicTextObject } from '@/src/types/editor';

export function TextBackgroundEditor({ selected }: { selected: GraphicTextObject }) {
  const editor = useObjectEditor(selected.id);
  const setNotice = useEditorStore((state) => state.setNotice);
  const inputRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<BackgroundPreset[]>([]);
  const [presetName, setPresetName] = useState('背景デザイン');
  const [presetId, setPresetId] = useState('');
  const background = selected.background;
  const type = background.type === 'rough-band' ? 'generatedRoughYellow' : background.type;
  const report = (error: unknown) => setNotice(error instanceof Error ? error.message : '背景の処理に失敗しました。', 'error');

  useEffect(() => {
    let cancelled = false;
    const requestGeneration = generation;
    void listBackgroundPresets().then((items) => { if (!cancelled) setPresets(items); }).catch((error: unknown) => {
      if (!cancelled) useEditorStore.getState().setNotice(error instanceof Error ? error.message : '背景プリセットを読み込めませんでした。', 'error');
    });
    return () => { cancelled = true; requestGeneration.current++; };
  }, []);

  const loadFile = async (file: File) => {
    const version = ++generation.current;
    setBusy(true);
    try {
      const image = await loadTextBackgroundFile(file);
      if (version !== generation.current) return;
      editor.commit((object) => ({ ...object, background: { ...object.background, type: 'uploadedImage', enabled: true, image } }));
      setPresetName(file.name.replace(/\.[^.]+$/, ''));
      setNotice('テキスト背景を読み込みました。', 'success');
    } catch (error) { if (version === generation.current) report(error); }
    finally { if (version === generation.current) setBusy(false); }
  };

  const savePreset = async () => {
    if (!background.image || !presetName.trim()) return;
    setBusy(true);
    try {
      const preset: BackgroundPreset = { id: createObjectId(), name: presetName.trim(), savedAt: new Date().toISOString(), background: structuredClone(background) };
      await saveBackgroundPreset(preset);
      setPresets(await listBackgroundPresets()); setPresetId(preset.id);
      setNotice('背景プリセットをこのブラウザに保存しました。', 'success');
    } catch (error) { report(error); } finally { setBusy(false); }
  };

  const applyPreset = async () => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    try {
      if (preset.background.image) await prepareBackgroundImage(preset.background.image);
      editor.commit((object) => ({ ...object, background: structuredClone(preset.background) }));
      setNotice('背景プリセットを適用しました。', 'success');
    } catch (error) { report(error); }
  };

  return (
    <section className="panel-section text-background-editor">
      <div className="section-heading"><div><h2>テキスト背景</h2><p>文字と一体で移動・拡縮・回転します</p></div></div>
      <label className="field-label" htmlFor="text-background-type">背景タイプ</label>
      <NativeSelect id="text-background-type" value={type} onChange={(event) => {
        generation.current++; setBusy(false);
        const next = event.currentTarget.value as typeof type;
        editor.commit((object) => ({ ...object, background: { ...object.background, type: next, enabled: next !== 'none' && (next !== 'uploadedImage' || Boolean(object.background.image)) } }));
      }}>
        {BACKGROUND_TYPES.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
      </NativeSelect>
      {type === 'generatedRoughYellow' && <>
        <ToggleRow label="黄色背景を表示" checked={background.enabled} onCheckedChange={(enabled) => editor.commit((object) => ({ ...object, background: { ...object.background, enabled } }))} />
        <ColorField label="背景色" value={background.color} disabled={!background.enabled} onBegin={editor.begin} onPreview={(color) => editor.preview((object) => ({ ...object, background: { ...object.background, color } }))} onCommit={editor.finish} />
      </>}
      {type === 'uploadedImage' && <div className="background-upload">
        <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus aria-hidden="true" />{busy ? '読み込み中…' : 'テキスト背景を読み込む'}</Button>
        <input ref={inputRef} type="file" className="sr-only" accept=".png,.svg,image/png,image/svg+xml" aria-label="テキスト背景ファイル" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void loadFile(file); }} />
        {background.image && <div className="text-background-preview"><Image unoptimized src={background.image.dataUrl} width={background.image.width} height={background.image.height} alt="読み込んだテキスト背景" /><span>{background.image.fileName}</span></div>}
        <label className="field-label" htmlFor="text-background-image-mode">画像背景の使い方</label>
        <NativeSelect id="text-background-image-mode" aria-label="画像背景の使い方" value={background.imageMode ?? 'fixed'} onChange={(event) => {
          const imageMode = event.currentTarget.value as 'fixed' | 'followLines';
          editor.commit((object) => ({ ...object, background: { ...object.background, imageMode } }));
        }}>
          <NativeSelectOption value="fixed">固定背景（全体に1枚）</NativeSelectOption>
          <NativeSelectOption value="followLines">自動追従背景（行ごと）</NativeSelectOption>
        </NativeSelect>
        <p className="mode-description">
          {(background.imageMode ?? 'fixed') === 'fixed'
            ? '見本を忠実に使うモードです。画像1枚をテキスト全体の背面へ配置します。'
            : '各行の実寸に合わせ、画像の左右端を保ちながら中央部を自然に伸縮します。'}
        </p>
        <p className="panel-note">PNG・静的SVG / 12MB・1600万画素まで。透明な外周を取り除き、SVGもローカルでPNG化します。</p>
      </div>}
      {type !== 'none' && <>
        <SliderField label="左右の余白" value={background.paddingX} min={0} max={160} unit="px" disabled={!background.enabled} onBegin={editor.begin} onPreview={(paddingX) => editor.preview((object) => ({ ...object, background: { ...object.background, paddingX } }))} onCommit={editor.finish} />
        <SliderField label="上下の余白" value={background.paddingY} min={0} max={100} unit="px" disabled={!background.enabled} onBegin={editor.begin} onPreview={(paddingY) => editor.preview((object) => ({ ...object, background: { ...object.background, paddingY } }))} onCommit={editor.finish} />
        <SliderField label="背景の横位置" value={background.offsetX ?? 0} min={-500} max={500} unit="px" disabled={!background.enabled} onBegin={editor.begin} onPreview={(offsetX) => editor.preview((object) => ({ ...object, background: { ...object.background, offsetX } }))} onCommit={editor.finish} />
        <SliderField label="背景の縦位置" value={background.offsetY ?? 0} min={-500} max={500} unit="px" disabled={!background.enabled} onBegin={editor.begin} onPreview={(offsetY) => editor.preview((object) => ({ ...object, background: { ...object.background, offsetY } }))} onCommit={editor.finish} />
        <SliderField label="背景の追加角度" value={background.rotation} min={-45} max={45} step={0.1} unit="°" disabled={!background.enabled} onBegin={editor.begin} onPreview={(rotation) => editor.preview((object) => ({ ...object, background: { ...object.background, rotation } }))} onCommit={editor.finish} />
      </>}
      <div className="background-presets">
        <h3>保存済み背景プリセット</h3>
        {type === 'uploadedImage' && background.image && <>
          <input className="plain-input" aria-label="背景プリセット名" value={presetName} onChange={(event) => setPresetName(event.currentTarget.value)} maxLength={80} />
          <Button variant="outline" disabled={busy || !presetName.trim()} onClick={() => void savePreset()}><Save aria-hidden="true" />背景プリセットを保存</Button>
        </>}
        <NativeSelect aria-label="保存済み背景プリセット" value={presetId} onChange={(event) => setPresetId(event.currentTarget.value)}>
          <NativeSelectOption value="">{presets.length ? '背景を選択' : '保存済み背景はありません'}</NativeSelectOption>
          {presets.map((preset) => <NativeSelectOption key={preset.id} value={preset.id}>{preset.name}</NativeSelectOption>)}
        </NativeSelect>
        <div className="inline-actions">
          <Button variant="outline" disabled={!presetId || busy} onClick={() => void applyPreset()}>背景プリセットを適用</Button>
          <Button variant="ghost" disabled={!presetId || busy} aria-label="背景プリセットを削除" onClick={() => {
            void deleteBackgroundPreset(presetId).then(async () => { setPresets(await listBackgroundPresets()); setPresetId(''); setNotice('背景プリセットを削除しました。適用済みの背景は残ります。', 'info'); }).catch(report);
          }}><Trash2 aria-hidden="true" />削除</Button>
        </div>
      </div>
    </section>
  );
}
