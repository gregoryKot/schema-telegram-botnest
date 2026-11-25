// Аватар — буква serif в тонком кольце, без заливки (#1674, В5): один вид у профиля, терапевта, клиентов и сайдбара.
// Размер — класс места (tc-avatar, sb-avatar…); нет буквы (имя не задано) — кружка нет.
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  if (!initials) return null;
  return <span className={className ? `ds-avatar ${className}` : 'ds-avatar'} aria-hidden="true">{initials}</span>;
}
