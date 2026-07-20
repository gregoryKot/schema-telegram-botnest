/**
 * Санитайзер URL краш-телеметрии на стороне бэкенда.
 *
 * Зачем дубль фронтового `shared/src/utils/telemetryUrl` (правило №11 про
 * дубли — осознанное исключение, два разных слоя обороны):
 *   1. корневой tsconfig ЯВНО исключает `shared/` — импортировать оттуда
 *      бэкендом нельзя;
 *   2. `POST /api/client-errors` публичный и без auth-гарда: фронт может быть
 *      устаревшим (закэшенный бандл шлёт полный href), а атакующий положит в
 *      `url` что угодно. Полагаться на санитайзинг клиента нельзя в принципе.
 *
 * См. аудит 2026-07-20, H0 (утечка живой initData/JWT в логи и DM админа).
 */

/** Схема+хост+путь без query/fragment — там живут initData и access-токен. */
export function stripUrlSecrets(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const cut = url.split('#')[0].split('?')[0].trim();
  return cut ? cut.slice(0, 200) : undefined;
}
