'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FabricCanvas } from '@/src/canvas/FabricCanvas';
import { EditorToolbar } from '@/src/components/EditorToolbar';
import { InspectorPanel } from '@/src/components/InspectorPanel';
import { useKeyboardShortcuts } from '@/src/hooks/useKeyboardShortcuts';
import { useWebMcp } from '@/src/hooks/useWebMcp';
import { exportAllGraphicsPng, exportGraphicPng, exportProjectPng } from '@/src/services/exportService';
import { loadBackgroundFile } from '@/src/services/imageService';
import { clearAutosave, loadAutosave, saveAutosave } from '@/src/services/persistence';
import { createTemplate, downloadTemplate, readTemplateFile } from '@/src/services/templateService';
import { createInitialProject } from '@/src/store/defaults';
import { useEditorStore } from '@/src/store/editorStore';
import type { ProjectDocument } from '@/src/types/editor';

const formatSavedAt = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '保存日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export function EditorApp() {
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<ProjectDocument | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const zoomPercent = useEditorStore((state) => state.zoomPercent);
  const notice = useEditorStore((state) => state.notice);
  const setNotice = useEditorStore((state) => state.setNotice);
  const clearNotice = useEditorStore((state) => state.clearNotice);
  const replaceProject = useEditorStore((state) => state.replaceProject);
  const createNewProject = useEditorStore((state) => state.createNewProject);
  const setBackgroundImage = useEditorStore((state) => state.setBackgroundImage);
  const applyTemplate = useEditorStore((state) => state.applyTemplate);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;

  useKeyboardShortcuts();
  useWebMcp();

  useEffect(() => {
    let cancelled = false;
    void loadAutosave()
      .then((savedProject) => {
        if (cancelled) return;
        if (savedProject) setRestoreCandidate(savedProject);
        else setPersistenceReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPersistenceReady(true);
          setNotice('前回の自動保存を確認できませんでした。編集は続けられます。', 'warning');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setNotice]);

  useEffect(() => {
    if (!persistenceReady) return;
    let timer: number | null = null;
    let saveErrorShown = false;
    const scheduleSave = (nextProject: ProjectDocument) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveAutosave(nextProject).catch(() => {
          if (!saveErrorShown) {
            saveErrorShown = true;
            useEditorStore.getState().setNotice('自動保存に失敗しました。ブラウザの空き容量を確認してください。', 'error');
          }
        });
      }, 900);
    };
    scheduleSave(useEditorStore.getState().project);
    const unsubscribe = useEditorStore.subscribe((state) => scheduleSave(state.project));
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        if (timer !== null) window.clearTimeout(timer);
        void saveAutosave(useEditorStore.getState().project).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', flushWhenHidden);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [persistenceReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 3600);
    return () => window.clearTimeout(timer);
  }, [clearNotice, notice]);

  const runTask = async (task: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await task();
      setNotice(successMessage, 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '処理に失敗しました。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleBackgroundFile = (file: File) => {
    void runTask(async () => {
      const image = await loadBackgroundFile(file);
      setBackgroundImage(image);
    }, '背景画像を読み込みました。');
  };

  const handleExportProject = () => {
    void runTask(() => exportProjectPng(useEditorStore.getState().project), 'キャンバス全体をPNG保存しました。');
  };

  const handleExportSelected = () => {
    const object = useEditorStore.getState().project.objects.find(
      (item) => item.id === useEditorStore.getState().selectedId,
    );
    if (!object) {
      setNotice('透明PNGにするテキストを選択してください。', 'warning');
      return;
    }
    void runTask(() => exportGraphicPng(object), '選択中のテキストを透明PNG保存しました。');
  };

  const handleExportAll = () => {
    void runTask(async () => {
      const count = await exportAllGraphicsPng(useEditorStore.getState().project.objects);
      if (count === 0) throw new Error('書き出せる表示中のテキストがありません。');
    }, 'すべての表示中テキストを個別に保存しました。');
  };

  const handleSaveTemplate = (includePosition: boolean) => {
    const object = useEditorStore.getState().project.objects.find(
      (item) => item.id === useEditorStore.getState().selectedId,
    );
    if (!object) {
      setNotice('テンプレートにするテキストを選択してください。', 'warning');
      return;
    }
    downloadTemplate(createTemplate(object, includePosition), object.name);
    setNotice('テンプレートJSONを保存しました。', 'success');
  };

  const handleTemplateFile = (file: File) => {
    void runTask(async () => {
      const template = await readTemplateFile(file);
      applyTemplate(template);
    }, 'テンプレートを選択中のテキストへ適用しました。');
  };

  const restoreSavedProject = () => {
    if (!restoreCandidate) return;
    replaceProject(restoreCandidate);
    setRestoreCandidate(null);
    setPersistenceReady(true);
    setNotice('前回の作業を復元しました。', 'success');
  };

  const discardSavedProject = () => {
    replaceProject(createInitialProject());
    setRestoreCandidate(null);
    setPersistenceReady(true);
    void clearAutosave().catch(() => undefined);
    setNotice('新しいプロジェクトを開始しました。', 'info');
  };

  return (
    <main
      className="editor-shell"
      data-object-count={project.objects.length}
      data-selected-id={selected?.id ?? ''}
      data-selected-x={selected?.position.x ?? ''}
      data-selected-y={selected?.position.y ?? ''}
      data-selected-width={selected?.size.width ?? ''}
      data-selected-height={selected?.size.height ?? ''}
      data-selected-scale-x={selected?.transform.scaleX ?? ''}
      data-selected-scale-y={selected?.transform.scaleY ?? ''}
      data-selected-rotation={selected?.transform.rotation ?? ''}
      data-selected-background-rotation={selected?.background.rotation ?? ''}
      data-selected-shadow-opacity={selected?.shadow.opacity ?? ''}
    >
      <EditorToolbar
        busy={busy}
        onRequestNew={() => setNewDialogOpen(true)}
        onBackgroundFile={handleBackgroundFile}
        onExportProject={handleExportProject}
        onExportSelected={handleExportSelected}
        onExportAll={handleExportAll}
        onSaveTemplate={handleSaveTemplate}
        onLoadTemplate={() => templateInputRef.current?.click()}
      />

      <input
        ref={templateInputRef}
        type="file"
        className="sr-only"
        accept=".json,application/json"
        aria-label="テンプレートJSONファイル"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) handleTemplateFile(file);
          event.currentTarget.value = '';
        }}
      />

      <section className="editor-main">
        <section className="stage" aria-label="キャンバス作業領域">
          <div className="stage-head">
            <div>
              <p className="stage-title">キャンバス</p>
              <p className="stage-status">表示 {zoomPercent}% • ガイド {project.canvas.guidesVisible ? 'ON' : 'OFF'}</p>
            </div>
            <div className="stage-chip">{project.canvas.width} × {project.canvas.height}</div>
          </div>
          <FabricCanvas />
          <footer className="stage-footer">
            <span>内部解像度 {project.canvas.width} × {project.canvas.height}</span>
            <span>{selected ? `選択中: ${selected.name}` : 'テキストを選択してください'}</span>
            <span>画像は外部へ送信されません</span>
          </footer>
        </section>

        <InspectorPanel
          busy={busy}
          onExportProject={handleExportProject}
          onExportSelected={handleExportSelected}
          onExportAll={handleExportAll}
          onSaveTemplate={handleSaveTemplate}
          onLoadTemplate={() => templateInputRef.current?.click()}
        />
      </section>

      {!persistenceReady && !restoreCandidate && (
        <output className="startup-cover">
          <RefreshCw className="animate-spin" aria-hidden="true" />
          <span>前回の作業を確認しています</span>
        </output>
      )}

      {notice && (
        <output className={`app-notice notice-${notice.kind}`} aria-live="polite">
          {notice.message}
        </output>
      )}

      {busy && <output className="busy-indicator">処理中…</output>}

      <AlertDialog open={Boolean(restoreCandidate)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><RefreshCw aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>前回の作業を復元しますか</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreCandidate ? `${formatSavedAt(restoreCandidate.updatedAt)} に保存された作業があります。` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="outline" onClick={discardSavedProject}>破棄して新規</AlertDialogAction>
            <AlertDialogAction onClick={restoreSavedProject}>復元する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><AlertTriangle aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>新しいプロジェクトを開始しますか</AlertDialogTitle>
            <AlertDialogDescription>現在のキャンバスを初期状態へ戻します。この操作は「元に戻す」で復元できます。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              createNewProject();
              setNewDialogOpen(false);
            }}>新規プロジェクト</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
