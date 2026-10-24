// Показ кода билета человеку.
//
// Зеркало бэкендового `formatUserCode` (src/telegram/login-payload.ts):
// бэкенд из shared не импортирует, а формат обязан совпадать — человек
// сверяет строку в чате бота со строкой на экране приложения, и любое
// расхождение превращает сверку в «наверное, это оно».
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
