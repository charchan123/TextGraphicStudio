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
import { OutputPreviewDialog, type OutputPreview } from '@/src/components/OutputPreviewDialog';
import { ProjectTextOverviewDialog } from '@/src/components/ProjectTextOverviewDialog';
import { Storyboard, type StoryboardPlacement } from '@/src/components/Storyboard';
import { useKeyboardShortcuts } from '@/src/hooks/useKeyboardShortcuts';
import { useClientHydrated } from '@/src/hooks/useClientHydrated';
import { useWebMcp } from '@/src/hooks/useWebMcp';
import { exportAllFramesPng, exportAllFramesZip, exportAllGraphicsPng, exportGraphicPng, exportProjectPng, renderProjectPngBlob } from '@/src/services/exportService';
import { loadBackgroundFile } from '@/src/services/imageService';
import { getFontRestoreWarning } from '@/src/services/fontService';
import {
  clearAutosave,
  loadAutosave,
  loadLastUsedTextDefaults,
  loadQuickPartialPresets,
  saveAutosave,
  saveLastUsedTextDefaults,
  saveQuickPartialPresets,
} from '@/src/services/persistence';
import { loadPalettePreference, savePalettePreference } from '@/src/services/palettePreference';
import { createTemplate, downloadTemplate, readTemplateFile } from '@/src/services/templateService';
import { downloadProjectFile, readProjectFile } from '@/src/services/projectFileService';
import { createStudioProject } from '@/src/services/studioProject';
import { useEditorStore } from '@/src/store/editorStore';
import type { StudioProject } from '@/src/types/editor';

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

const storyboardPlacementForCanvas = (width: number, height: number): Exclude<StoryboardPlacement, 'hidden'> =>
  width > height ? 'top' : 'left';

