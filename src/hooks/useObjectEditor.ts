'use client';

import { useCallback, useEffect, useRef } from 'react';

import { useEditorStore } from '@/src/store/editorStore';
import type { GraphicTextObject } from '@/src/types/editor';

type ObjectUpdater = (object: GraphicTextObject) => GraphicTextObject;

export function useObjectEditor(objectId: string | null) {
  const timerRef = useRef<number | null>(null);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const finishTransaction = useEditorStore((state) => state.finishTransaction);
  const updateObject = useEditorStore((state) => state.updateObject);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    clearTimer();
    beginTransaction();
  }, [beginTransaction, clearTimer]);

  const finish = useCallback(() => {
    clearTimer();
    finishTransaction();
  }, [clearTimer, finishTransaction]);

  const preview = useCallback(
    (updater: ObjectUpdater) => {
      if (!objectId) return;
      beginTransaction();
      updateObject(objectId, updater, false);
      clearTimer();
      timerRef.current = window.setTimeout(finishTransaction, 450);
    },
    [beginTransaction, clearTimer, finishTransaction, objectId, updateObject],
  );

  const commit = useCallback(
    (updater: ObjectUpdater) => {
      if (!objectId) return;
      clearTimer();
      updateObject(objectId, updater, true);
    },
    [clearTimer, objectId, updateObject],
  );

  useEffect(() => () => finish(), [finish]);

  return { begin, finish, preview, commit };
}
