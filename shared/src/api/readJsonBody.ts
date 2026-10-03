// Разбор тела успешного ответа API — единая реализация для обоих фронтендов
// (правило №3 CLAUDE.md). Nest на `return null` из контроллера шлёт ПУСТОЕ
// тело (Express: response.send() без аргумента), и e2e сервера это пинит
// (`expect(text).toBe('')`, app-ownership-sweep-2). Голый res.json() на пустом
// теле бросает SyntaxError, запрос «падает», хотя сервер ответил штатно:
// инцидент 2026-10-03 — «нет записи» по /api/ysq-progress и /api/ysq-result
// роняло загрузку приложения и экран теста схем.
//
// Пустое тело = null. Непустое и невалидное — по-прежнему отклонение: реальная
// поломка (502-страница от прокси, оборванный ответ) должна оставаться видимой.
export async function readJsonBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text.trim() === '') return null as T;
  return JSON.parse(text) as T;
}
