import type { GraphicTextObject, PartialStrokeLayers, PartialTextStyle, StrokeLayers, StrokeLayerKey, StrokeStyle } from '@/src/types/editor';

export const STROKE_KEYS: StrokeLayerKey[] = ['1', '2', '3'];
export const EMPTY_THIRD_STROKE: StrokeStyle = { enabled: false, color: '#000000', width: 4 };

// Read-time repair prefers retaining an enabled outer layer over silently removing it.
export const normalizeStrokeLayers = (layers: StrokeLayers): StrokeLayers => {
  const result = layers.map((layer) => ({ ...layer })) as StrokeLayers;
  for (let index = 2; index > 0; index -= 1) {
    if (result[index].enabled) result[index - 1].enabled = true;
  }
  return result;
};

export const getStrokeLayers = (model: Pick<GraphicTextObject, 'stroke' | 'outerStroke' | 'strokes'>): StrokeLayers =>
  normalizeStrokeLayers(model.strokes ?? [model.stroke, model.outerStroke, EMPTY_THIRD_STROKE]);

export const clonePartialStrokes = (layers?: PartialStrokeLayers): PartialStrokeLayers | undefined => {
  if (!layers) return undefined;
  const result: PartialStrokeLayers = Object.fromEntries(STROKE_KEYS.filter((key) => layers[key]).map((key) => [key, { ...layers[key] }]));
  // Only dependency-related enabled flags are supplemented; colors/widths remain untouched.
  const highestOn = STROKE_KEYS.reduce((highest, key, index) => result[key]?.enabled === true ? index : highest, -1);
  for (let index = 0; index < highestOn; index += 1) result[STROKE_KEYS[index]] = { ...result[STROKE_KEYS[index]], enabled: true };
  for (let index = highestOn + 1; index < 3; index += 1) {
    if (result[STROKE_KEYS[index]]?.enabled === false) {
      for (let outer = index + 1; outer < 3; outer += 1) result[STROKE_KEYS[outer]] = { ...result[STROKE_KEYS[outer]], enabled: false };
      break;
    }
  }
  return result;
};

export const mergeStrokePatch = (layers: StrokeLayers, patch?: PartialStrokeLayers): StrokeLayers => layers.map((layer, index) => {
  const next = { ...layer };
  const update = patch?.[STROKE_KEYS[index]];
  // Merge leaf properties, including false and 0. Undefined never erases an inherited value.
  if (update?.enabled !== undefined) next.enabled = update.enabled;
  if (update?.color !== undefined) next.color = update.color;
  if (update?.width !== undefined) next.width = update.width;
  return next;
}) as StrokeLayers;

export const updateStrokeLayer = (model: GraphicTextObject, index: number, patch: Partial<StrokeStyle>): GraphicTextObject => {
  const current = getStrokeLayers(model);
  if (patch.enabled === true && index > 0 && !current[index - 1].enabled) return model;
  const strokes = mergeStrokePatch(current, { [STROKE_KEYS[index]]: patch });
  if (patch.enabled === false) for (let outer = index + 1; outer < 3; outer += 1) strokes[outer].enabled = false;
  return { ...model, strokes, stroke: { ...strokes[0] }, outerStroke: { ...strokes[1] } };
};

export const effectiveStrokesAt = (model: GraphicTextObject, start: number, end: number): StrokeLayers =>
  model.partialStyles.reduce((layers, range) => range.end > start && range.start < end
    ? mergeStrokePatch(layers, clonePartialStrokes(range.strokes)) : layers, getStrokeLayers(model));

export const strokeLayersInRange = (model: GraphicTextObject, start: number, end: number): StrokeLayers[] => {
  const points = new Set([start, ...model.partialStyles.flatMap((range) => [range.start, range.end]).filter((point) => point > start && point < end)]);
  return [...points].map((point) => effectiveStrokesAt(model, point, point + 1));
};

export const visibleStrokeWidth = (layers: StrokeLayers): number =>
  layers.reduce((width, layer) => width + (layer.enabled ? layer.width : 0), 0);

export const maxVisibleStrokeWidth = (model: GraphicTextObject): number => {
  let width = visibleStrokeWidth(getStrokeLayers(model));
  const points = new Set([0, ...model.partialStyles.flatMap((range) => [range.start, range.end])]);
  points.forEach((point) => { if (point < model.text.length) width = Math.max(width, visibleStrokeWidth(effectiveStrokesAt(model, point, point + 1))); });
  return width;
};

export type PartialStrokeEnabledAction = 'keep' | 'inherit' | 'on' | 'off';
export type PartialStrokeValueAction = 'keep' | 'inherit' | 'change';
export interface PartialStrokeEdit {
  enabled: PartialStrokeEnabledAction;
  color: PartialStrokeValueAction;
  width: PartialStrokeValueAction;
  colorValue: string;
  widthValue: number;
}
export type PartialStrokeEdits = Record<StrokeLayerKey, PartialStrokeEdit>;

export const createPartialStrokeEdits = (model: GraphicTextObject, start: number, end: number): PartialStrokeEdits => {
  const layers = strokeLayersInRange(model, start, end)[0] ?? getStrokeLayers(model);
  return Object.fromEntries(STROKE_KEYS.map((key, index) => [key, {
    enabled: 'keep', color: 'keep', width: 'keep',
    colorValue: layers[index].color, widthValue: layers[index].width,
  }])) as PartialStrokeEdits;
};

