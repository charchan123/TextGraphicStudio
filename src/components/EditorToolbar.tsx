'use client';

import { useRef } from 'react';
import {
  Copy,
  FilePlus2,
  ImagePlus,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CanvasSizeControl } from '@/src/components/CanvasSizeControl';
import { ToolbarTooltip } from '@/src/components/ToolbarTooltip';
import { EditorActionButton } from '@/src/components/EditorActionButton';
import { useEditorStore } from '@/src/store/editorStore';

interface EditorToolbarProps {
  busy: boolean;
  onRequestNew: () => void;
  onBackgroundFile: (file: File) => void;
  onExportProject: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onSaveTemplate: (includePosition: boolean) => void;
  onLoadTemplate: () => void;
}

export function EditorToolbar({
  busy,
  onRequestNew,
  onBackgroundFile,
  onExportProject,
  onExportSelected,
  onExportAll,
  onSaveTemplate,
  onLoadTemplate,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const pastLength = useEditorStore((state) => state.past.length);
  const futureLength = useEditorStore((state) => state.future.length);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteObject = useEditorStore((state) => state.deleteObject);
  const hasSelection = project.objects.some((object) => object.id === selectedId);

  return (
    <header className="editor-toolbar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">T</div>
        <div>
          <p className="brand-name">Text Graphic Studio</p>
          <p className="brand-meta">ローカル編集 • {project.canvas.width} × {project.canvas.height}</p>
        </div>
      </div>

      <nav className="toolbar-actions" aria-label="編集ツール">
        <ToolbarTooltip label="新規プロジェクト">
          <Button variant="ghost" size="lg" aria-label="新規" onClick={onRequestNew}>
            <FilePlus2 aria-hidden="true" /><span>新規</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="背景画像を読み込む">
          <Button variant="ghost" size="lg" aria-label="背景画像" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus aria-hidden="true" /><span>背景画像</span>
          </Button>
        </ToolbarTooltip>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          aria-label="背景画像ファイル"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onBackgroundFile(file);
            event.currentTarget.value = '';
          }}
        />
        <span className="toolbar-divider" aria-hidden="true" />
        <ToolbarTooltip label="元に戻す（Ctrl+Z）">
          <Button variant="ghost" size="lg" aria-label="元に戻す" disabled={pastLength === 0} onClick={undo}>
            <Undo2 aria-hidden="true" /><span>元に戻す</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="やり直す（Ctrl+Shift+Z / Ctrl+Y）">
          <Button variant="ghost" size="lg" aria-label="やり直す" disabled={futureLength === 0} onClick={redo}>
            <Redo2 aria-hidden="true" /><span>やり直す</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="選択中のテキストを複製（Ctrl+D）">
          <Button variant="ghost" size="lg" aria-label="複製" disabled={!hasSelection} onClick={duplicateSelected}>
            <Copy aria-hidden="true" /><span>複製</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="選択中のテキストを削除（Delete）">
          <Button variant="ghost" size="lg" aria-label="削除" disabled={!hasSelection} onClick={() => deleteObject()}>
            <Trash2 aria-hidden="true" /><span>削除</span>
          </Button>
        </ToolbarTooltip>
      </nav>

      <div className="toolbar-export">
        <CanvasSizeControl />
        <EditorActionButton action="templateLoad" iconOnly variant="ghost" size="icon-lg" disabled={!hasSelection} onClick={onLoadTemplate} />
        <EditorActionButton action="templateSave" iconOnly variant="outline" size="icon-lg" disabled={!hasSelection} onClick={() => onSaveTemplate(false)} />
        <EditorActionButton action="exportSelected" iconOnly variant="outline" size="icon-lg" disabled={busy || !hasSelection} onClick={onExportSelected} />
        <EditorActionButton action="exportAll" iconOnly variant="outline" size="icon-lg" disabled={busy || project.objects.length === 0} onClick={onExportAll} />
        <EditorActionButton action="exportProject" iconOnly size="icon-lg" disabled={busy} onClick={onExportProject} />
      </div>
    </header>
  );
}
