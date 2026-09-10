import { FabricText, Gradient, util, type TextStyleDeclaration } from 'fabric';
import { resolveFontStack } from '@/src/constants/editor';
import { characterSizeMultiplier } from '@/src/services/characterScale';
import type { FillStyle, GraphicTextObject } from '@/src/types/editor';

type RangeDeclaration = TextStyleDeclaration & {
  letterSpacing?: number;
  glyphScaleX?: number;
  glyphScaleY?: number;
  deltaX?: number;
  deltaY?: number;
  fontWeightAdjust?: number;
};

type LinearCoords = { x1: number; y1: number; x2: number; y2: number };

const compensateLinearGradient = (
  gradient: Gradient<'linear'>,
  pivot: { x: number; y: number },
  scale: { x: number; y: number },
): Gradient<'linear'> => {
  if (
    gradient.gradientUnits !== 'pixels'
    || gradient.gradientTransform
    || (Math.abs(scale.x - 1) < 0.0001 && Math.abs(scale.y - 1) < 0.0001)
  ) return gradient;

  const coords = gradient.coords as LinearCoords;
  const deltaX = coords.x2 - coords.x1;
  const deltaY = coords.y2 - coords.y1;
  const normalX = scale.x * deltaX;
  const normalY = scale.y * deltaY;
  const normalLengthSquared = normalX * normalX + normalY * normalY;
  const desiredLengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (normalLengthSquared < 0.000001) return gradient;

  const x1 = pivot.x + (coords.x1 - pivot.x) / scale.x;
  const y1 = pivot.y + (coords.y1 - pivot.y) / scale.y;
  return new Gradient({
    type: 'linear',
    gradientUnits: 'pixels',
    coords: {
      x1,
      y1,
      x2: x1 + normalX * desiredLengthSquared / normalLengthSquared,
      y2: y1 + normalY * desiredLengthSquared / normalLengthSquared,
    },
    colorStops: gradient.colorStops.map((stop) => ({ ...stop })),
    offsetX: gradient.offsetX,
    offsetY: gradient.offsetY,
  });
};

/** Fabric's native range styles plus pixel-based per-character tracking. */
export class StyledGraphicText extends FabricText {
  forceCharacterRendering = false;
  private paintLayer?: 'fill' | 'stroke';
  setPaintLayer(layer: 'fill' | 'stroke'): void { this.paintLayer = layer; }
  override _renderTextFill(context: CanvasRenderingContext2D): void {
    if (this.paintLayer !== 'stroke') super._renderTextFill(context);
  }
  override _renderTextStroke(context: CanvasRenderingContext2D): void {
    if (this.paintLayer !== 'fill') super._renderTextStroke(context);
  }
  private baseGlyphScaleX = 1;
  private baseGlyphScaleY = 1;
  private baseFontWeightAdjust = 0;
  private lineGapOffsets: number[] = [];

  setGlyphScales(scaleX: number, scaleY: number): void {
    this.baseGlyphScaleX = scaleX;
    this.baseGlyphScaleY = scaleY;
  }

  setFontWeightAdjust(value: number): void {
    this.baseFontWeightAdjust = value;
  }

  setLineGapOffsets(offsets: readonly number[]): void {
    this.lineGapOffsets = [...offsets];
  }

  private spacingAt(line: number, character: number): number {
    return (this._getStyleDeclaration(line, character) as RangeDeclaration).letterSpacing ?? this._getWidthOfCharSpacing();
  }

  private glyphScaleAt(line: number, character: number): { x: number; y: number } {
    const declaration = this._getStyleDeclaration(line, character) as RangeDeclaration;
    return {
      x: declaration.glyphScaleX ?? this.baseGlyphScaleX ?? 1,
      y: declaration.glyphScaleY ?? this.baseGlyphScaleY ?? 1,
    };
  }

  private weightAdjustAt(line: number, character: number): number {
    const declaration = this._getStyleDeclaration(line, character) as RangeDeclaration;
    return declaration.fontWeightAdjust ?? this.baseFontWeightAdjust ?? 0;
  }