export function EditorApp() {
  const clientHydrated = useClientHydrated();
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<StudioProject | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pendingProjectImport, setPendingProjectImport] = useState<StudioProject | null>(null);
  const [outputPreview, setOutputPreview] = useState<OutputPreview | null>(null);
  const [outputPreviewNavigating, setOutputPreviewNavigating] = useState(false);
  const outputPreviewRequest = useRef(0);
  const [textOverviewOpen, setTextOverviewOpen] = useState(false);
  const [storyboardPlacement, setStoryboardPlacement] = useState<StoryboardPlacement>(() => {
    const canvas = useEditorStore.getState().project.canvas;
    return storyboardPlacementForCanvas(canvas.width, canvas.height);
  });
  const [storyboardCollapsed, setStoryboardCollapsed] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('text');
  const [canvasEditRequest, setCanvasEditRequest] = useState(0);

  const project = useEditorStore((state) => state.project);
  const studioProject = useEditorStore((state) => state.studioProject);
  const selectedId = useEditorStore((state) => state.selectedId);
  const zoomPercent = useEditorStore((state) => state.zoomPercent);
  const notice = useEditorStore((state) => state.notice);
  const quickPartialPresetCount = useEditorStore((state) => state.quickPartialPresets.length);
  const setNotice = useEditorStore((state) => state.setNotice);
  const clearNotice = useEditorStore((state) => state.clearNotice);
  const replaceProject = useEditorStore((state) => state.replaceProject);
  const replaceStudioProject = useEditorStore((state) => state.replaceStudioProject);
  const createNewProject = useEditorStore((state) => state.createNewProject);
  const setBackgroundImage = useEditorStore((state) => state.setBackgroundImage);
  const applyTemplate = useEditorStore((state) => state.applyTemplate);
  const hydrateLastUsedTextDefaults = useEditorStore((state) => state.hydrateLastUsedTextDefaults);
  const hydrateQuickPartialPresets = useEditorStore((state) => state.hydrateQuickPartialPresets);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;

  useKeyboardShortcuts();
  useWebMcp();

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadAutosave(),
      loadLastUsedTextDefaults().catch(() => null),
      loadQuickPartialPresets().catch(() => []),
    ])
      .then(([savedProject, lastUsedTextDefaults, quickPartialPresets]) => {
        if (cancelled) return;
        if (lastUsedTextDefaults) hydrateLastUsedTextDefaults(lastUsedTextDefaults);
        hydrateQuickPartialPresets(quickPartialPresets);
        if (savedProject) setRestoreCandidate(savedProject);
        else {
          replaceProject({ ...useEditorStore.getState().project, palette: loadPalettePreference() });
          setPersistenceReady(true);
        }
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
  }, [hydrateLastUsedTextDefaults, hydrateQuickPartialPresets, replaceProject, setNotice]);

  useEffect(() => {
    savePalettePreference(project.palette);
  }, [project.palette]);

  useEffect(() => {
    if (!persistenceReady) return;
    let timer: number | null = null;
    let saveErrorShown = false;
    const scheduleSave = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveAutosave(useEditorStore.getState().getStudioProjectSnapshot()).catch(() => {
          if (!saveErrorShown) {
            saveErrorShown = true;
            useEditorStore.getState().setNotice('自動保存に失敗しました。ブラウザの空き容量を確認してください。', 'error');
          }
        });
      }, 900);
    };
    let previousDocument = useEditorStore.getState().project;
    let previousStudioProject = useEditorStore.getState().studioProject;
    scheduleSave();
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.project === previousDocument && state.studioProject === previousStudioProject) return;
      previousDocument = state.project;
      previousStudioProject = state.studioProject;
      scheduleSave();
    });
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        if (timer !== null) window.clearTimeout(timer);
        void saveAutosave(useEditorStore.getState().getStudioProjectSnapshot()).catch(() => undefined);
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
    if (!persistenceReady) return;
    let timer: number | null = null;
    let previous = useEditorStore.getState().quickPartialPresets;
    const schedule = (presets: typeof previous) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void saveQuickPartialPresets(presets).catch(() => undefined), 500);
    };
    schedule(previous);
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.quickPartialPresets === previous) return;
      previous = state.quickPartialPresets;
      schedule(previous);
    });
    return () => {
      unsubscribe();
      if (timer !== null) {
        window.clearTimeout(timer);
        void saveQuickPartialPresets(previous).catch(() => undefined);
      }
    };
  }, [persistenceReady]);

  useEffect(() => {
    if (!persistenceReady) return;
    let timer: number | null = null;
    let previous = useEditorStore.getState().lastUsedTextDefaults;
    const schedule = (defaults: typeof previous) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void saveLastUsedTextDefaults(defaults).catch(() => undefined), 500);
    };
    schedule(previous);
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.lastUsedTextDefaults === previous) return;
      previous = state.lastUsedTextDefaults;
      schedule(previous);
    });
    return () => {
      unsubscribe();
      if (timer !== null) {
        window.clearTimeout(timer);
        void saveLastUsedTextDefaults(previous).catch(() => undefined);
      }
    };
  }, [persistenceReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 3600);
    return () => window.clearTimeout(timer);
  }, [clearNotice, notice]);

  useEffect(() => () => {
    if (outputPreview?.url) URL.revokeObjectURL(outputPreview.url);
  }, [outputPreview?.url]);

  useEffect(() => {
    if (!canvasEditRequest) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const textField = document.querySelector<HTMLElement>('[aria-label="選択中のテキスト内容"]');
      textField?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      textField?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [canvasEditRequest]);

  const resetStoryboardLayout = (width: number, height: number) => {
    setStoryboardPlacement(storyboardPlacementForCanvas(width, height));
    setStoryboardCollapsed(false);
  };

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

  const handleOutputPreview = () => {
    const requestId = outputPreviewRequest.current + 1;
    outputPreviewRequest.current = requestId;
    setOutputPreview(null);
    void runTask(async () => {
      const snapshot = useEditorStore.getState().getStudioProjectSnapshot();
      const activeIndex = Math.max(0, snapshot.frames.findIndex((frame) => frame.frameId === snapshot.activeFrameId));
      const frame = snapshot.frames[activeIndex];
      const blob = await renderProjectPngBlob(frame.document);
      const url = URL.createObjectURL(blob);
      if (requestId !== outputPreviewRequest.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setOutputPreview({
        url,
        width: frame.document.canvas.width,
        height: frame.document.canvas.height,
        frameId: frame.frameId,
        frameIndex: activeIndex,
        frameCount: snapshot.frames.length,
      });
    }, '最新の出力プレビューを生成しました。');
  };

  const closeOutputPreview = () => {
    outputPreviewRequest.current += 1;
    setOutputPreviewNavigating(false);
    setOutputPreview(null);
  };

  const navigateOutputPreview = (offset: -1 | 1) => {
    if (!outputPreview || outputPreviewNavigating) return;
    const snapshot = useEditorStore.getState().getStudioProjectSnapshot();
    const currentIndex = snapshot.frames.findIndex((frame) => frame.frameId === outputPreview.frameId);
    const targetIndex = currentIndex + offset;
    const targetFrame = snapshot.frames[targetIndex];
    if (currentIndex < 0 || !targetFrame) return;

    const requestId = outputPreviewRequest.current + 1;
    outputPreviewRequest.current = requestId;
    setOutputPreviewNavigating(true);
    void renderProjectPngBlob(targetFrame.document)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (requestId !== outputPreviewRequest.current) {
          URL.revokeObjectURL(url);
          return;
        }
        setOutputPreview({
          url,
          width: targetFrame.document.canvas.width,
          height: targetFrame.document.canvas.height,
          frameId: targetFrame.frameId,
          frameIndex: targetIndex,
          frameCount: snapshot.frames.length,
        });
      })
      .catch((error) => {
        if (requestId === outputPreviewRequest.current) {
          setNotice(error instanceof Error ? error.message : 'プレビューを生成できませんでした。', 'error');
        }
      })
      .finally(() => {
        if (requestId === outputPreviewRequest.current) setOutputPreviewNavigating(false);
      });
  };

  const handleProjectExport = () => {
    downloadProjectFile(useEditorStore.getState().getStudioProjectSnapshot());
    setNotice('プロジェクトを1ファイルへ書き出しました。', 'success');
  };

  const handleProjectFile = (file: File) => {
    setBusy(true);
    void readProjectFile(file)
      .then(setPendingProjectImport)
      .catch((error) => setNotice(error instanceof Error ? error.message : 'プロジェクトを読み込めませんでした。', 'error'))
      .finally(() => setBusy(false));
  };

  const confirmProjectImport = () => {
    if (!pendingProjectImport) return;
    const activeDocument = pendingProjectImport.frames.find((frame) => frame.frameId === pendingProjectImport.activeFrameId)?.document
      ?? pendingProjectImport.frames[0]?.document;
    if (activeDocument) resetStoryboardLayout(activeDocument.canvas.width, activeDocument.canvas.height);
    replaceStudioProject(pendingProjectImport);
    const warning = pendingProjectImport.frames.map((frame) => getFontRestoreWarning(frame.document)).find(Boolean) ?? null;
    setPendingProjectImport(null);
    setNotice(warning ?? 'プロジェクトを読み込みました。', warning ? 'warning' : 'success');
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

  const handleExportFrames = () => {
    void runTask(async () => {
      const count = await exportAllFramesPng(useEditorStore.getState().getStudioProjectSnapshot());
      if (!count) throw new Error('書き出せるコマがありません。');
    }, '全コマを現在順のPNGで保存しました。');
  };

  const handleExportFramesZip = () => {
    void runTask(() => exportAllFramesZip(useEditorStore.getState().getStudioProjectSnapshot()), '全コマをZIP保存しました。');
  };

  const handleSaveTemplate = (includePosition: boolean) => {
    const object = useEditorStore.getState().project.objects.find(
      (item) => item.id === useEditorStore.getState().selectedId,
    );
    if (!object) {
      setNotice('テンプレートにするテキストを選択してください。', 'warning');
      return;
    }
    const currentProject = useEditorStore.getState().project;
    downloadTemplate(createTemplate(object, includePosition, currentProject.palette, currentProject.fontCatalog), object.name);
    setNotice('テンプレートJSONを保存しました。', 'success');
  };

  const handleTemplateFile = (file: File) => {
    void runTask(async () => {
      const template = await readTemplateFile(file);
      applyTemplate(template);
    }, 'テンプレートを選択中のテキストへ適用しました。').then(() => {
      const warning = getFontRestoreWarning(useEditorStore.getState().project);
      if (warning) setNotice(warning, 'warning');
    });
  };

  const restoreSavedProject = () => {
    if (!restoreCandidate) return;
    const activeDocument = restoreCandidate.frames.find((frame) => frame.frameId === restoreCandidate.activeFrameId)?.document
      ?? restoreCandidate.frames[0]?.document;
    if (activeDocument) resetStoryboardLayout(activeDocument.canvas.width, activeDocument.canvas.height);
    replaceStudioProject(restoreCandidate);
    setRestoreCandidate(null);
    setPersistenceReady(true);
    const warning = restoreCandidate.frames.map((frame) => getFontRestoreWarning(frame.document)).find(Boolean) ?? null;
    setNotice(warning ?? '前回の作業を復元しました。', warning ? 'warning' : 'success');
  };

  const discardSavedProject = () => {
    const fontCatalog = restoreCandidate?.frames.flatMap((frame) => frame.document.fontCatalog) ?? project.fontCatalog;
    const nextProject = createStudioProject(loadPalettePreference(), fontCatalog);
    const nextDocument = nextProject.frames[0].document;
    resetStoryboardLayout(nextDocument.canvas.width, nextDocument.canvas.height);
    replaceStudioProject(nextProject);
    setRestoreCandidate(null);
    setPersistenceReady(true);
    void clearAutosave().catch(() => undefined);
    setNotice('新しいプロジェクトを開始しました。', 'info');
  };

  const editTextOnCanvas = (frameId: string, objectId: string) => {
    const snapshot = useEditorStore.getState().getStudioProjectSnapshot();
    const frame = snapshot.frames.find((item) => item.frameId === frameId);
    const object = frame?.document.objects.find((item) => item.id === objectId && item.kind === 'graphic-text');
    if (!frame || !object) {
      setNotice('対象のテキストが見つかりませんでした。', 'error');
      return;
    }
    useEditorStore.getState().selectFrame(frameId);
    useEditorStore.getState().selectObject(objectId);
    setTextOverviewOpen(false);
    setInspectorTab('text');
    setCanvasEditRequest((value) => value + 1);
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
      data-selected-glyph-scale-x={selected?.typography.glyphScaleX ?? 1}
      data-selected-glyph-scale-y={selected?.typography.glyphScaleY ?? 1}
      data-selected-font-style={selected?.typography.fontStyle ?? 'normal'}
      data-selected-font-ref-id={selected?.typography.fontRefId ?? ''}
      data-selected-background-image-mode={selected?.background.imageMode ?? 'fixed'}
      data-selected-background-offset-x={selected?.background.offsetX ?? 0}
      data-selected-background-offset-y={selected?.background.offsetY ?? 0}
      data-selected-character-scale={selected ? JSON.stringify(selected.characterScale) : ''}
      data-quick-partial-preset-count={quickPartialPresetCount}
      data-selected-line-gap-offsets={selected ? JSON.stringify(selected.lineGapOffsets ?? []) : ''}
      data-project-id={clientHydrated ? studioProject.projectId : undefined}
      data-project-name={studioProject.projectName}
      data-frame-count={studioProject.frames.length}
      data-active-frame-id={clientHydrated ? studioProject.activeFrameId : undefined}
      data-active-frame-locked={String(studioProject.frames.find((frame) => frame.frameId === studioProject.activeFrameId)?.completedLocked ?? false)}
    >
      <EditorToolbar
        busy={busy}
        onRequestNew={() => setNewDialogOpen(true)}
        onBackgroundFile={handleBackgroundFile}
        onPreview={handleOutputPreview}
        onOpenTextOverview={() => setTextOverviewOpen(true)}
        onProjectExport={handleProjectExport}
        onProjectFile={handleProjectFile}
        onExportProject={handleExportProject}
        onExportSelected={handleExportSelected}
        onExportAll={handleExportAll}
        onExportFrames={handleExportFrames}
        onExportFramesZip={handleExportFramesZip}
        onSaveTemplate={handleSaveTemplate}
        onLoadTemplate={() => templateInputRef.current?.click()}
        storyboardPlacement={storyboardPlacement}
        onStoryboardPlacementChange={(placement) => {
          setStoryboardPlacement(placement);
          setStoryboardCollapsed(false);
        }}
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

      <section className={`editor-body storyboard-layout-${storyboardPlacement}${storyboardCollapsed ? ' is-storyboard-collapsed' : ''}`} data-storyboard-placement={storyboardPlacement} data-storyboard-collapsed={String(storyboardCollapsed)}>
        {storyboardPlacement !== 'hidden' && <Storyboard placement={storyboardPlacement} collapsed={storyboardCollapsed} onCollapsedChange={setStoryboardCollapsed} />}
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
          activeTab={inspectorTab}
          onActiveTabChange={setInspectorTab}
          busy={busy}
          onExportProject={handleExportProject}
          onExportSelected={handleExportSelected}
          onExportAll={handleExportAll}
          onExportFrames={handleExportFrames}
          onExportFramesZip={handleExportFramesZip}
          onSaveTemplate={handleSaveTemplate}
          onLoadTemplate={() => templateInputRef.current?.click()}
        />
        </section>
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

      {outputPreview && <OutputPreviewDialog
        preview={outputPreview}
        navigating={outputPreviewNavigating}
        onPrevious={() => navigateOutputPreview(-1)}
        onNext={() => navigateOutputPreview(1)}
        onClose={closeOutputPreview}
      />}
      {textOverviewOpen && <ProjectTextOverviewDialog open onOpenChange={setTextOverviewOpen} onEditOnCanvas={editTextOnCanvas} />}

      <AlertDialog open={Boolean(pendingProjectImport)} onOpenChange={(open) => { if (!open) setPendingProjectImport(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><AlertTriangle aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>プロジェクトを読み込みますか</AlertDialogTitle>
            <AlertDialogDescription>現在の作業内容を置き換えます。個人用のクイック部分プリセットと最後に使用した全体設定は変更されません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmProjectImport}>読み込む</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(restoreCandidate)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><RefreshCw aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>前回の作業を復元しますか</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreCandidate ? `${formatSavedAt(restoreCandidate.updatedAt)} に保存された${restoreCandidate.frames.length}コマの作業があります。` : ''}
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
            <AlertDialogDescription>現在のProject全体を新しい1コマ構成へ置き換えます。この操作は元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              createNewProject();
              const canvas = useEditorStore.getState().project.canvas;
              resetStoryboardLayout(canvas.width, canvas.height);
              setNewDialogOpen(false);
            }}>新規プロジェクト</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
