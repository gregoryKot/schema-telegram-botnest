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

/** Ссылка с протоколом внутри свободного текста (стек, сообщение). */
const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s)'"<>]+/gi;
/** Параметры, в которых живут креденшелы (initData мини-аппа, JWT, OAuth). */
const SECRET_PARAM =
  /\b(tgWebAppData|WebAppData|initData|access_token|refresh_token|id_token|token|hash|signature|code|state)=[^\s&)'"<>]*/gi;

/**
 * Санитайзер СВОБОДНОГО ТЕКСТА (message/stack/componentStack), а не одного
 * URL. `stripUrlSecrets` для текста не годится: он режет строку по первому
 * `?`/`#` и съел бы всё остальное сообщение. Здесь режется хвост у каждой
 * найденной ссылки, а «голые» креденшел-параметры (`#tgWebAppData=…` без
 * схемы — так они часто лежат в тексте ошибки роутера) затираются на месте.
 * M8 аудита 2026-10: в стек попадает `location.href`, а во фрагменте живёт
 * живая подпись initData / JWT (тот же класс, что H0 2026-07-20).
 */
export function stripUrlSecretsInText(text: string): string;
export function stripUrlSecretsInText(text: undefined): undefined;
export function stripUrlSecretsInText(
  text: string | undefined,
): string | undefined;
export function stripUrlSecretsInText(
  text: string | undefined,
): string | undefined {
  if (!text) return text;
  return text
    .replace(URL_IN_TEXT, (url) => {
      const cut = url.split('#')[0].split('?')[0];
      return cut.length === url.length ? url : `${cut}[…]`;
    })
    .replace(SECRET_PARAM, '$1=[redacted]');
}
