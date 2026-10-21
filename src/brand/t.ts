import { brand } from './brand';

export function t(
  key: string,
  vars: Record<string, string | number> = {},
): string {
  const template = brand.texts[key];
  if (template === undefined)
    throw new Error(`Texto no encontrado en la marca: ${key}`);
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : placeholder,
  );
}
