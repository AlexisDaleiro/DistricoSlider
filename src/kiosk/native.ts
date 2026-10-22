import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { recordError } from './auditError';

export async function initNativeKiosk(
  orientation: 'landscape' | 'portrait',
  onBack: () => void,
  onResume: () => void,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  // Registrar Atrás inmediatamente; un fallo en un refuerzo no desactiva el resto.
  let stopped = false;
  const handles: PluginListenerHandle[] = [];
  const listeners = [
    App.addListener('backButton', () => {
      if (!stopped) onBack();
    }),
    App.addListener('appStateChange', ({ isActive }) => {
      if (!stopped && isActive) onResume();
    }),
  ];
  for (const listener of listeners)
    void listener
      .then(async (handle) => {
        if (stopped) await handle.remove();
        else handles.push(handle);
      })
      .catch((error: unknown) => recordError('native.listener', error));
  // No bloquear el cleanup esperando un plugin: puede contestar después del unmount.
  void Promise.allSettled([
    ScreenOrientation.lock({ orientation }),
    KeepAwake.keepAwake(),
  ]).then((results) => {
    results.forEach((result) => {
      if (result.status === 'rejected')
        void recordError('native.setup', result.reason);
    });
  });
  return () => {
    if (stopped) return;
    stopped = true;
    void Promise.allSettled(handles.map((handle) => handle.remove()));
    // FLAG_KEEP_SCREEN_ON nativa sigue vigente durante toda la Activity.
  };
}
