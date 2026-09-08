'use client';

import { useEffect, useRef } from 'react';

import { useEditorStore } from '@/src/store/editorStore';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
};

export function useKeyboardShortcuts() {
  const arrowTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const finishArrowTransaction = () => {
      if (arrowTimerRef.current !== null) {
        window.clearTimeout(arrowTimerRef.current);
        arrowTimerRef.current = null;
      }
      useEditorStore.getState().finishTransaction();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      const state = useEditorStore.getState();
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (commandKey && key === 'z') {
        event.preventDefault();
        state.finishTransaction();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (commandKey && key === 'y') {
        event.preventDefault();
        state.finishTransaction();
        state.redo();
        return;
      }
      if (commandKey && key === 'd') {
        event.preventDefault();
        state.finishTransaction();
        state.duplicateSelected();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!state.selectedId) return;
        event.preventDefault();
        state.finishTransaction();
        state.deleteObject();
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const selected = state.project.objects.find((object) => object.id === state.selectedId);
      if (!selected || selected.locked || selected.fullyLocked) return;
      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      const deltaX = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
      const deltaY = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
      state.beginTransaction();
      state.updateObject(selected.id, (object) => ({
        ...object,
        position: { x: object.position.x + deltaX, y: object.position.y + deltaY },
      }), false);
      if (arrowTimerRef.current !== null) window.clearTimeout(arrowTimerRef.current);
      arrowTimerRef.current = window.setTimeout(finishArrowTransaction, 240);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', finishArrowTransaction);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', finishArrowTransaction);
      finishArrowTransaction();
    };
  }, []);
}
