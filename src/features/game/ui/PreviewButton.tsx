import { useEffect, useRef } from 'react';
import { t } from '../../../brand/t';

interface Props {
  pressed: boolean;
  disabled: boolean;
  controls: string;
  onPressedChange: (pressed: boolean) => void;
}

export function PreviewButton({
  pressed,
  disabled,
  controls,
  onPressedChange,
}: Props) {
  const pointer = useRef<number | null>(null);
  useEffect(() => {
    const release = () => {
      pointer.current = null;
      onPressedChange(false);
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') release();
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onPressedChange]);
  return (
    <button
      type="button"
      className="game-button w-full touch-none border border-primary bg-surface text-primary"
      aria-pressed={pressed}
      aria-controls={controls}
      disabled={disabled}
      onPointerDown={(event) => {
        if (
          disabled ||
          event.isPrimary === false ||
          event.button !== 0 ||
          pointer.current !== null
        )
          return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onPressedChange(true);
      }}
      onPointerUp={(event) => {
        if (pointer.current === event.pointerId) {
          pointer.current = null;
          onPressedChange(false);
        }
      }}
      onPointerCancel={() => {
        pointer.current = null;
        onPressedChange(false);
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
        onPressedChange(false);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onPressedChange(true);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onPressedChange(false);
        }
      }}
      onBlur={() => {
        pointer.current = null;
        onPressedChange(false);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-5 w-5"
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {t('game.preview')}
    </button>
  );
}
