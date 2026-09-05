'use client';

import {
  cloneElement,
  type FocusEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface ToolbarTooltipProps {
  label: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

interface TooltipPosition {
  left: number;
  top: number;
}

export function ToolbarTooltip({ label, children }: ToolbarTooltipProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const tooltipHalfWidth = 130;
    const viewportMargin = 12;
    setPosition({
      left: Math.min(
        window.innerWidth - tooltipHalfWidth - viewportMargin,
        Math.max(tooltipHalfWidth + viewportMargin, rect.left + rect.width / 2),
      ),
      top: Math.min(rect.bottom + 8, window.innerHeight - 64),
    });
  }, []);

  const showTooltip = () => {
    updatePosition();
    setOpen(true);
  };

  const handleBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  const describedBy = [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ');

  return (
    <span
      ref={anchorRef}
      className="toolbar-tooltip-anchor"
      onPointerEnter={showTooltip}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={showTooltip}
      onBlurCapture={handleBlur}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      {open &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className="toolbar-tooltip-bubble"
            style={{ left: position.left, top: position.top }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
