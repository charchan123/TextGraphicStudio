export type OutputPreviewKeyboardAction = 'previous' | 'next' | 'close';

export const getOutputPreviewKeyboardAction = (key: string): OutputPreviewKeyboardAction | null => {
  if (key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowRight') return 'next';
  if (key === 'Escape') return 'close';
  return null;
};

export const getOutputPreviewTargetIndex = (
  currentIndex: number,
  frameCount: number,
  action: 'previous' | 'next',
): number => {
  const offset = action === 'previous' ? -1 : 1;
  return Math.min(Math.max(currentIndex + offset, 0), Math.max(frameCount - 1, 0));
};
