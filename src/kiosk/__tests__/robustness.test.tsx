// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { startBrowserKiosk } from '../browserKiosk';
import { auditRepo } from '../../data/repos/auditRepo';
import { recordError } from '../auditError';
import { ErrorBoundary } from '../../app/ErrorBoundary';
import { flowStore } from '../../flow/flowStore';
import { brand } from '../../brand/brand';
import { InactivityWarning } from '../InactivityWarning';

vi.mock('../../data/repos/auditRepo', () => ({
  auditRepo: { add: vi.fn().mockResolvedValue(1) },
}));
vi.mock('../../data/repos/sessionsRepo', () => ({
  sessionsRepo: { markAbandoned: vi.fn().mockResolvedValue(undefined) },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

it('bloquea contexto, arrastre y pinch; permite scroll normal y quita listeners al terminar', () => {
  const stop = startBrowserKiosk();
  for (const type of ['contextmenu', 'dragstart', 'gesturestart']) {
    const event = new Event(type, { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  const normal = new WheelEvent('wheel', { cancelable: true });
  window.dispatchEvent(normal);
  expect(normal.defaultPrevented).toBe(false);
  const zoom = new WheelEvent('wheel', { ctrlKey: true, cancelable: true });
  window.dispatchEvent(zoom);
  expect(zoom.defaultPrevented).toBe(true);
  const touch = new Event('touchmove', { cancelable: true });
  Object.defineProperty(touch, 'touches', { value: [{}, {}] });
  window.dispatchEvent(touch);
  expect(touch.defaultPrevented).toBe(true);
  stop();
  const after = new Event('contextmenu', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});

it('audita errores globales y promesas con stack truncado, sin encadenar errores si falla audit', async () => {
  const stop = startBrowserKiosk();
  window.dispatchEvent(
    new ErrorEvent('error', { error: new Error('render support') }),
  );
  const event = new Event('unhandledrejection');
  Object.defineProperty(event, 'reason', {
    value: new Error('rejected operation'),
  });
  window.dispatchEvent(event);
  expect(auditRepo.add).toHaveBeenCalledWith(
    'window_error',
    expect.stringContaining('render support'),
  );
  expect(auditRepo.add).toHaveBeenCalledWith(
    'unhandled_rejection',
    expect.stringContaining('rejected operation'),
  );
  await recordError('test', new Error('x'.repeat(3000)));
  expect(vi.mocked(auditRepo.add).mock.lastCall?.[1]?.length).toBe(2000);
  vi.mocked(auditRepo.add).mockRejectedValueOnce(new Error('db offline'));
  await expect(
    recordError('test', new Error('another')),
  ).resolves.toBeUndefined();
  stop();
});

it('ErrorBoundary muestra recuperación con tiempo del config, audita y vuelve a ATTRACT', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let broken = true;
  function Broken() {
    if (broken) throw new Error('failed child');
    return <p>Recovered</p>;
  }
  flowStore.setState({ screen: 'form', leadUuid: null, sessionUuid: null });
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('status').textContent).toBe(
    brand.texts['error.recovering'],
  );
  expect(auditRepo.add).toHaveBeenCalledWith(
    'render_error',
    expect.stringContaining('failed child'),
  );
  broken = false;
  await act(async () => {
    vi.advanceTimersByTime(brand.kiosk.errorRecoveryMs);
  });
  expect(screen.getByText('Recovered')).toBeTruthy();
  expect(flowStore.getState().screen).toBe('attract');
});

it('el aviso enfoca su botón, contiene Tab y devuelve foco al continuar', () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  const onContinue = vi.fn();
  const mounted = render(
    <InactivityWarning secondsLeft={10} onContinue={onContinue} />,
  );
  const button = screen.getByRole('button');
  expect(document.activeElement).toBe(button);
  fireEvent.keyDown(button, { key: 'Tab' });
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  expect(onContinue).toHaveBeenCalledTimes(1);
  mounted.unmount();
  expect(document.activeElement).toBe(input);
  input.remove();
});
