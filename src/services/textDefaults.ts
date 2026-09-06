import { cloneGraphicObject } from '@/src/services/documentData';
import type { GraphicTextObject, TextDesignDefaults } from '@/src/types/editor';

export const toTextDesignDefaults = (object: GraphicTextObject): TextDesignDefaults => {
  const cloned = cloneGraphicObject(object);
  const { id: _id, name: _name, text: _text, position: _position, zIndex: _zIndex, ...design } = cloned;
  void _id; void _name; void _text; void _position; void _zIndex;
  return {
    ...design,
    transform: { ...design.transform, scaleX: 1, scaleY: 1 },
    partialStyles: [],
    locked: false,
    visible: true,
  };
};

export const cloneTextDesignDefaults = (defaults: TextDesignDefaults): TextDesignDefaults =>
  toTextDesignDefaults({
    ...defaults,
    id: 'text-defaults',
    name: 'text-defaults',
    text: ' ',
    position: { x: 0, y: 0 },
    zIndex: 0,
  });

export const textDesignDefaultsEqual = (left: TextDesignDefaults, right: TextDesignDefaults): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
