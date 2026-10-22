// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LeadFormScreen } from '../LeadFormScreen';
import { brand } from '../../../brand/brand';

afterEach(cleanup);
const mount = (onSubmit = vi.fn().mockResolvedValue(undefined)) => ({
  onSubmit,
  ...render(
    <LeadFormScreen
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      ready
      imageError={false}
      onRetryImage={vi.fn()}
    />,
  ),
});
function fillValid() {
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), {
    target: { value: 'Ana Pérez' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'ana@example.com' },
  });
  fireEvent.click(screen.getByLabelText(brand.form.consent.text));
}
it('valida en blur y submit, no mientras escribe, sin diálogos nativos', () => {
  mount();
  const email = screen.getByLabelText('Email');
  fireEvent.change(email, { target: { value: 'bad' } });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.blur(email);
  expect(screen.getByRole('alert').textContent).toBe(
    brand.texts['form.errors.email'],
  );
  fireEvent.submit(document.querySelector('form')!);
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(1);
  expect(document.querySelector('form')!.noValidate).toBe(true);
});
it('doble submit solo guarda una vez; error conserva el borrador y permite reintentar', async () => {
  let reject: ((reason: Error) => void) | undefined;
  const onSubmit = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValueOnce(undefined);
  mount(onSubmit);
  fillValid();
  fireEvent.submit(document.querySelector('form')!);
  fireEvent.submit(document.querySelector('form')!);
  expect(onSubmit).toHaveBeenCalledOnce();
  expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(
    true,
  );
  await act(async () => {
    reject?.(new Error('storage full'));
  });
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(
    'ana@example.com',
  );
  expect(screen.getByRole('alert').textContent).toBe(
    brand.texts['form.saveError'],
  );
  await act(async () => {
    fireEvent.submit(document.querySelector('form')!);
  });
  expect(onSubmit).toHaveBeenCalledTimes(2);
});
it('reset remonta campos vacíos con nombres aleatorios y autocompletado desactivado; Enter avanza foco', () => {
  const first = mount();
  fillValid();
  const name = screen.getByLabelText('Nombre y apellido') as HTMLInputElement;
  const oldName = name.name;
  expect(name.autocomplete).toBe('off');
  expect(name.getAttribute('spellcheck')).toBe('false');
  fireEvent.keyDown(name, { key: 'Enter' });
  expect(document.activeElement).toBe(screen.getByLabelText('Email'));
  first.unmount();
  mount();
  const next = screen.getByLabelText('Nombre y apellido') as HTMLInputElement;
  expect(next.value).toBe('');
  expect(next.name).not.toBe(oldName);
  expect(
    (screen.getByLabelText(brand.form.consent.text) as HTMLInputElement)
      .checked,
  ).toBe(false);
});
