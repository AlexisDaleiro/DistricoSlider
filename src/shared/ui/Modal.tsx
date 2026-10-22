import { useEffect, useId, useRef, type ReactNode } from 'react';
export function Modal({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    section.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <div className="kiosk-overlay" onClick={(event) => event.stopPropagation()}>
      <section
        ref={section}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-brand bg-surface p-6 outline-none sm:p-8"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const nodes = Array.from(
            section.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ) ?? [],
          );
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === section.current)
          ) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === section.current)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 className="game-heading" id={id}>
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
}
