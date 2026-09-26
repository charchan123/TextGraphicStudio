import { useEditorStore } from '@/src/store/editorStore';

export type HistoryShortcutAction = 'undo' | 'redo';

type HistoryShortcutEvent = Pick<
  KeyboardEvent,
  | 'altKey'
  | 'ctrlKey'
  | 'defaultPrevented'
  | 'isComposing'
  | 'key'
  | 'metaKey'
  | 'preventDefault'
  | 'repeat'
  | 'shiftKey'
  | 'stopPropagation'
>;

interface HistoryCommands {
  undo: () => void;
  redo: () => void;
}

export const performUndo = () => {
  const state = useEditorStore.getState();
  state.finishTransaction();
  state.undo();
};

export const performRedo = () => {
  const state = useEditorStore.getState();
  state.finishTransaction();
  state.redo();
};

const defaultCommands: HistoryCommands = {
  undo: performUndo,
  redo: performRedo,
};

export const getHistoryShortcutAction = (
  event: Pick<HistoryShortcutEvent, 'altKey' | 'ctrlKey' | 'isComposing' | 'key' | 'metaKey' | 'shiftKey'>,
): HistoryShortcutAction | null => {
  if (event.isComposing || event.altKey || (!event.ctrlKey && !event.metaKey)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) return 'redo';
  return null;
};

export const handleHistoryShortcut = (
  event: HistoryShortcutEvent,
  commands: HistoryCommands = defaultCommands,
): boolean => {
  const action = getHistoryShortcutAction(event);
  if (!action || event.defaultPrevented) return false;

  // Always suppress the native editable-element history for app-level shortcuts.
  event.preventDefault();
  event.stopPropagation();

  // A held key emits repeated keydown events. Keep them from consuming history.
  if (event.repeat) return true;

  commands[action]();
  return true;
};
