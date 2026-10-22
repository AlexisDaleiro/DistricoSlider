import { useEffect, useRef, useState, type ReactNode } from 'react';
export function HoldToConfirmButton({
  durationMs,
  onConfirm,
  disabled = false,
  children,
}: {
  durationMs: number;
  onConfirm: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => {
    const stop = () => cancel();
    window.addEventListener('blur', stop);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener('blur', stop);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, []);
  const start = () => {
    if (disabled || timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, durationMs);
  };
  return (
    <button
      type="button"
      className={`game-button w-full bg-danger text-on-primary ${holding ? 'outline-2 outline-offset-2 outline-danger' : ''}`}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button === 0) start();
      }}
      onPointerLeave={cancel}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onBlur={cancel}
      onKeyDown={(event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={cancel}
    >
      {children}
    </button>
  );
}
