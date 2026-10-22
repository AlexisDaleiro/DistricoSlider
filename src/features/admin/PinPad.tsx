import { useEffect, useRef, useState } from 'react';
import { t } from '../../brand/t';
export function PinPad({
  onSubmit,
  disabled = false,
  label,
}: {
  onSubmit: (pin: string) => Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const press = (digit: string) => {
    if (locked.current || disabled) return;
    const next = digits + digit;
    setDigits(next);
    if (next.length === 4) {
      locked.current = true;
      setBusy(true);
      void onSubmit(next).finally(() => {
        locked.current = false;
        if (active.current) {
          setDigits('');
          setBusy(false);
        }
      });
    }
  };
  return (
    <div className="mt-5">
      {label && <p className="text-sm text-muted">{label}</p>}
      <p
        role="status"
        aria-label={t('admin.pinProgress', { count: digits.length })}
        className="my-5 text-center text-3xl tracking-[0.4em] text-primary"
      >
        {'●'.repeat(digits.length)}
        {'○'.repeat(4 - digits.length)}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            type="button"
            className="game-button bg-bg text-xl text-primary"
            disabled={disabled || busy}
            key={digit}
            onClick={() => press(digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="game-button bg-bg"
          disabled={disabled || busy}
          onClick={() => setDigits(digits.slice(0, -1))}
        >
          {t('admin.backspace')}
        </button>
        <button
          type="button"
          className="game-button bg-bg text-xl text-primary"
          disabled={disabled || busy}
          onClick={() => press('0')}
        >
          0
        </button>
      </div>
    </div>
  );
}
