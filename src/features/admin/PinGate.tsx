import { useEffect, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import { flowStore } from '../../flow/flowStore';
import { PinPad } from './PinPad';
import type { pinService } from './pin';

export function PinGate({
  service,
  onVerified,
  onCancel,
  label,
}: {
  service: ReturnType<typeof pinService>;
  onVerified: (pin: string) => void;
  onCancel: () => void;
  label?: string;
}) {
  const brand = useBrand();
  const [error, setError] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void service
      .state()
      .then((state) => {
        if (active) {
          setLockedUntil(state.lockedUntil);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    const deadline = window.setTimeout(
      () => void flowStore.getState().resetToAttract('inactivity'),
      brand.kiosk.admin.pinTimeoutMs,
    );
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      active = false;
      window.clearTimeout(deadline);
      window.clearInterval(clock);
    };
  }, [service, brand.kiosk.admin.pinTimeoutMs]);
  return (
    <>
      {lockedUntil > now && (
        <p role="status" className="mt-4 text-danger">
          {t('admin.locked', {
            seconds: Math.ceil((lockedUntil - now) / 1000),
          })}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {t('admin.pinError')}
        </p>
      )}
      <PinPad
        label={label ?? t('admin.enterPin')}
        disabled={!ready || lockedUntil > now}
        onSubmit={async (pin) => {
          try {
            const result = await service.verify(pin);
            setLockedUntil(result.lockedUntil);
            setNow(Date.now());
            setError(!result.ok);
            if (result.ok) onVerified(pin);
          } catch {
            setError(true);
          }
        }}
      />
      <button
        className="game-button mt-5 w-full text-muted"
        type="button"
        onClick={onCancel}
      >
        {t('admin.cancel')}
      </button>
    </>
  );
}
