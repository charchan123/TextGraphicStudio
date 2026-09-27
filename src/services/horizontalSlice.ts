export interface HorizontalSliceSettings {
  enabled: boolean;
  leftRatio: number;
  rightRatio: number;
}

export const DEFAULT_HORIZONTAL_SLICE: HorizontalSliceSettings = {
  enabled: false,
  leftRatio: 0.2,
  rightRatio: 0.2,
};

const clampRatio = (value: number): number => Math.min(0.45, Math.max(0, Number.isFinite(value) ? value : 0.2));

export const normalizeHorizontalSlice = (settings: HorizontalSliceSettings): HorizontalSliceSettings => ({
  enabled: Boolean(settings.enabled),
  leftRatio: clampRatio(settings.leftRatio),
  rightRatio: clampRatio(settings.rightRatio),
});

export interface HorizontalSliceGeometry {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  sourceLeftWidth: number;
  sourceCenterWidth: number;
  sourceRightWidth: number;
  targetLeftWidth: number;
  targetCenterWidth: number;
  targetRightWidth: number;
}

/** Pure 3-slice geometry. Caps only follow vertical scale; the center absorbs horizontal resizing. */
export const calculateHorizontalSliceGeometry = (
  sourceWidth: number,
  sourceHeight: number,
  requestedWidth: number,
  requestedHeight: number,
  settings: HorizontalSliceSettings,
): HorizontalSliceGeometry => {
  const width = Math.max(1, sourceWidth);
  const height = Math.max(1, sourceHeight);
  const targetHeight = Math.max(1, requestedHeight);
  const normalized = normalizeHorizontalSlice(settings);
  const sourceLeftWidth = width * normalized.leftRatio;
  const sourceRightWidth = width * normalized.rightRatio;
  const sourceCenterWidth = Math.max(1, width - sourceLeftWidth - sourceRightWidth);
  const verticalScale = targetHeight / height;
  const targetLeftWidth = sourceLeftWidth * verticalScale;
  const targetRightWidth = sourceRightWidth * verticalScale;
  const targetWidth = Math.max(Math.max(1, requestedWidth), targetLeftWidth + targetRightWidth + 1);
  return {
    sourceWidth: width,
    sourceHeight: height,
    targetWidth,
    targetHeight,
    sourceLeftWidth,
    sourceCenterWidth,
    sourceRightWidth,
    targetLeftWidth,
    targetCenterWidth: Math.max(1, targetWidth - targetLeftWidth - targetRightWidth),
    targetRightWidth,
  };
};
