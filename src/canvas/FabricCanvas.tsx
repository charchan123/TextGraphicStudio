'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, FabricImage, Group } from 'fabric';

import { createFabricGraphicText } from '@/src/canvas/graphicTextRenderer';
import { prepareGraphicAssets } from '@/src/services/textBackgroundAssets';
import { waitForGraphicFonts } from '@/src/services/fontService';
import { GuideOverlay } from '@/src/canvas/GuideOverlay';
import { SocialGuideOverlay } from '@/src/canvas/SocialGuideOverlay';
import { useEditorStore } from '@/src/store/editorStore';

interface DisplaySize {
  width: number;
  height: number;
}

export function FabricCanvas() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasInstanceRef = useRef<Canvas | null>(null);
  const groupMapRef = useRef(new Map<string, Group>());
  const idMapRef = useRef(new WeakMap<object, string>());
  const [canvasReady, setCanvasReady] = useState(false);
  const [displaySize, setDisplaySize] = useState<DisplaySize>({ width: 960, height: 540 });

  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const canvasAspectRatio = useMemo(
    () => `${project.canvas.width} / ${project.canvas.height}`,
    [project.canvas.height, project.canvas.width],
  );

  useEffect(() => {
    const element = canvasElementRef.current;
    if (!element) return;
    const initialCanvas = useEditorStore.getState().project.canvas;
    const instance = new Canvas(element, {
      width: initialCanvas.width,
      height: initialCanvas.height,
      backgroundColor: '#FFFFFF',
      preserveObjectStacking: true,
      selection: false,
      renderOnAddRemove: false,
      enableRetinaScaling: false,
    });

    const syncSelection = () => {
      const activeObject = instance.getActiveObject();
      const id = activeObject ? idMapRef.current.get(activeObject) ?? null : null;
      useEditorStore.getState().selectObject(id);
    };

    instance.on('selection:created', syncSelection);
    instance.on('selection:updated', syncSelection);
    instance.on('selection:cleared', () => useEditorStore.getState().selectObject(null));
    instance.on('object:modified', ({ target }) => {
      if (!target) return;
      const id = idMapRef.current.get(target);
      if (!id) return;
      const center = target.getCenterPoint();
      useEditorStore.getState().updateObject(id, (object) => ({
        ...object,
        position: { x: center.x, y: center.y },
        transform: {
          scaleX: target.scaleX || 1,
          scaleY: target.scaleY || 1,
          rotation: target.angle || 0,
        },
      }));
    });

    const groups = groupMapRef.current;
    useEditorStore.getState().setFabricCanvas(instance);
    canvasInstanceRef.current = instance;
    setCanvasReady(true);

    return () => {
      groups.clear();
      idMapRef.current = new WeakMap<object, string>();
      useEditorStore.getState().setFabricCanvas(null);
      canvasInstanceRef.current = null;
      setCanvasReady(false);
      void instance.dispose();
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateFit = () => {
      const availableWidth = Math.max(240, viewport.clientWidth - 44);
      const availableHeight = Math.max(160, viewport.clientHeight - 44);
      const scale = Math.min(
        availableWidth / project.canvas.width,
        availableHeight / project.canvas.height,
        1,
      );
      const width = Math.max(160, Math.round(project.canvas.width * scale));
      const height = Math.max(90, Math.round(project.canvas.height * scale));
      setDisplaySize({ width, height });
      useEditorStore.getState().setZoomPercent(Math.round(scale * 100));
    };
    const observer = new ResizeObserver(updateFit);
    observer.observe(viewport);
    updateFit();
    return () => observer.disconnect();
  }, [project.canvas.height, project.canvas.width]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvasReady || !canvas) return;
    canvas.setDimensions({ width: project.canvas.width, height: project.canvas.height });
    canvas.backgroundColor = '#FFFFFF';
    canvas.setDimensions(
      { width: `${displaySize.width}px`, height: `${displaySize.height}px` },
      { cssOnly: true },
    );
    canvas.calcOffset();
    canvas.requestRenderAll();
  }, [canvasReady, displaySize.height, displaySize.width, project.canvas.height, project.canvas.width]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvasReady || !canvas) return;
    let cancelled = false;
    const rebuild = async () => {
    await Promise.all([
      prepareGraphicAssets(project.objects),
      waitForGraphicFonts(project.objects),
    ]);
    if (cancelled) return;
    const desiredSelectedId = useEditorStore.getState().selectedId;
    const previousGroups = [...groupMapRef.current.values()];
    canvas.discardActiveObject();
    if (previousGroups.length > 0) canvas.remove(...previousGroups);
    groupMapRef.current.clear();
    idMapRef.current = new WeakMap<object, string>();

    const visibleObjects = [...project.objects]
      .sort((left, right) => left.zIndex - right.zIndex)
      .filter((object) => object.visible);

    for (const object of visibleObjects) {
      const rendered = createFabricGraphicText(object);
      groupMapRef.current.set(object.id, rendered.group);
      idMapRef.current.set(rendered.group, object.id);
      canvas.add(rendered.group);
      queueMicrotask(() => {
        useEditorStore.getState().syncObjectSize(
          object.id,
          rendered.intrinsicWidth,
          rendered.intrinsicHeight,
        );
      });
    }

    const activeGroup = desiredSelectedId ? groupMapRef.current.get(desiredSelectedId) : undefined;
    if (activeGroup) canvas.setActiveObject(activeGroup);
    else if (desiredSelectedId) useEditorStore.getState().selectObject(desiredSelectedId);
    canvas.requestRenderAll();
    };
    void rebuild().catch((error: unknown) => {
      if (!cancelled) useEditorStore.getState().setNotice(error instanceof Error ? error.message : 'テキスト背景を表示できませんでした。', 'error');
    });
    return () => { cancelled = true; };
  }, [canvasReady, project.objects]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvasReady || !canvas) return;
    const activeGroup = selectedId ? groupMapRef.current.get(selectedId) : undefined;
    // A new selection can arrive before its image-backed group is prepared.
    // Do not clear the store selection while the asynchronous rebuild is pending.
    if (selectedId && !activeGroup) return;
    if (activeGroup) {
      if (canvas.getActiveObject() !== activeGroup) canvas.setActiveObject(activeGroup);
    } else if (canvas.getActiveObject()) {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();
  }, [canvasReady, selectedId]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvasReady || !canvas) return;
    let cancelled = false;
    const background = project.backgroundImage;
    if (!background) {
      canvas.backgroundImage = undefined;
      canvas.requestRenderAll();
      return;
    }

    void FabricImage.fromURL(background.dataUrl, {}, { selectable: false, evented: false })
      .then((image) => {
        if (cancelled) return;
        const sourceWidth = Math.max(1, image.width);
        const sourceHeight = Math.max(1, image.height);
        const scale = project.canvas.height / sourceHeight;
        image.set({
          left: project.canvas.width / 2,
          top: project.canvas.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });
        image.setCoords();
        canvas.backgroundImage = image;
        canvas.requestRenderAll();
        void sourceWidth;
      })
      .catch(() => {
        if (!cancelled) {
          useEditorStore.getState().setNotice('背景画像を表示できませんでした。', 'error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canvasReady, project.backgroundImage, project.canvas.height, project.canvas.width]);

  return (
    <div ref={viewportRef} className="canvas-viewport fabric-viewport">
      <div
        className="fabric-mount"
        style={{ width: displaySize.width, height: displaySize.height, aspectRatio: canvasAspectRatio }}
      >
        <canvas ref={canvasElementRef} aria-label="テキストグラフィック編集キャンバス" />
        <GuideOverlay visible={project.canvas.guidesVisible} />
        <SocialGuideOverlay guide={project.canvas.socialGuide} />
      </div>
    </div>
  );
}
