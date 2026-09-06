import { cloneFill } from '@/src/services/documentData';
import {
  applyPartialStrokeEdits,
  createPartialStrokeEdits,
  STROKE_KEYS,
  type PartialStrokeEdits,
} from '@/src/services/strokes';
import type {
  GraphicTextObject,
  PartialTextStyle,
  QuickPartialPreset,
  QuickPartialStyleOperation,
  QuickPartialStrokeOperation,
  StrokeLayerKey,
} from '@/src/types/editor';

export const MAX_QUICK_PARTIAL_PRESETS = 8;

const cloneStyle = (style: QuickPartialStyleOperation['style']): QuickPartialStyleOperation['style'] => ({
  ...style,
  ...(style.fill ? { fill: cloneFill(style.fill) } : {}),
});

export const cloneQuickPartialOperation = (operation: QuickPartialStyleOperation): QuickPartialStyleOperation => ({
  style: cloneStyle(operation.style),
  ...(operation.strokes ? {
    strokes: Object.fromEntries(Object.entries(operation.strokes).map(([key, layer]) => [key, {
      ...layer,
      ...(layer?.color ? { color: { ...layer.color } } : {}),
      ...(layer?.width ? { width: { ...layer.width } } : {}),
    }])) as QuickPartialStyleOperation['strokes'],
  } : {}),
});

export const cloneQuickPartialPreset = (preset: QuickPartialPreset): QuickPartialPreset => ({
  ...preset,
  operation: cloneQuickPartialOperation(preset.operation),
});

export const hasQuickPartialOperation = (operation: QuickPartialStyleOperation): boolean =>
  Object.keys(operation.style).length > 0
  || Boolean(operation.strokes && Object.values(operation.strokes).some((layer) => layer && Object.keys(layer).length > 0));

const compactStrokeOperation = (edit: PartialStrokeEdits[StrokeLayerKey]): QuickPartialStrokeOperation | null => {
  const operation: QuickPartialStrokeOperation = {};
  if (edit.enabled !== 'keep') operation.enabled = edit.enabled;
  if (edit.color === 'inherit') operation.color = { action: 'inherit' };
  if (edit.color === 'change') operation.color = { action: 'change', value: edit.colorValue };
  if (edit.width === 'inherit') operation.width = { action: 'inherit' };
  if (edit.width === 'change') operation.width = { action: 'change', value: edit.widthValue };
  return Object.keys(operation).length ? operation : null;
};

export const createQuickPartialOperation = (
  style: QuickPartialStyleOperation['style'],
  strokeEdits: PartialStrokeEdits,
): QuickPartialStyleOperation => {
  const strokes = Object.fromEntries(STROKE_KEYS.flatMap((key) => {
    const operation = compactStrokeOperation(strokeEdits[key]);
    return operation ? [[key, operation]] : [];
  })) as QuickPartialStyleOperation['strokes'];
  return {
    style: cloneStyle(style),
    ...(Object.keys(strokes ?? {}).length ? { strokes } : {}),
  };
};

const expandStrokeEdits = (
  model: GraphicTextObject,
  start: number,
  end: number,
  operations?: QuickPartialStyleOperation['strokes'],
): PartialStrokeEdits => {
  const edits = createPartialStrokeEdits(model, start, end);
  STROKE_KEYS.forEach((key) => {
    const operation = operations?.[key];
    if (!operation) return;
    if (operation.enabled) edits[key].enabled = operation.enabled;
    if (operation.color?.action === 'inherit') edits[key].color = 'inherit';
    if (operation.color?.action === 'change') {
      edits[key].color = 'change';
      edits[key].colorValue = operation.color.value;
    }
    if (operation.width?.action === 'inherit') edits[key].width = 'inherit';
    if (operation.width?.action === 'change') {
      edits[key].width = 'change';
      edits[key].widthValue = operation.width.value;
    }
  });
  return edits;
};

/** One call applies the shortcut as one history operation while retaining unrelated leaves. */
export const applyQuickPartialOperation = (
  model: GraphicTextObject,
  start: number,
  end: number,
  operation: QuickPartialStyleOperation,
): GraphicTextObject => {
  if (start >= end || end > model.text.length || !hasQuickPartialOperation(operation)) return model;
  const strokeEdits = expandStrokeEdits(model, start, end, operation.strokes);
  const withStrokes = applyPartialStrokeEdits(model.partialStyles, start, end, strokeEdits);
  const hasStyle = Object.keys(operation.style).length > 0;
  const rangeStyle: PartialTextStyle = { start, end, ...cloneStyle(operation.style) };
  return {
    ...model,
    partialStyles: hasStyle ? [...withStrokes, rangeStyle] : withStrokes,
  };
};
