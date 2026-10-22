import { useEffect, useRef } from 'react';
import { t } from '../brand/t';

export function InactivityWarning({
  secondsLeft,
  onContinue,
}: {
  secondsLeft: number;
  onContinue: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    button.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <div
      className="kiosk-overlay"
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          button.current?.focus();
        }
        if (event.key === 'Escape') onContinue();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
        aria-describedby="inactivity-body"
        className="w-full max-w-lg rounded-brand bg-surface p-8 text-center sm:p-12"
      >
        <h2 id="inactivity-title" className="game-heading">
          {t('inactivity.title')}
        </h2>
        <p
          id="inactivity-body"
          role="status"
          className="mt-5 text-lg text-muted"
        >
          {t('inactivity.body', { seconds: secondsLeft })}
        </p>
        <button
          ref={button}
          className="game-button mt-7 w-full bg-primary text-on-primary"
          onClick={onContinue}
          type="button"
        >
          {t('inactivity.continue')}
        </button>
      </section>
    </div>
  );
}
