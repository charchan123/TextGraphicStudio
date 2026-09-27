import { cloneBackground, cloneFill, cloneGraphicObject } from '@/src/services/documentData';
import { getStrokeLayers } from '@/src/services/strokes';
import type { GraphicTextObject, ProjectTextDefaults, TextDesignDefaults } from '@/src/types/editor';

export const toTextDesignDefaults = (object: GraphicTextObject): TextDesignDefaults => {
  const cloned = cloneGraphicObject(object);
  const { id: _id, name: _name, text: _text, textLineIds: _textLineIds, position: _position, zIndex: _zIndex, lineGapOffsets: _lineGapOffsets, ...design } = cloned;
  void _id; void _name; void _text; void _position; void _zIndex; void _lineGapOffsets;
  const background = cloneBackground(design.background);
  delete background.lineEdgeAdjustments;
  return {
    ...design,
    background,
    transform: { ...design.transform, scaleX: 1, scaleY: 1 },
    partialStyles: [],
    locked: false,
    fullyLocked: false,
    visible: true,
  };
};

export const cloneTextDesignDefaults = (defaults: TextDesignDefaults): TextDesignDefaults =>
  toTextDesignDefaults({
    ...defaults,
    id: 'text-defaults',
    name: 'text-defaults',
    text: ' ',
    lineGapOffsets: [],
    position: { x: 0, y: 0 },
    zIndex: 0,
  });

export const textDesignDefaultsEqual = (left: TextDesignDefaults, right: TextDesignDefaults): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const toProjectTextDefaults = (
  source: GraphicTextObject | TextDesignDefaults | ProjectTextDefaults,
): ProjectTextDefaults => {
  const strokes = getStrokeLayers(source);
  const rotation = 'transform' in source ? source.transform.rotation : source.rotation ?? 0;
  const background = cloneBackground(source.background);
  delete background.lineEdgeAdjustments;
  return {
    rotation,
    typography: { ...source.typography },
    characterScale: { ...source.characterScale },
    fill: cloneFill(source.fill),
    stroke: { ...strokes[0] },
    outerStroke: { ...strokes[1] },
    strokes,
    shadow: { ...source.shadow },
    background,
  };
};

export const cloneProjectTextDefaults = (defaults: ProjectTextDefaults): ProjectTextDefaults =>
  toProjectTextDefaults(defaults);

export const projectTextDefaultsEqual = (left: ProjectTextDefaults, right: ProjectTextDefaults): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** Apply project appearance to the legacy creation preset without copying geometry or transient object state. */
export const withProjectTextDefaults = (
  base: TextDesignDefaults,
  defaults: ProjectTextDefaults,
): TextDesignDefaults => {
  const baseDefaults = cloneTextDesignDefaults(base);
  const { rotation = 0, ...appearance } = cloneProjectTextDefaults(defaults);
  return {
    ...baseDefaults,
    ...appearance,
    transform: { ...baseDefaults.transform, scaleX: 1, scaleY: 1, rotation },
    partialStyles: [],
    locked: false,
    fullyLocked: false,
    visible: true,
  };
};
