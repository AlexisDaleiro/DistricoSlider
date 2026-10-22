// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSecretTap } from '../useSecretTap';
import { PinPad } from '../PinPad';
import { HoldToConfirmButton } from '../HoldToConfirmButton';
import { PinGate } from '../PinGate';
import { brand } from '../../../brand/brand';
import { flowStore } from '../../../flow/flowStore';
import type { pinService } from '../pin';
vi.mock('../../../kiosk/auditError', () => ({
  recordAudit: vi.fn(),
  recordError: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('5 toques dentro de la ventana abren, los separados no cuentan y no hay feedback', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const unlock = vi.fn();
  const { result } = renderHook(() => useSecretTap(5, 3000, unlock));
  for (let i = 0; i < 4; i++) result.current();
  expect(unlock).not.toHaveBeenCalled();
  now = 3000;
  result.current();
  expect(unlock).not.toHaveBeenCalled();
  for (let i = 0; i < 4; i++) result.current();
  expect(unlock).toHaveBeenCalledTimes(1);
});
it('PinPad solo muestra puntos, borra y envía una vez al cuarto dígito sin input nativo', async () => {
  let done: (() => void) | undefined;
  const submit = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      }),
  );
  render(<PinPad onSubmit={submit} />);
  for (const digit of ['1', '2'])
    fireEvent.click(screen.getByRole('button', { name: digit }));
  fireEvent.click(
    screen.getByRole('button', { name: brand.texts['admin.backspace'] }),
  );
  for (const digit of ['2', '3', '4'])
    fireEvent.click(screen.getByRole('button', { name: digit }));
  expect(submit).toHaveBeenCalledWith('1234');
  expect(submit).toHaveBeenCalledTimes(1);
  expect(document.querySelector('input')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('●●●●');
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => done?.());
  expect(screen.getByRole('status').getAttribute('aria-label')).toContain('0');
});
it('hold cancela al soltar, salir o perder foco; teclado sostenido confirma una vez y desmontaje cancela', () => {
  vi.useFakeTimers();
  const confirm = vi.fn();
  const mounted = render(
    <HoldToConfirmButton durationMs={2000} onConfirm={confirm}>
      Hold
    </HoldToConfirmButton>,
  );
  const button = screen.getByRole('button');
  fireEvent.pointerDown(button, { button: 0 });
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.pointerUp(button);
  act(() => vi.advanceTimersByTime(2000));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.pointerDown(button, { button: 0 });
  fireEvent.pointerLeave(button);
  act(() => vi.advanceTimersByTime(2000));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: 'Enter' });
  act(() => vi.advanceTimersByTime(2000));
  expect(confirm).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(button, { key: 'Enter', repeat: true });
  act(() => vi.advanceTimersByTime(2000));
  expect(confirm).toHaveBeenCalledTimes(1);
  fireEvent.keyUp(button);
  fireEvent.pointerDown(button, { button: 0 });
  mounted.unmount();
  act(() => vi.advanceTimersByTime(2000));
  expect(confirm).toHaveBeenCalledTimes(1);
});
it('modal PIN respeta los 20 s del config y el bloqueo deshabilita teclas', async () => {
  vi.useFakeTimers();
  const service = {
    state: vi.fn().mockResolvedValue({ lockedUntil: Date.now() + 30000 }),
    verify: vi.fn(),
  } as unknown as ReturnType<typeof pinService>;
  flowStore.setState({ screen: 'admin', sessionUuid: null, leadUuid: null });
  render(<PinGate service={service} onCancel={vi.fn()} onVerified={vi.fn()} />);
  await act(async () => {});
  expect(
    (
      screen.getByRole('button', {
        name: '1',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  act(() => vi.advanceTimersByTime(brand.kiosk.admin.pinTimeoutMs));
  expect(flowStore.getState().screen).toBe('attract');
});