  override _getGraphemeBox(...args: Parameters<FabricText['_getGraphemeBox']>) {
    const box = super._getGraphemeBox(...args);
    const [, lineIndex, characterIndex, , skipLeft] = args;
    const scale = this.glyphScaleAt(lineIndex, characterIndex);
    const inheritedSpacing = this._getWidthOfCharSpacing();
    const spacing = this.spacingAt(lineIndex, characterIndex);
    box.width = (box.width - inheritedSpacing) * scale.x + spacing;
    box.kernedWidth = (box.kernedWidth - inheritedSpacing) * scale.x + spacing;
    box.height = Number(
      this.getCompleteStyleDeclaration(lineIndex, characterIndex).fontSize ?? this.fontSize,
    ) * scale.y;
    if (characterIndex > 0 && !skipLeft) {
      const previous = this.__charBounds[lineIndex][characterIndex - 1];
      box.left = previous.left + previous.width + box.kernedWidth - box.width;
    }
    return box;
  }

  override measureLine(lineIndex: number) {
    const result = this._measureLine(lineIndex);
    const length = this._textLines[lineIndex].length;
    result.width = Math.max(0, result.width - (length ? this.spacingAt(lineIndex, length - 1) : 0));
    return result;
  }

  private rawLineHeight(lineIndex: number): number {
    const line = this._textLines[lineIndex];
    if (line.length === 0) return this.fontSize * this.baseGlyphScaleY * this._fontSizeMult;
    let maxHeight = 0;
    for (let character = 0; character < line.length; character += 1) {
      const declaration = this.getCompleteStyleDeclaration(lineIndex, character);
      maxHeight = Math.max(
        maxHeight,
        Number(declaration.fontSize ?? this.fontSize) * this.glyphScaleAt(lineIndex, character).y,
      );
    }
    return maxHeight * this._fontSizeMult;
  }

  override getHeightOfLine(lineIndex: number): number {
    return this.rawLineHeight(lineIndex) * this.lineHeight + (this.lineGapOffsets?.[lineIndex] ?? 0);
  }

  override calcTextHeight(): number {
    let height = 0;
    for (let lineIndex = 0; lineIndex < this._textLines.length; lineIndex += 1) {
      height += lineIndex === this._textLines.length - 1
        ? this.rawLineHeight(lineIndex)
        : this.getHeightOfLine(lineIndex);
    }
    return height;
  }

  override _renderChars(...args: Parameters<FabricText['_renderChars']>) {
    const hasCustomStyle = Object.values(this.styles[args[5]] ?? {}).some((style) => {
      const declaration = style as RangeDeclaration;
      return declaration.letterSpacing !== undefined
        || declaration.glyphScaleX !== undefined
        || declaration.glyphScaleY !== undefined
        || declaration.deltaX !== undefined
        || declaration.deltaY !== undefined
        || declaration.fontWeightAdjust !== undefined;
    });
    const original = this.charSpacing;
    try {
      // Force Fabric's measured, per-character draw branch for range tracking/scaling.
      if ((hasCustomStyle || this.forceCharacterRendering) && original === 0) this.charSpacing = 1;
      super._renderChars(...args);
    } finally { this.charSpacing = original; }
  }

  override _renderChar(...args: Parameters<FabricText['_renderChar']>): void {
    const [method, context, lineIndex, charIndex, character, left, initialTop] = args;
    const declaration = this._getStyleDeclaration(lineIndex, charIndex) as RangeDeclaration;
    const complete = this.getCompleteStyleDeclaration(lineIndex, charIndex);
    const shouldFill = method === 'fillText' && complete.fill;
    const shouldStroke = method === 'strokeText' && complete.stroke && complete.strokeWidth;
    if (!shouldFill && !shouldStroke) return;
    const scale = this.glyphScaleAt(lineIndex, charIndex);
    let top = initialTop;
    if (!this.path) {
      const inheritedHeight = super.getHeightOfLine(lineIndex) / this.lineHeight;
      top += (this.rawLineHeight(lineIndex) - inheritedHeight) * (1 - this._fontSizeFraction);
    }
    context.save();
    context.font = this._getFontDeclaration(complete);
    if (declaration.textBackgroundColor) this._removeShadow(context);
    if (declaration.deltaY) top += declaration.deltaY;
    const drawLeft = left + (declaration.deltaX ?? 0);
    const weightAdjust = this.weightAdjustAt(lineIndex, charIndex);
    const fill = complete.fill;
    const adjustedComplete = shouldFill && fill instanceof Gradient && fill.type === 'linear'
      ? {
          ...complete,
          fill: compensateLinearGradient(
            fill as Gradient<'linear'>,
            {
              x: drawLeft + this.width / 2 - fill.offsetX,
              y: top + this.height / 2 - fill.offsetY,
            },
            scale,
          ),
        }
      : complete;
    const paintStyle = shouldStroke && weightAdjust > 0
      ? { ...complete, strokeWidth: Number(complete.strokeWidth ?? 0) + weightAdjust * 2 }
      : adjustedComplete;
    const offsets = shouldFill
      ? this._setFillStyles(context, adjustedComplete)
      : this._setStrokeStyles(context, paintStyle);
    const x = drawLeft - offsets.offsetX;
    const y = top - offsets.offsetY;
    context.translate(x, y);
    context.scale(scale.x, scale.y);
    context.translate(-x, -y);
    if (shouldFill && weightAdjust > 0) {
      context.save();
      context.strokeStyle = context.fillStyle;
      context.lineWidth = weightAdjust * 2;
      context.lineJoin = 'round';
      context.miterLimit = 2;
      context.strokeText(character, x, y);
      context.restore();
    }
    context[method](character, x, y);
    context.restore();
  }

