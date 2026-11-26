/**
 * Экранирование HTML для Telegram parse_mode: 'HTML' (уведомления админу).
 * Пользовательские строки без экранирования ломают parse сообщения
 * (и открывают инъекцию разметки) — прогоняй через эту функцию.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
