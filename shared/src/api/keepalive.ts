// keepalive-запрос переживает закрытие вкладки, но браузер ограничивает тело
// таких запросов 64 КиБ (на все разом): больше — fetch отказывает сразу, и
// досылка при уходе (shared/src/utils/usePendingSave.ts) терялась бы целиком.
// Концептуализация с семью полями по 5000 знаков кириллицей близка к пределу,
// карта режимов на 200 узлов — за ним. Тело крупнее порога уходит обычным
// запросом: при закрытии вкладки шанс долететь у него меньше, но он есть, а
// при скрытии вкладки (страница жива) он долетает как обычно.
export const KEEPALIVE_BODY_MAX_BYTES = 60_000;

export function withKeepalive(
  init: RequestInit,
  opts?: { keepalive?: boolean },
): RequestInit {
  if (!opts?.keepalive) return init;
  const body = typeof init.body === 'string' ? init.body : '';
  if (new TextEncoder().encode(body).length > KEEPALIVE_BODY_MAX_BYTES)
    return init;
  return { ...init, keepalive: true };
}