  getLineLayouts(): Array<{ width: number; height: number; centerX: number; centerY: number }> {
    const layouts: Array<{ width: number; height: number; centerX: number; centerY: number }> = [];
    let top = -this.height / 2;
    this._textLines.forEach((line, lineIndex) => {
      const baseHeight = this.rawLineHeight(lineIndex);
      const width = this.measureLine(lineIndex).width;
      if (line.length > 0 && width > 0) {
        let minTop = Number.POSITIVE_INFINITY;
        let maxBottom = Number.NEGATIVE_INFINITY;
        let minLeft = Number.POSITIVE_INFINITY;
        let maxRight = Number.NEGATIVE_INFINITY;
        for (let character = 0; character < line.length; character += 1) {
          const complete = this.getCompleteStyleDeclaration(lineIndex, character);
          const height = Number(complete.fontSize ?? this.fontSize) * this._fontSizeMult
            * this.glyphScaleAt(lineIndex, character).y;
          const deltaY = Number((this._getStyleDeclaration(lineIndex, character) as RangeDeclaration).deltaY ?? 0);
          const deltaX = Number((this._getStyleDeclaration(lineIndex, character) as RangeDeclaration).deltaX ?? 0);
          const weightAdjust = this.weightAdjustAt(lineIndex, character);
          const box = this.__charBounds[lineIndex]?.[character];
          const spacing = this.spacingAt(lineIndex, character);
          const glyphTop = baseHeight * (1 - this._fontSizeFraction)
            - height * (1 - this._fontSizeFraction) + deltaY;
          minTop = Math.min(minTop, glyphTop - weightAdjust);
          maxBottom = Math.max(maxBottom, glyphTop + height + weightAdjust);
          if (box) {
            minLeft = Math.min(minLeft, box.left + deltaX - weightAdjust);
            maxRight = Math.max(maxRight, box.left + Math.max(1, box.width - spacing) + deltaX + weightAdjust);
          }
        }
        if (!Number.isFinite(minLeft) || !Number.isFinite(maxRight)) {
          minLeft = 0;
          maxRight = width;
        }
        const height = maxBottom - minTop;
        layouts.push({
          width: Math.max(1, maxRight - minLeft),
          height,
          centerX: -this.width / 2 + this._getLineLeftOffset(lineIndex) + (minLeft + maxRight) / 2,
          centerY: top + minTop + height / 2,
        });
      }
      top += this.getHeightOfLine(lineIndex);
    });
    return layouts;
  }

  getCharacterLayout(selectionIndex: number): { left: number; top: number; width: number; height: number } | null {
    let index = 0;
    let top = 0;
    for (let lineIndex = 0; lineIndex < this._textLines.length; lineIndex += 1) {
      const line = this._textLines[lineIndex];
      const lineLeft = this._getLineLeftOffset(lineIndex);
      for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
        if (index === selectionIndex) {
          const box = this.__charBounds[lineIndex]?.[charIndex];
          if (!box) return null;
          const spacing = this.spacingAt(lineIndex, charIndex);
          const complete = this.getCompleteStyleDeclaration(lineIndex, charIndex);
          const scale = this.glyphScaleAt(lineIndex, charIndex);
          const height = Math.max(
            1,
            Number(complete.fontSize ?? this.fontSize) * this._fontSizeMult * scale.y,
          );
          const baseline = top + this.rawLineHeight(lineIndex) * (1 - this._fontSizeFraction);
          const deltaY = Number((this._getStyleDeclaration(lineIndex, charIndex) as RangeDeclaration).deltaY ?? 0);
          const deltaX = Number((this._getStyleDeclaration(lineIndex, charIndex) as RangeDeclaration).deltaX ?? 0);
          const weightAdjust = this.weightAdjustAt(lineIndex, charIndex);
          return {
            left: lineLeft + box.left + deltaX - weightAdjust,
            top: baseline - height * (1 - this._fontSizeFraction) + deltaY - weightAdjust,
            width: Math.max(1, box.width - spacing) + weightAdjust * 2,
            height: height + weightAdjust * 2,
          };
        }
        index += 1;
      }
      if (lineIndex < this._textLines.length - 1) index += 1;
      top += this.getHeightOfLine(lineIndex);
    }
    return null;
  }
}

