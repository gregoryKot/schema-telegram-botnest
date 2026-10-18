/** Подпись автосохранения: время последнего сохранения или «автоматически». */
export function savedLabel(lastSavedAt: Date | null): string {
  return lastSavedAt
    ? `сохранено ${lastSavedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : 'сохранено автоматически';
}
