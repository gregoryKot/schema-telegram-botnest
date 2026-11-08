// Память об уже разобранном `start_param` хоста. Внутри Telegram и MAX он
// приходит из подписанных данных запуска, а не из адреса: перезагрузка вебвью
// отдаёт его снова, и убрать его, как `?startapp=` (navigate replace), нечем —
// экран согласия по pair_/therapy_ открывался второй раз (#758). Помним код на
// время вкладки: sessionStorage живёт, пока жив вебвью, новый запуск хоста —
// новая вкладка и новая память. Ключ пишет только этот модуль (sessionStorage
// гейт check-local-cache-writers не смотрит, владелец один и так).
export const HANDLED_HOST_PARAM_KEY = 'host_start_param_handled';

/**
 * Параметр хоста, если в этой вкладке его ещё не разбирали; с этого вызова он
 * считается разобранным. Хранилище закрыто — отдаём как есть: повторное
 * согласие безопасно (нужен явный клик), потерять ссылку — хуже.
 */
export function freshHostParam(raw: string | null): string | null {
  if (!raw) return null;
  try {
    if (sessionStorage.getItem(HANDLED_HOST_PARAM_KEY) === raw) return null;
    sessionStorage.setItem(HANDLED_HOST_PARAM_KEY, raw);
    return raw;
  } catch {
    return raw;
  }
}
