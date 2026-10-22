// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  back: vi.fn(),
  resume: vi.fn(),
}));
vi.mock('../native', () => ({ initNativeKiosk: mocks.init }));
vi.mock('../backNavigation', () => ({ handleNativeBack: mocks.back }));
vi.mock('../activityTracker', async (original) => ({
  ...(await original<typeof import('../activityTracker')>()),
  checkActivityNow: mocks.resume,
}));
vi.mock('../../data/initialize', () => ({
  initializeData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../app/ScreenRouter', () => ({ ScreenRouter: () => null }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('StrictMode elimina listeners que terminan de registrar tarde y bloquea callbacks tras desmontar', async () => {
  const pending: {
    back: () => void;
    resume: () => void;
    resolve: (stop: () => void) => void;
  }[] = [];
  mocks.init.mockImplementation(
    (_orientation: string, back: () => void, resume: () => void) =>
      new Promise<() => void>((resolve) =>
        pending.push({ back, resume, resolve }),
      ),
  );
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  expect(pending).toHaveLength(2);
  const first = vi.fn(),
    second = vi.fn();
  await act(async () => {
    pending[0].resolve(first);
    pending[1].resolve(second);
  });
  expect(first).toHaveBeenCalledOnce();
  expect(second).not.toHaveBeenCalled();
  pending[0].back();
  pending[0].resume();
  expect(mocks.back).not.toHaveBeenCalled();
  expect(mocks.resume).not.toHaveBeenCalled();
  pending[1].back();
  pending[1].resume();
  expect(mocks.back).toHaveBeenCalledOnce();
  expect(mocks.resume).toHaveBeenCalledOnce();
  view.unmount();
  expect(second).toHaveBeenCalledOnce();
  pending[1].back();
  pending[1].resume();
  expect(mocks.back).toHaveBeenCalledOnce();
  expect(mocks.resume).toHaveBeenCalledOnce();
});
