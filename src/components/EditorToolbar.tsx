'use client';

import { useRef } from 'react';
import {
  Copy,
  FileDown,
  FileJson,
  FilePlus2,
  ImageDown,
  ImagePlus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CanvasSizeControl } from '@/src/components/CanvasSizeControl';
import { ToolbarTooltip } from '@/src/components/ToolbarTooltip';
import { useEditorStore } from '@/src/store/editorStore';

interface EditorToolbarProps {
  busy: boolean;
  onRequestNew: () => void;
  onBackgroundFile: (file: File) => void;
  onExportProject: () => void;
  onExportSelected: () => void;
  onSaveTemplate: (includePosition: boolean) => void;
  onLoadTemplate: () => void;
}

export function EditorToolbar({
  busy,
  onRequestNew,
  onBackgroundFile,
  onExportProject,
  onExportSelected,
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
        <ToolbarTooltip label="テンプレートを読み込む（JSON）">
          <Button variant="ghost" size="icon-lg" aria-label="テンプレート読込" disabled={!hasSelection} onClick={onLoadTemplate}>
            <FileJson aria-hidden="true" /><span className="sr-only">テンプレート読込</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="選択中の設定をテンプレート保存">
          <Button variant="outline" size="lg" aria-label="テンプレート" disabled={!hasSelection} onClick={() => onSaveTemplate(false)}>
            <Save aria-hidden="true" /><span>テンプレート</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="選択中のテキストをダウンロード（透明PNG）">
          <Button variant="outline" size="lg" aria-label="透明PNG" disabled={busy || !hasSelection} onClick={onExportSelected}>
            <FileDown aria-hidden="true" /><span>透明PNG</span>
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="キャンバス画像をダウンロード（PNG）">
          <Button size="lg" aria-label="PNG保存" disabled={busy} onClick={onExportProject}>
            <ImageDown aria-hidden="true" /><span>PNG保存</span>
          </Button>
        </ToolbarTooltip>
      </div>
    </header>
  );
}