export const createTextFill = (fill: FillStyle, width: number, height: number, left = 0, top = 0): string | Gradient<'linear'> => {
  if (fill.type === 'solid') return fill.color;
  const radians = fill.angle * Math.PI / 180;
  const dx = Math.cos(radians), dy = Math.sin(radians);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  return new Gradient({
    type: 'linear', gradientUnits: 'pixels',
    coords: { x1: left + width / 2 - dx * length / 2, y1: top + height / 2 - dy * length / 2, x2: left + width / 2 + dx * length / 2, y2: top + height / 2 + dy * length / 2 },
    colorStops: fill.stops.map((stop) => ({ ...stop })),
  });
};

export const applyTextRanges = (text: StyledGraphicText, model: GraphicTextObject): void => {
  text.setGlyphScales(model.typography.glyphScaleX ?? 1, model.typography.glyphScaleY ?? 1);
  text.setLineGapOffsets(model.lineGapOffsets ?? []);
  text.setFontWeightAdjust(model.typography.fontWeightAdjust ?? 0);
  const graphemes = util.string.graphemeSplit(model.text.replace(/\r\n?/g, '\n'));
  const fills = new Map<number, FillStyle>();
  let offset = 0;
  graphemes.forEach((grapheme, index) => {
    const end = offset + grapheme.length;
    if (grapheme !== '\n') {
      // Font size participates in Fabric's native grapheme measurement. Applying
      // category size here makes every following glyph consume the accumulated
      // final advance, and lets Fabric align from the measured final line width.
      const multiplier = characterSizeMultiplier(grapheme, model.characterScale);
      if (Math.abs(multiplier - 1) > 0.0001) {
        text.setSelectionStyles({ fontSize: model.typography.fontSize * multiplier }, index, index + 1);
      }
    }
    for (const range of model.partialStyles) {
      if (range.end <= offset || range.start >= end || grapheme === '\n') continue;
      const declaration: RangeDeclaration = {};
      if (range.fontSize !== undefined) declaration.fontSize = range.fontSize;
      else if (range.fontScale !== undefined) declaration.fontSize = model.typography.fontSize * range.fontScale;
      if (range.fontWeight !== undefined) declaration.fontWeight = range.fontWeight;
      if (range.fontWeightAdjust !== undefined) declaration.fontWeightAdjust = range.fontWeightAdjust;
      if (range.fontFamily !== undefined) declaration.fontFamily = resolveFontStack(range.fontFamily);
      if (range.fontStyle !== undefined) declaration.fontStyle = range.fontStyle;
      if (range.letterSpacing !== undefined) declaration.letterSpacing = range.letterSpacing;
      if (range.glyphScaleX !== undefined) declaration.glyphScaleX = range.glyphScaleX;
      if (range.glyphScaleY !== undefined) declaration.glyphScaleY = range.glyphScaleY;
      if (range.glyphOffsetY !== undefined) declaration.deltaY = range.glyphOffsetY;
      if (range.glyphOffsetX !== undefined) declaration.deltaX = range.glyphOffsetX;
      if (range.fill) fills.set(index, range.fill);
      text.setSelectionStyles(declaration, index, index + 1);
    }
    offset = end;
  });
  text.initDimensions();
  text.set('fill', createTextFill(model.fill, text.width, text.height));
  fills.forEach((fill, index) => {
    const layout = text.getCharacterLayout(index);
    if (!layout) return;
    text.setSelectionStyles(
      { fill: createTextFill(fill, layout.width, layout.height, layout.left, layout.top) },
      index,
      index + 1,
    );
  });
};
