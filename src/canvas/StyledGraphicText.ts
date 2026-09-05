import { FabricText, Gradient, util, type TextStyleDeclaration } from 'fabric';
import type { FillStyle, GraphicTextObject } from '@/src/types/editor';

type RangeDeclaration = TextStyleDeclaration & { letterSpacing?: number };

/** Fabric's native range styles plus pixel-based per-character tracking. */
export class StyledGraphicText extends FabricText {
  private spacingAt(line: number, character: number): number {
    return (this._getStyleDeclaration(line, character) as RangeDeclaration).letterSpacing ?? this._getWidthOfCharSpacing();
  }

  override _getGraphemeBox(...args: Parameters<FabricText['_getGraphemeBox']>) {
    const box = super._getGraphemeBox(...args);
    const delta = this.spacingAt(args[1], args[2]) - this._getWidthOfCharSpacing();
    box.width += delta;
    box.kernedWidth += delta;
    return box;
  }

  override measureLine(lineIndex: number) {
    const result = this._measureLine(lineIndex);
    const length = this._textLines[lineIndex].length;
    result.width = Math.max(0, result.width - (length ? this.spacingAt(lineIndex, length - 1) : 0));
    return result;
  }

  override _renderChars(...args: Parameters<FabricText['_renderChars']>) {
    const hasTracking = Object.values(this.styles[args[5]] ?? {}).some((style) => (style as RangeDeclaration).letterSpacing !== undefined);
    const original = this.charSpacing;
    try {
      // Force Fabric's measured, per-character draw branch for range tracking.
      if (hasTracking && original === 0) this.charSpacing = 1;
      super._renderChars(...args);
    } finally { this.charSpacing = original; }
  }
}

export const createTextFill = (fill: FillStyle, width: number, height: number): string | Gradient<'linear'> => {
  if (fill.type === 'solid') return fill.color;
  const radians = fill.angle * Math.PI / 180;
  const dx = Math.cos(radians), dy = Math.sin(radians);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  return new Gradient({
    type: 'linear', gradientUnits: 'pixels',
    coords: { x1: width / 2 - dx * length / 2, y1: height / 2 - dy * length / 2, x2: width / 2 + dx * length / 2, y2: height / 2 + dy * length / 2 },
    colorStops: fill.stops.map((stop) => ({ ...stop })),
  });
};

export const applyTextRanges = (text: StyledGraphicText, model: GraphicTextObject): void => {
  const graphemes = util.string.graphemeSplit(model.text.replace(/\r\n?/g, '\n'));
  let offset = 0;
  graphemes.forEach((grapheme, index) => {
    const end = offset + grapheme.length;
    for (const range of model.partialStyles) {
      if (range.end <= offset || range.start >= end || grapheme === '\n') continue;
      const declaration: RangeDeclaration = {};
      if (range.fontSize !== undefined) declaration.fontSize = range.fontSize;
      else if (range.fontScale !== undefined) declaration.fontSize = model.typography.fontSize * range.fontScale;
      if (range.fontWeight !== undefined) declaration.fontWeight = range.fontWeight;
      if (range.letterSpacing !== undefined) declaration.letterSpacing = range.letterSpacing;
      if (range.fill?.type === 'solid') declaration.fill = range.fill.color;
      text.setSelectionStyles(declaration, index, index + 1);
    }
    offset = end;
  });
  text.initDimensions();
  text.set('fill', createTextFill(model.fill, text.width, text.height));
};
