import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initNativeKiosk } from '../native';
import { handleNativeBack, registerAdminBack } from '../backNavigation';
import { flowStore } from '../../flow/flowStore';

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  lock: vi.fn(),
  awake: vi.fn(),
  listen: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.listen } }));
vi.mock('@capacitor/screen-orientation', () => ({
  ScreenOrientation: { lock: mocks.lock },
}));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: mocks.awake },
}));
vi.mock('../auditError', () => ({
  recordError: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  mocks.native.mockReturnValue(true);
  mocks.lock.mockResolvedValue(undefined);
  mocks.awake.mockResolvedValue(undefined);
});
afterEach(() => vi.resetAllMocks());

it('web no llama plugins ni registra listeners nativos', async () => {
  mocks.native.mockReturnValue(false);
  const stop = await initNativeKiosk('landscape', vi.fn(), vi.fn());
  stop();
  expect(mocks.listen).not.toHaveBeenCalled();
  expect(mocks.lock).not.toHaveBeenCalled();
  expect(mocks.awake).not.toHaveBeenCalled();
});
it.each(['landscape', 'portrait'] as const)(
  'bloquea %s, despierta, captura Atrás y solo revisa al volver activo',
  async (orientation) => {
    const callbacks: Record<string, (event: { isActive: boolean }) => void> =
      {};
    const remove = vi.fn().mockResolvedValue(undefined);
    mocks.listen.mockImplementation(
      async (name: string, callback: (typeof callbacks)[string]) => {
        callbacks[name] = callback;
        return { remove };
      },
    );
    const back = vi.fn(),
      resume = vi.fn();
    const stop = await initNativeKiosk(orientation, back, resume);
    expect(mocks.lock).toHaveBeenCalledWith({ orientation });
    expect(mocks.awake).toHaveBeenCalledOnce();
    callbacks.backButton({ isActive: false });
    callbacks.appStateChange({ isActive: false });
    expect(resume).not.toHaveBeenCalled();
    callbacks.appStateChange({ isActive: true });
    expect(back).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
    stop();
    stop();
    expect(remove).toHaveBeenCalledTimes(2);
    callbacks.backButton({ isActive: false });
    callbacks.appStateChange({ isActive: true });
    expect(back).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
  },
);
it('un plugin o listener rechazado no impide el resto ni rechaza cleanup', async () => {
  mocks.lock.mockRejectedValue(new Error('orientación'));
  mocks.awake.mockRejectedValue(new Error('wake'));
  const remove = vi.fn().mockRejectedValue(new Error('remove'));
  mocks.listen
    .mockRejectedValueOnce(new Error('back'))
    .mockResolvedValueOnce({ remove });
  const stop = await initNativeKiosk('landscape', vi.fn(), vi.fn());
  stop();
  await Promise.resolve();
  expect(remove).toHaveBeenCalledOnce();
});
it('retira registros que terminan después del cleanup aunque orientación no responda', async () => {
  let finish!: (handle: { remove: () => Promise<void> }) => void;
  const remove = vi.fn().mockResolvedValue(undefined);
  mocks.listen.mockReturnValue(
    new Promise<{ remove: () => Promise<void> }>((resolve) => {
      finish = resolve;
    }),
  );
  mocks.lock.mockReturnValue(new Promise(() => {}));
  const stop = await initNativeKiosk('landscape', vi.fn(), vi.fn());
  stop();
  finish({ remove });
  await Promise.resolve();
  expect(remove).toHaveBeenCalledTimes(2);
});
it('Atrás ignora cada pantalla del visitante y cierra admin/PIN sin usar historial', () => {
  const reset = vi
    .spyOn(flowStore.getState(), 'resetToAttract')
    .mockResolvedValue(undefined);
  const back = vi.fn();
  const unregister = registerAdminBack(back);
  for (const screen of [
    'attract',
    'form',
    'countdown',
    'game',
    'result',
    'leaderboard',
  ] as const) {
    flowStore.setState({ screen });
    handleNativeBack();
  }
  expect(back).not.toHaveBeenCalled();
  expect(reset).not.toHaveBeenCalled();
  flowStore.setState({ screen: 'admin' });
  handleNativeBack();
  expect(back).toHaveBeenCalledOnce();
  unregister();
  handleNativeBack();
  expect(reset).toHaveBeenCalledWith('finish');
  reset.mockRestore();
});
