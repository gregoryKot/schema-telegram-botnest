/**
 * Сбой ДО того, как запрос ушёл на площадку: соединение не установилось.
 * Только такой запрос повторять безопасно — сервер его не получал, дубля не
 * будет.
 *
 * R7 (аудит 2026-11): канал повторял всё, что не было ответом площадки, —
 * в том числе собственный таймаут ожидания ответа и обрыв уже отправленного
 * запроса. Пост к тому моменту мог выйти, и повтор давал в канале второй.
 * Поэтому здесь не «не ответила», а «не соединились»:
 *   - DNS и маршрут (ENOTFOUND, EAI_AGAIN, ENETUNREACH, EHOSTUNREACH),
 *     отказ в соединении (ECONNREFUSED), таймаут соединения undici
 *     (UND_ERR_CONNECT_TIMEOUT);
 *   - любая системная ошибка вызова `connect`/`getaddrinfo` — так Node
 *     подписывает «connect ETIMEDOUT» (инцидент 2026-08-09);
 *   - AggregateError — Node перебрал все адреса хоста и ни к одному не
 *     подключился;
 *   - обрыв TLS до рукопожатия: тело запроса ещё не отправлялось.
 * Не входит: наша отмена по таймауту (AbortError/TimeoutError), ECONNRESET и
 * «socket hang up» после записи, таймауты заголовков и тела — исход
 * неизвестен.
 *
 * Ошибки приходят в двух обёртках: fetch из undici кладёт системную ошибку в
 * `cause`, node-fetch внутри telegraf — в собственные поля (`code`,
 * `erroredSysCall`) и в текст («…failed, reason: connect ETIMEDOUT …»).
 */

const CONNECT_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
]);
const CONNECT_SYSCALLS = new Set(['connect', 'getaddrinfo']);
// «reason: connect ETIMEDOUT 1.2.3.4:443» — так node-fetch пересказывает
// системную ошибку, когда сами поля потерялись по дороге.
const CONNECT_TEXT =
  /(?:^|\s)(?:connect|getaddrinfo) E[A-Z]+|before secure TLS connection was established/;

type Layer = Record<string, unknown>;

function asLayer(v: unknown): Layer | null {
  return v && typeof v === 'object' ? (v as Layer) : null;
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

function layerIsConnect(e: Layer): boolean {
  const code = str(e.code);
  if (code && CONNECT_CODES.has(code)) return true;
  const syscall = str(e.syscall) ?? str(e.erroredSysCall);
  if (syscall && CONNECT_SYSCALLS.has(syscall)) return true;
  if (e.name === 'AggregateError') return true;
  return CONNECT_TEXT.test(str(e.message) ?? '');
}

export function isConnectFailure(err: unknown): boolean {
  // Наша отмена — всегда «исход неизвестен», что бы ни лежало в cause.
  const top = asLayer(err);
  if (!top || top.name === 'AbortError' || top.name === 'TimeoutError')
    return false;
  // Обёртка и её причина; глубже fetch не вкладывает.
  const cause = asLayer(top.cause);
  return layerIsConnect(top) || (cause !== null && layerIsConnect(cause));
}
