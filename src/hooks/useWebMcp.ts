'use client';

import { useEffect } from 'react';

import { useEditorStore } from '@/src/store/editorStore';

const readTextInput = (input: unknown): string => {
  if (typeof input !== 'object' || input === null || !('text' in input)) {
    throw new Error('textを指定してください。');
  }
  const text = (input as { text?: unknown }).text;
  if (typeof text !== 'string' || !text.trim() || text.length > 500) {
    throw new Error('textは1〜500文字で指定してください。');
  }
  return text;
};

export function useWebMcp() {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'add_graphic_text',
        title: 'テキストグラフィックを追加',
        description: '指定した複数行テキストを、現在のキャンバス中央付近へ追加します。',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string', minLength: 1, maxLength: 500 } },
          required: ['text'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const text = readTextInput(input);
          useEditorStore.getState().addGraphic(text);
          const selectedId = useEditorStore.getState().selectedId;
          return { added: true, selectedId, lineCount: text.split('\n').length };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {
      return () => lifecycle.abort();
    }
    return () => lifecycle.abort();
  }, []);
}
