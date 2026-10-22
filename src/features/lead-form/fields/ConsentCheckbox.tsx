export function ConsentCheckbox({
  id,
  text,
  checked,
  disabled,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  text: string;
  checked: boolean;
  disabled: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label
        className="flex min-h-12 cursor-pointer items-center gap-3 py-3"
        htmlFor={id}
      >
        <input
          id={id}
          name={id}
          className="h-5 w-5 shrink-0 accent-primary"
          type="checkbox"
          checked={checked}
          disabled={disabled}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.checked)}
          onBlur={onBlur}
        />
        <span className="text-sm leading-relaxed">{text}</span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
