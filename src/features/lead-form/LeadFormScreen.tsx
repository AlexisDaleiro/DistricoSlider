import { useMemo, useRef, useState } from 'react';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';
import { buildLeadSchema, type LeadFormValues } from './buildLeadSchema';
import { TextField } from './fields/TextField';
import { EmailField } from './fields/EmailField';
import { PhoneField } from './fields/PhoneField';
import { ConsentCheckbox } from './fields/ConsentCheckbox';

interface Props {
  onSubmit: (values: LeadFormValues) => Promise<void>;
  onCancel: () => void;
  ready: boolean;
  imageError: boolean;
  onRetryImage: () => void;
  identityLocked?: boolean;
}
export function LeadFormScreen({
  onSubmit,
  onCancel,
  ready,
  imageError,
  onRetryImage,
  identityLocked = false,
}: Props) {
  const brand = useBrand();
  const schema = useMemo(
    () => buildLeadSchema(brand.form, brand.texts),
    [brand.form, brand.texts],
  );
  const [prefix] = useState(() => crypto.randomUUID());
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(brand.form.fields.map((field) => [field.id, ''])),
  );
  const [consent, setConsent] = useState(false);
  const [marketingOptIn, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const locked = useRef(false);
  const validate = (only?: string) => {
    const result = schema.safeParse({ fields, consent, marketingOptIn });
    const next: Record<string, string> = {};
    if (!result.success)
      for (const issue of result.error.issues) {
        const key = String(
          issue.path[0] === 'fields' ? issue.path[1] : issue.path[0],
        );
        next[key] ??= issue.message;
      }
    setErrors((previous) =>
      only ? { ...previous, [only]: next[only] } : next,
    );
    return result;
  };
  const onEnter = (element: HTMLInputElement) => {
    const inputs = Array.from(
      element.form?.querySelectorAll<HTMLInputElement>('[data-lead-field]') ??
        [],
    );
    const next = inputs[inputs.indexOf(element) + 1];
    if (next) next.focus();
    else element.form?.requestSubmit();
  };
  return (
    <main className="mx-auto max-w-xl px-5 pt-4 pb-10">
      <section className="rounded-brand bg-surface p-6 sm:p-8">
        <p className="game-eyebrow">{t('game.eyebrow')}</p>
        <h1 className="game-heading mt-4">{brand.form.title}</h1>
        {brand.gameHub && (
          <p className="mt-4 text-muted">
            Registraremos tu nombre, celular y los resultados de tus partidas en
            la central de juegos. Uruguay por defecto: 099 123 456. Para otro
            país, ingresá + y su prefijo internacional.
          </p>
        )}
        <form
          className="mt-7 space-y-5"
          noValidate
          autoComplete="off"
          aria-busy={saving}
          onSubmit={async (event) => {
            event.preventDefault();
            if (locked.current || !ready) return;
            const result = validate();
            if (!result.success) return;
            locked.current = true;
            setSaving(true);
            setSaveError(null);
            try {
              await onSubmit(result.data);
            } catch (error) {
              setSaveError(
                brand.gameHub && error instanceof Error
                  ? error.message
                  : t('form.saveError'),
              );
            } finally {
              locked.current = false;
              setSaving(false);
            }
          }}
        >
          {brand.form.fields.map((field) => {
            const Field =
              field.type === 'email'
                ? EmailField
                : field.type === 'tel'
                  ? PhoneField
                  : TextField;
            return (
              <Field
                key={field.id}
                field={field}
                inputName={`${prefix}-${field.id}`}
                value={fields[field.id] ?? ''}
                error={errors[field.id]}
                disabled={saving || identityLocked}
                onChange={(value) =>
                  setFields((current) => ({ ...current, [field.id]: value }))
                }
                onBlur={() => validate(field.id)}
                onEnter={onEnter}
              />
            );
          })}
          <ConsentCheckbox
            id={`${prefix}-consent`}
            text={brand.form.consent.text}
            checked={consent}
            disabled={saving || identityLocked}
            error={errors.consent}
            onChange={setConsent}
            onBlur={() => validate('consent')}
          />
          {!brand.gameHub && brand.form.marketingOptIn.enabled && (
            <ConsentCheckbox
              id={`${prefix}-marketing`}
              text={brand.form.marketingOptIn.text}
              checked={marketingOptIn}
              disabled={saving}
              onChange={setMarketing}
            />
          )}
          {saveError && (
            <p role="alert" className="text-sm text-danger">
              {saveError}
            </p>
          )}
          {imageError && (
            <div role="alert">
              <p className="text-sm text-danger">{t('game.loadError')}</p>
              <button
                type="button"
                className="game-button text-primary"
                onClick={onRetryImage}
              >
                {t('game.retry')}
              </button>
            </div>
          )}
          <button
            type="submit"
            className="game-button w-full bg-primary text-on-primary"
            disabled={saving || !ready}
          >
            {saving && !brand.gameHub
              ? t('form.saving')
              : brand.gameHub && !ready
                ? 'Conexión pendiente'
                : !ready && !imageError
                  ? t('game.loading')
                  : brand.form.submit}
          </button>
          <button
            type="button"
            className="game-button w-full text-muted"
            onClick={onCancel}
            disabled={saving && !brand.gameHub}
          >
            {brand.gameHub
              ? 'Cambiar participante / borrar datos'
              : t('form.cancel')}
          </button>
        </form>
      </section>
    </main>
  );
}
