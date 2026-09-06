import type { GraphicTextObject, PartialStrokeLayers, StrokeLayers, StrokeLayerKey, StrokeStyle } from '@/src/types/editor';

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
