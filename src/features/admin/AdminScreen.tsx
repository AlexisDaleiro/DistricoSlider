import { useMemo, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import { flowStore } from '../../flow/flowStore';
import { Modal } from '../../shared/ui/Modal';
import { pinService } from './pin';
import { PinGate } from './PinGate';
import { AdminDashboard } from './AdminDashboard';
export function AdminScreen() {
  const brand = useBrand();
  const service = useMemo(() => pinService(brand), [brand]);
  const [authenticated, setAuthenticated] = useState(false);
  const visit = flowStore.getState().visit;
  const exit = () => void flowStore.getState().resetToAttract('finish');
  return authenticated ? (
    <AdminDashboard service={service} />
  ) : (
    <Modal title={t('admin.access')}>
      <PinGate
        service={service}
        onCancel={exit}
        onVerified={() => {
          if (
            flowStore.getState().screen === 'admin' &&
            flowStore.getState().visit === visit
          )
            setAuthenticated(true);
        }}
      />
    </Modal>
  );
}
