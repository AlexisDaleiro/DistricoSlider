import { useBrand } from '../../brand/BrandProvider';
import { useSecretTap } from './useSecretTap';
export function AdminHotspot({ onUnlock }: { onUnlock: () => void }) {
  const { kiosk } = useBrand();
  const tap = useSecretTap(
    kiosk.adminTapCount,
    kiosk.adminTapWindowMs,
    onUnlock,
  );
  const position = {
    'top-right': 'top-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0',
  }[kiosk.adminHotspot];
  return (
    <div
      data-testid="admin-hotspot"
      aria-hidden="true"
      className={`fixed z-20 h-24 w-24 ${position}`}
      onClick={(event) => {
        event.stopPropagation();
        tap();
      }}
    />
  );
}
