'use client';

interface GuideOverlayProps {
  visible: boolean;
}

export function GuideOverlay({ visible }: GuideOverlayProps) {
  if (!visible) return null;
  return (
    <div className="guide-overlay" aria-hidden="true">
      <span className="guide-line guide-line-vertical" />
      <span className="guide-line guide-line-horizontal" />
      <span className="guide-center-dot" />
    </div>
  );
}
