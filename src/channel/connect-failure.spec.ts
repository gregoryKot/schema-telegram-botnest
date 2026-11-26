// R7 (аудит 2026-11): повторять можно только запрос, который не ушёл. Формы
// ошибок — как их отдают fetch из undici (системная ошибка в cause) и
// node-fetch внутри telegraf (поля на самой ошибке и текст «reason: …»).
import { isConnectFailure } from './connect-failure';

const sys = (code: string, syscall?: string, message = code) =>
  Object.assign(new Error(message), { code, ...(syscall && { syscall }) });

const undici = (cause: unknown) =>
  Object.assign(new TypeError('fetch failed'), { cause });

describe('isConnectFailure — соединение не установилось', () => {
  it.each([
    ['отказ в соединении', undici(sys('ECONNREFUSED', 'connect'))],
    ['DNS не ответил', undici(sys('ENOTFOUND', 'getaddrinfo'))],
    ['таймаут соединения undici', undici(sys('UND_ERR_CONNECT_TIMEOUT'))],
    [
      'connect ETIMEDOUT (системный вызов connect)',
      undici(sys('ETIMEDOUT', 'connect')),
    ],
    [
      'все адреса хоста не ответили (AggregateError)',
      undici(
        Object.assign(new AggregateError([], 'all failed'), {
          code: 'ETIMEDOUT',
        }),
      ),
    ],
    [
      'TLS оборван до рукопожатия',
      undici(
        sys(
          'ECONNRESET',
          undefined,
          'Client network socket disconnected before secure TLS connection was established',
        ),
      ),
    ],
    [
      'node-fetch: erroredSysCall=connect',
      Object.assign(new Error('request failed'), {
        code: 'ETIMEDOUT',
        erroredSysCall: 'connect',
      }),
    ],
    [
      'node-fetch: только текст причины',
      new Error(
        'request to https://api.telegram.org/bot<token>/sendMessage failed, reason: connect ETIMEDOUT 149.154.167.220:443',
      ),
    ],
  ])('%s — повторяем', (_name, err) => {
    expect(isConnectFailure(err)).toBe(true);
  });
});

describe('isConnectFailure — запрос мог уйти', () => {
  it.each([
    [
      'наш таймаут ожидания (AbortSignal.timeout)',
      Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
    ],
    [
      'наша отмена (AbortError), даже с connect-причиной внутри',
      Object.assign(new Error('aborted'), {
        name: 'AbortError',
        cause: sys('ECONNREFUSED', 'connect'),
      }),
    ],
    ['обрыв после записи (read ECONNRESET)', undici(sys('ECONNRESET', 'read'))],
    ['другая сторона закрыла сокет', undici(sys('UND_ERR_SOCKET'))],
    ['таймаут заголовков ответа', undici(sys('UND_ERR_HEADERS_TIMEOUT'))],
    ['ETIMEDOUT на уже открытом сокете', sys('ETIMEDOUT', 'read')],
    [
      'ответ API Telegram',
      { response: { error_code: 400, description: 'Bad Request' } },
    ],
    ['пустота', null],
    ['строка', 'fetch failed'],
  ])('%s — не повторяем', (_name, err) => {
    expect(isConnectFailure(err)).toBe(false);
  });
});
