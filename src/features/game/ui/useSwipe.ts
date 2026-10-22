import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Direction } from '../engine/types';

interface Options {
  threshold: number;
  onTap?: (target: EventTarget | null) => void;
  disabled?: boolean;
}
interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  target: EventTarget | null;
}

export function useSwipe(
  onSwipe: (direction: Direction) => void,
  { threshold, onTap, disabled = false }: Options,
) {
  const gesture = useRef<Gesture | null>(null);
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        disabled ||
        gesture.current ||
        event.isPrimary === false ||
        event.button !== 0
      )
        return;
      gesture.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        target: event.target,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      gesture.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (disabled) return;
      const dx = event.clientX - current.x,
        dy = event.clientY - current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
        onTap?.(current.target);
        return;
      }
      onSwipe(
        Math.abs(dx) >= Math.abs(dy)
          ? dx < 0
            ? 'left'
            : 'right'
          : dy < 0
            ? 'up'
            : 'down',
      );
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (gesture.current?.pointerId === event.pointerId)
        gesture.current = null;
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (gesture.current?.pointerId === event.pointerId)
        gesture.current = null;
    },
  };
}
