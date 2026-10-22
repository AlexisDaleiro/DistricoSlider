export function formatPlayerName(
  name: string,
  format: 'firstNameLastInitial' = 'firstNameLastInitial',
): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (format === 'firstNameLastInitial' && parts.length > 1)
    return `${parts[0]} ${Array.from(parts[parts.length - 1])[0]}.`;
  return parts[0];
}
