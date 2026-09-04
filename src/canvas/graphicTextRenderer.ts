/* oxlint-disable typescript/no-deprecated -- Fabric centers grouped children with the legacy origin options. */
import { FabricText, Group, Polygon, Shadow, type FabricObject } from 'fabric';

import { resolveFontStack } from '@/src/constants/editor';
import { createRoughBandPoints } from '@/src/canvas/roughBand';
import type { GraphicTextObject } from '@/src/types/editor';

export interface RenderedGraphicText {
  group: Group;
  intrinsicWidth: number;
  intrinsicHeight: number;
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
): FabricText =>
  new FabricText(model.text || ' ', {
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
    charSpacing: (model.typography.letterSpacing / Math.max(1, model.typography.fontSize)) * 1000,
    lineHeight: model.typography.lineHeight,
    textAlign: model.typography.textAlign,
    shadow,
    selectable: false,
    evented: false,
    objectCaching: false,
  });

export const createFabricGraphicText = (model: GraphicTextObject): RenderedGraphicText => {
  const children: FabricObject[] = [];
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

  if (model.background.enabled) {
    const bandWidth = textWidth + model.background.paddingX * 2;
    const bandHeight = textHeight + model.background.paddingY * 2;
    const polygon = new Polygon(
      createRoughBandPoints(bandWidth, bandHeight, model.background.roughness, model.background.seed),
      {
        left: 0,
        top: 0,
        originX: 'center',
        originY: 'center',
        angle: model.background.rotation,
        fill: model.background.color,
        selectable: false,
        evented: false,
        objectCaching: false,
      },
    );
    children.push(polygon);
  }

  const whiteWidth = model.stroke.enabled ? model.stroke.width : 0;
  const blackWidth = model.outerStroke.enabled ? model.outerStroke.width : 0;
  let shadowAssigned = false;

  if (model.outerStroke.enabled) {
    children.push(
      createTextLayer(model, model.outerStroke.color, (whiteWidth + blackWidth) * 2, shadow),
    );
    shadowAssigned = Boolean(shadow);
  }
  if (model.stroke.enabled) {
    children.push(
      createTextLayer(model, model.stroke.color, whiteWidth * 2, shadowAssigned ? undefined : shadow),
    );
    shadowAssigned = Boolean(shadow);
  }
  children.push(createTextLayer(model, undefined, 0, shadowAssigned ? undefined : shadow));

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
    lockMovementX: model.locked,
    lockMovementY: model.locked,
    lockScalingX: model.locked,
    lockScalingY: model.locked,
    lockRotation: model.locked,
    hasControls: !model.locked,
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
    padding: 3,
  });
  group.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false });
  group.setCoords();

  return {
    group,
    intrinsicWidth: Math.max(1, group.width),
    intrinsicHeight: Math.max(1, group.height),
  };
};
