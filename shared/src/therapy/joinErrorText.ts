// Текст отказа POST /api/therapy/join. Бэкенд на 409 { reason:
// 'already_connected' } говорит «у клиента уже есть активная связь с другим
// терапевтом» — «Неверный код» тут врёт: код верный, мешает действующее
// подключение. Один хелпер на оба фронтенда (правило №3). Для всех прочих
// ошибок возвращает null — вызывающий оставляет свой дефолтный текст.
// Формулировка без рода (правило «Род читателя»): «есть подключение», а не
// «подключён».
export function isAlreadyConnectedError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; reason?: unknown };
  return e.status === 409 && e.reason === 'already_connected';
}

export function joinTherapyErrorText(
  err: unknown,
  tr: (ty: string, vy: string) => string,
): string | null {
  if (!isAlreadyConnectedError(err)) return null;
  return tr(
    'У тебя уже есть подключение к терапевту. Сначала отключись в настройках, потом принимай новый код',
    'У вас уже есть подключение к терапевту. Сначала отключитесь в настройках, затем примите новый код',
  );
}