const hasPartialProperties = (style: PartialTextStyle): boolean =>
  Object.entries(style).some(([key, value]) => key !== 'start' && key !== 'end' && value !== undefined);

const cloneRawPartialStrokes = (layers?: PartialStrokeLayers): PartialStrokeLayers | undefined => layers
  ? Object.fromEntries(STROKE_KEYS.filter((key) => layers[key]).map((key) => [key, { ...layers[key] }]))
  : undefined;

export const clearRangeStrokeLeaf = (
  styles: PartialTextStyle[], start: number, end: number, layerKey: StrokeLayerKey, property: keyof StrokeStyle,
): PartialTextStyle[] => styles.flatMap((style) => {
  if (style.end <= start || style.start >= end || style.strokes?.[layerKey]?.[property] === undefined) return [style];
  const pieces: PartialTextStyle[] = [];
  if (style.start < start) pieces.push({ ...style, end: start, strokes: cloneRawPartialStrokes(style.strokes) });
  const middle: PartialTextStyle = { ...style, start: Math.max(style.start, start), end: Math.min(style.end, end), strokes: cloneRawPartialStrokes(style.strokes) };
  const strokes = middle.strokes;
  if (strokes?.[layerKey]) {
    const layer = { ...strokes[layerKey] };
    delete layer[property];
    if (Object.keys(layer).length) strokes[layerKey] = layer; else delete strokes[layerKey];
    if (!Object.keys(strokes).length) delete middle.strokes;
  }
  if (hasPartialProperties(middle)) pieces.push(middle);
  if (style.end > end) pieces.push({ ...style, start: end, strokes: cloneRawPartialStrokes(style.strokes) });
  return pieces;
});

export const hasPartialStrokeEdits = (edits: PartialStrokeEdits): boolean => STROKE_KEYS.some((key) => {
  const edit = edits[key];
  return edit.enabled !== 'keep' || edit.color !== 'keep' || edit.width !== 'keep';
});

/** Apply only requested leaves. `inherit` removes that leaf without touching neighboring partial properties. */
export const applyPartialStrokeEdits = (
  styles: PartialTextStyle[], start: number, end: number, edits: PartialStrokeEdits,
): PartialTextStyle[] => {
  if (start >= end) return styles;
  let next = styles;
  STROKE_KEYS.forEach((key) => {
    const edit = edits[key];
    if (edit.enabled === 'inherit') next = clearRangeStrokeLeaf(next, start, end, key, 'enabled');
    if (edit.color === 'inherit') next = clearRangeStrokeLeaf(next, start, end, key, 'color');
    if (edit.width === 'inherit') next = clearRangeStrokeLeaf(next, start, end, key, 'width');
  });
  const patch: PartialStrokeLayers = {};
  STROKE_KEYS.forEach((key, index) => {
    const edit = edits[key];
    const layer: Partial<StrokeStyle> = {};
    if (edit.enabled === 'on') layer.enabled = true;
    if (edit.enabled === 'off') layer.enabled = false;
    if (edit.color === 'change') layer.color = edit.colorValue;
    if (edit.width === 'change') layer.width = edit.widthValue;
    if (Object.keys(layer).length) patch[key] = layer;
    if (edit.enabled === 'off') {
      for (let outer = index + 1; outer < STROKE_KEYS.length; outer += 1) {
        patch[STROKE_KEYS[outer]] = { ...patch[STROKE_KEYS[outer]], enabled: false };
      }
    }
  });
  if (Object.keys(patch).length) next = [...next, { start, end, strokes: clonePartialStrokes(patch) }];
  return next;
};

export interface RangeStrokeOverrideState<T> {
  presence: 'none' | 'all' | 'mixed';
  value?: T;
  valueMixed: boolean;
}

export const getRangeStrokeOverrideState = <K extends keyof StrokeStyle>(
  styles: PartialTextStyle[], start: number, end: number, layerKey: StrokeLayerKey, property: K,
): RangeStrokeOverrideState<NonNullable<StrokeStyle[K]>> => {
  if (start >= end) return { presence: 'none', valueMixed: false };
  const points = new Set([start, end]);
  styles.forEach((style) => {
    if (style.start > start && style.start < end) points.add(style.start);
    if (style.end > start && style.end < end) points.add(style.end);
  });
  const sorted = [...points].sort((a, b) => a - b);
  const values = sorted.slice(0, -1).map((point) => {
    let value: StrokeStyle[K] | undefined;
    styles.forEach((style) => {
      const candidate = style.strokes?.[layerKey]?.[property];
      if (style.start <= point && style.end > point && candidate !== undefined) value = candidate as StrokeStyle[K];
    });
    return value;
  });
  const defined = values.filter((value): value is NonNullable<StrokeStyle[K]> => value !== undefined);
  if (!defined.length) return { presence: 'none', valueMixed: false };
  const same = defined.every((value) => value === defined[0]);
  if (defined.length === values.length && same) return { presence: 'all', value: defined[0], valueMixed: false };
  return { presence: 'mixed', value: defined[0], valueMixed: !same || defined.length !== values.length };
};

export const setRangeStrokeLeaf = <K extends keyof StrokeStyle>(
  styles: PartialTextStyle[], start: number, end: number,
  layerKey: StrokeLayerKey, property: K, value: StrokeStyle[K],
): PartialTextStyle[] => {
  if (start >= end) return styles;
  const cleared = clearRangeStrokeLeaf(styles, start, end, layerKey, property);
  return [...cleared, { start, end, strokes: { [layerKey]: { [property]: value } } }];
};
