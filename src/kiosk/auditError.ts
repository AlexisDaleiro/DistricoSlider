import { auditRepo } from '../data/repos/auditRepo';

/** El logger no puede provocar otro unhandledrejection si IndexedDB falla. */
export async function recordAudit(
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await auditRepo.add(action, detail);
  } catch {
    /* Recuperar la UI aun sin almacenamiento. */
  }
}

export function recordError(action: string, error: unknown, stack = '') {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error);
  return recordAudit(action, `${message}\n${stack}`.slice(0, 2000));
}
