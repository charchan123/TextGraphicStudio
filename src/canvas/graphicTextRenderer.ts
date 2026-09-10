/* oxlint-disable typescript/no-deprecated -- Fabric centers grouped children with the legacy origin options. */
import { Group, Shadow, util, type FabricObject } from 'fabric';

import { resolveFontStack } from '@/src/constants/editor';
import { createTextBackground } from '@/src/canvas/backgroundRenderer';
import { applyTextRanges, StyledGraphicText } from '@/src/canvas/StyledGraphicText';
import type { GraphicTextObject } from '@/src/types/editor';
import { effectiveStrokesAt } from '@/src/services/strokes';

export interface RenderedGraphicText {
  group: Group;
  intrinsicWidth: number;
  intrinsicHeight: number;
}

/** Preserve overhanging italic ink and transformed strokes in the single shadow cache. */
class TextSilhouetteGroup extends Group {
  inkPadding = 0;
  override _getCacheCanvasDimensions() {
    const dimensions = super._getCacheCanvasDimensions();
    dimensions.width += (this.inkPadding ?? 0) * dimensions.zoomX;
    dimensions.height += (this.inkPadding ?? 0) * dimensions.zoomY;
    return dimensions;
  }
}

const toRgba = (hex: string, opacity: number): string => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  if (![red, green, blue].every(Number.isFinite)) return `rgba(0, 0, 0, ${opacity})`;
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

const resolveFillColor = (model: GraphicTextObject): string =>
  model.fill.type === 'solid' ? model.fill.color : model.fill.stops[0]?.color ?? '#000000';

