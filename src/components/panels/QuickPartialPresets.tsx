'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { MoreHorizontal, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import {
  applyQuickPartialOperation,
  cloneQuickPartialOperation,
  hasQuickPartialOperation,
  MAX_QUICK_PARTIAL_PRESETS,
} from '@/src/services/quickPartialPresets';
import { useEditorStore } from '@/src/store/editorStore';
import type { GraphicTextObject, QuickPartialStyleOperation } from '@/src/types/editor';

type NameDialog = { mode: 'create'; operation: QuickPartialStyleOperation } | { mode: 'rename'; presetId: string } | null;

export function QuickPartialPresets({
  selected,
  start,
  end,
  currentOperation,
  currentOperationValid,
}: {
  selected: GraphicTextObject;
  start: number;
  end: number;
  currentOperation: QuickPartialStyleOperation;
  currentOperationValid: boolean;
}) {
  const editor = useObjectEditor(selected.id);
  const presets = useEditorStore((state) => state.quickPartialPresets);
  const addPreset = useEditorStore((state) => state.addQuickPartialPreset);
  const updatePreset = useEditorStore((state) => state.updateQuickPartialPreset);
  const deletePreset = useEditorStore((state) => state.deleteQuickPartialPreset);
  const setNotice = useEditorStore((state) => state.setNotice);
  const [dialog, setDialog] = useState<NameDialog>(null);
  const [name, setName] = useState('');
  const validRange = start < end && end <= selected.text.length;
  const atLimit = presets.length >= MAX_QUICK_PARTIAL_PRESETS;

  const validateCurrentOperation = (): boolean => {
    if (!hasQuickPartialOperation(currentOperation)) {
      setNotice('プリセットに保存する変更がありません。', 'warning');
      return false;
    }
    if (!currentOperationValid) {
      setNotice('フチの連続条件を満たしてからプリセットを保存してください。', 'warning');
      return false;
    }
    return true;
  };

  const openCreate = () => {
    if (atLimit) {
      setNotice('クイック部分プリセットは最大8個まで保存できます。', 'warning');
      return;
    }
    if (!validateCurrentOperation()) return;
    setName('');
    setDialog({ mode: 'create', operation: cloneQuickPartialOperation(currentOperation) });
  };

  return <section className="quick-partial-presets" aria-label="クイック部分プリセット">
    <div className="quick-preset-heading">
      <h3>クイック部分プリセット</h3>
      <span>{presets.length}/{MAX_QUICK_PARTIAL_PRESETS}</span>
    </div>
    <div className="quick-preset-list" data-quick-preset-count={presets.length}>
      {presets.map((preset) => <div key={preset.id} className="quick-preset-item">
        <Button
          type="button"
          variant="outline"
          className="quick-preset-apply"
          aria-label={`${preset.name}を選択範囲へ適用`}
          onClick={() => {
            if (!validRange) {
              setNotice('先に文字範囲を選択してください。', 'warning');
              return;
            }
            editor.commit((object) => applyQuickPartialOperation(object, start, end, preset.operation));
            setNotice(`「${preset.name}」を選択範囲へ適用しました。`, 'success');
          }}
        >{preset.name}</Button>
        <Popover.Root>
          <Popover.Trigger type="button" className="quick-preset-menu-trigger" aria-label={`${preset.name}の管理`} title={`${preset.name}の管理`}><MoreHorizontal aria-hidden="true" /></Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner className="quick-preset-menu-positioner" side="bottom" align="end" sideOffset={4} collisionPadding={10}>
              <Popover.Popup className="quick-preset-menu-popup" role="menu">
            <Popover.Close type="button" role="menuitem" onClick={() => {
              if (!validateCurrentOperation()) return;
              updatePreset(preset.id, { operation: currentOperation });
              setNotice(`「${preset.name}」を現在の設定で上書きしました。`, 'success');
            }}>現在の設定で上書き</Popover.Close>
            <Popover.Close type="button" role="menuitem" onClick={() => {
              setName(preset.name);
              setDialog({ mode: 'rename', presetId: preset.id });
            }}>名前変更</Popover.Close>
            <Popover.Close type="button" role="menuitem" className="destructive" onClick={() => {
              deletePreset(preset.id);
              setNotice(`「${preset.name}」を削除しました。適用済みの文字は変更されません。`, 'info');
            }}>削除</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>)}
      {!presets.length && <p className="quick-preset-empty">よく使う部分スタイルを最大8個保存できます。</p>}
    </div>
    <Button type="button" variant="outline" className="quick-preset-save" disabled={atLimit} onClick={openCreate}>
      <Plus aria-hidden="true" />プリセットを保存
    </Button>
    {atLimit && <p className="panel-note">クイック部分プリセットは最大8個まで保存できます。</p>}

    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
      <DialogContent className="quick-preset-dialog">
        <DialogHeader>
          <DialogTitle>{dialog?.mode === 'rename' ? 'プリセット名を変更' : 'クイック部分プリセットを保存'}</DialogTitle>
          <DialogDescription>選択範囲や文章は保存せず、現在指定している部分スタイル操作だけを保存します。</DialogDescription>
        </DialogHeader>
        <label className="field-label" htmlFor="quick-preset-name">プリセット名</label>
        <input
          id="quick-preset-name"
          className="quick-preset-name-input"
          value={name}
          maxLength={40}
          placeholder="赤文字"
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.form?.requestSubmit();
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDialog(null)}>キャンセル</Button>
          <Button type="button" disabled={!name.trim()} onClick={() => {
            const nextName = name.trim();
            if (!nextName || !dialog) return;
            if (dialog.mode === 'create') {
              const now = new Date().toISOString();
              addPreset({
                id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `quick-${Date.now()}`,
                name: nextName,
                createdAt: now,
                updatedAt: now,
                operation: dialog.operation,
              });
              setNotice(`「${nextName}」を保存しました。`, 'success');
            } else {
              updatePreset(dialog.presetId, { name: nextName });
              setNotice(`プリセット名を「${nextName}」へ変更しました。`, 'success');
            }
            setDialog(null);
          }}>{dialog?.mode === 'rename' ? '名前を変更' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
