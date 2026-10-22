import { brand } from '../../brand/brand';
import { HubParticipation } from './HubParticipation';
import { QA_ENABLED } from '../../qa/config';

// Una sola instancia y un solo puente durante toda la vida de la pestaña.
let hub: HubParticipation | null = null;
export function getGameHub() {
  if (!brand.gameHub) throw new Error('Esta marca no usa la central.');
  return (hub ??= new HubParticipation({
    ...brand.gameHub,
    ...(QA_ENABLED ? { endpoint: '', gameKey: '' } : {}),
    gameVersion: brand.gameHub.gameVersion ?? __APP_VERSION__,
    // Una compilación de producción siempre exige confirmación real.
    allowPreview:
      import.meta.env.DEV && (QA_ENABLED || brand.gameHub.allowPreview),
  }));
}