const createTextLayer = (
  model: GraphicTextObject,
  stroke: string | undefined,
  strokeWidth: number,
  shadow: Shadow | undefined,
): StyledGraphicText => {
  const text = new StyledGraphicText(model.text.replace(/\r\n?/g, '\n') || ' ', {
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    fill: resolveFillColor(model),
    stroke,
    strokeWidth,
    strokeLineJoin: 'round',
    paintFirst: 'stroke',
    fontFamily: resolveFontStack(model.typography.fontFamily),
    fontSize: model.typography.fontSize,
    fontWeight: model.typography.fontWeight,
    fontStyle: model.typography.fontStyle === 'italic' ? 'italic' : 'normal',
    skewX: model.typography.fontStyle === 'slant' ? -(model.typography.slant ?? 12) : 0,
    charSpacing: (model.typography.letterSpacing / Math.max(1, model.typography.fontSize)) * 1000,
    lineHeight: model.typography.lineHeight,
    textAlign: model.typography.textAlign,
    shadow,
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  // A range outline can split strokeText runs. Use the same glyph runs in fill and all outlines.
  text.forceCharacterRendering = model.partialStyles.some((range) => range.strokes && Object.keys(range.strokes).length > 0)
    || model.partialStyles.some((range) => range.glyphOffsetY !== undefined)
    || model.partialStyles.some((range) => range.glyphOffsetX !== undefined || range.fontWeightAdjust !== undefined)
    || (model.typography.fontWeightAdjust ?? 0) > 0
    || Object.values(model.characterScale).some((scale) => Math.abs(scale - 1) > 0.0001);
  applyTextRanges(text, model);
  return text;
};

export const createFabricGraphicText = (model: GraphicTextObject): RenderedGraphicText => {
  const children: FabricObject[] = [];
  const glyphOffsetPadding = Math.max(
    model.typography.fontWeightAdjust ?? 0,
    ...model.partialStyles.map((range) => Math.max(
      Math.abs(range.glyphOffsetX ?? 0),
      Math.abs(range.glyphOffsetY ?? 0),
      range.fontWeightAdjust ?? model.typography.fontWeightAdjust ?? 0,
    )),
  );
  const shadow = model.shadow.enabled
    ? new Shadow({
        color: toRgba(model.shadow.color, model.shadow.opacity),
        blur: model.shadow.blur,
        offsetX: model.shadow.offsetX,
        offsetY: model.shadow.offsetY,
      })
    : undefined;

  const measurementText = createTextLayer(model, undefined, 0, undefined);
  const textWidth = Math.max(1, measurementText.width);
  const textHeight = Math.max(1, measurementText.height);
  const skewX = measurementText.skewX ?? 0;
  const shear = Math.tan(skewX * Math.PI / 180);
  const lineLayouts = measurementText.getLineLayouts().map((line) => ({
    ...line,
    centerX: line.centerX + shear * line.centerY,
    width: line.width + Math.abs(shear) * line.height,
  }));
  const slantedWidth = textWidth + Math.abs(shear) * textHeight;

  const background = createTextBackground(model.background, slantedWidth, textHeight, lineLayouts, Math.max(Math.abs(model.transform.scaleX), Math.abs(model.transform.scaleY)));
  if (background) children.push(background);

  const graphemes = util.string.graphemeSplit(model.text.replace(/\r\n?/g, '\n') || ' ');
  let offset = 0;
  const resolved = graphemes.map((grapheme) => {
    const layers = effectiveStrokesAt(model, offset, offset + grapheme.length);
    let sx = model.typography.glyphScaleX ?? 1, sy = model.typography.glyphScaleY ?? 1;
    model.partialStyles.forEach((range) => {
      if (range.end <= offset || range.start >= offset + grapheme.length) return;
      sx = range.glyphScaleX ?? sx; sy = range.glyphScaleY ?? sy;
    });
    offset += grapheme.length;
    return { layers, scale: Math.max(sx, sy), visible: grapheme !== '\n' };
  });
  const textChildren: FabricObject[] = [];
  // Each pass contains outlines only. The fill is drawn once, after all outlines.
  for (let index = 2; index >= 0; index -= 1) {
    let maxWidth = 0;
    const styles = resolved.map(({ layers, scale, visible }) => {
      const layer = layers[index];
      const width = visible && layer.enabled && layer.width > 0
        ? layers.slice(0, index + 1).reduce((sum, item) => sum + (item.enabled ? item.width : 0), 0) * 2 : 0;
      maxWidth = Math.max(maxWidth, width * scale);
      return { stroke: width ? layer.color : '', strokeWidth: width };
    });
    if (!maxWidth) continue;
    const layer = createTextLayer(model, '#000000', maxWidth, undefined);
    layer.setPaintLayer('stroke');
    styles.forEach((style, character) => { if (resolved[character].visible) layer.setSelectionStyles(style, character, character + 1); });
    textChildren.push(layer);
  }
  measurementText.setPaintLayer('fill');
  textChildren.push(measurementText);
  // One shadow on the composited text silhouette, never on a reserved or disabled layer.
  // The outer GraphicText Group keeps the existing transform/selection contract.
  const textGroup = new TextSilhouetteGroup(textChildren, {
    left: 0, top: 0, originX: 'center', originY: 'center',
    selectable: false, evented: false, objectCaching: Boolean(shadow),
    shadow, subTargetCheck: false,
  });
  textGroup.inkPadding = Math.max(model.typography.fontSize, ...model.partialStyles.map((range) => range.fontSize ?? model.typography.fontSize)) * 3
    + glyphOffsetPadding * 2;
  children.push(textGroup);

  const transformLocked = model.locked || model.fullyLocked;
  const group = new Group(children, {
    left: model.position.x,
    top: model.position.y,
    originX: 'center',
    originY: 'center',
    scaleX: model.transform.scaleX,
    scaleY: model.transform.scaleY,
    angle: model.transform.rotation,
    visible: model.visible,
    selectable: model.visible,
    evented: model.visible,
    lockMovementX: transformLocked,
    lockMovementY: transformLocked,
    lockScalingX: transformLocked,
    lockScalingY: transformLocked,
    lockRotation: transformLocked,
    hasControls: !transformLocked,
    centeredRotation: true,
    centeredScaling: true,
    subTargetCheck: false,
    objectCaching: false,
    cornerColor: '#2F6FED',
    cornerStrokeColor: '#FFFFFF',
    cornerSize: 18,
    transparentCorners: false,
    borderColor: '#2F6FED',
    borderScaleFactor: 2,
    padding: 3 + glyphOffsetPadding,
  });
  group.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false });
  group.setCoords();

  return {
    group,
    intrinsicWidth: Math.max(1, group.width),
    intrinsicHeight: Math.max(1, group.height),
  };
};
