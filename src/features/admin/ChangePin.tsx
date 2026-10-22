import { useEffect, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { flowStore } from '../../flow/flowStore';
import { t } from '../../brand/t';
import { PinGate } from './PinGate';
import { PinPad } from './PinPad';
import type { pinService } from './pin';
export function ChangePin({
  service,
  onDone,
  onCancel,
}: {
  service: ReturnType<typeof pinService>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const brand = useBrand();
  useEffect(() => {
    const id = window.setTimeout(
      () => void flowStore.getState().resetToAttract('inactivity'),
      brand.kiosk.admin.pinTimeoutMs,
    );
    return () => window.clearTimeout(id);
  }, [brand.kiosk.admin.pinTimeoutMs]);
  const [stage, setStage] = useState<'current' | 'new' | 'repeat'>('current');
  const [next, setNext] = useState('');
  const [current, setCurrent] = useState('');
  const [error, setError] = useState(false);
  if (stage === 'current')
    return (
      <PinGate
        service={service}
        onCancel={onCancel}
        onVerified={(value) => {
          setCurrent(value);
          setStage('new');
        }}
        label={t('admin.currentPin')}
      />
    );
  return (
    <>
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {t('admin.pinMismatch')}
        </p>
      )}
      <PinPad
        key={stage}
        label={t(stage === 'new' ? 'admin.newPin' : 'admin.repeatPin')}
        onSubmit={async (value) => {
          if (stage === 'new') {
            setNext(value);
            setStage('repeat');
            return;
          }
          if (value !== next) {
            setNext('');
            setError(true);
            setStage('new');
            return;
          }
          try {
            if (!(await service.change(current, next, value)))
              throw new Error('PIN inválido');
            setCurrent('');
            setNext('');
            onDone();
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
