// Ключи почты глазами площадки (правило №21: новая внешняя интеграция — проба
// с живым вызовом). Пассивная проба `email` (probe-email.ts) узнаёт об
// отозванном ключе только по первому реальному письму — а письмо входа могло
// не уйти раньше, чем его кто-то хватится.
//
// Запрос — подписанный теми же ключами POST на эндпоинт отправки с заведомо
// неполным телом `{}` (postbox-mail.ts): письма в нём нет, отправлять нечего,
// суточная квота (200 писем) не тратится. Гонится как все пробы: через минуту
// после старта и раз в час.
//
// Что записано с площадки (test/fixtures/recorded/postbox-send-email-denied.json):
// без подписи и с неверной подписью Postbox отвечает 403 `Forbidden` раньше,
// чем читает тело. Отсюда ГИПОТЕЗА, на которой стоит зелёный исход: с верной
// подписью очередь доходит до разбора тела, и на `{}` приходит 400
// (BadRequestException по документации). Ответ на подписанный запрос до
// выкладки записать нечем (ключей нет) — после выкладки его сверяют на проде
// по detail этой пробы в /stats и кладут в фикстуру.
//
// В /health не идёт, как вход Google/VK и бот MAX: внешняя площадка, сбой
// связи или несбывшаяся гипотеза держали бы смок прода красным. Владельцу — DM
// и /stats; реальный отказ письма красит /health через пробу `email`.
import {
  postboxCredentials,
  postboxRequest,
  PostboxResult,
} from '../postbox-mail';
import { Probe, ProbeResult } from './types';

const TIMEOUT_MS = 8_000;

type Env = Record<string, string | undefined>;
type RequestFn = typeof postboxRequest;

export function judgePostbox(res: PostboxResult): ProbeResult {
  const answer = `HTTP ${res.status}${res.error ? `: ${res.error}` : ''}`;
  if (res.status === 400 || res.status === 422) {
    return {
      ok: true,
      detail: `ключ принят: пробный запрос без письма дошёл до разбора тела (${answer})`,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      detail: `ключ отклонён или у сервисного аккаунта нет роли postbox.sender (${answer})`,
    };
  }
  if (res.status >= 500) {
    return {
      ok: false,
      detail: `Postbox отвечает ошибкой сервера (${answer})`,
    };
  }
  return {
    ok: false,
    detail: `неожиданный ответ Postbox на пробный запрос без письма (${answer})`,
  };
}

export function postboxProbe(
  env: Env = process.env,
  request: RequestFn = postboxRequest,
): Probe {
  return {
    id: 'postbox',
    title: 'Почта: Postbox',
    reportInHealth: false,
    retryOnce: true, // живой запрос к postbox.cloud.yandex.net (Probe.retryOnce)
    async run() {
      const credentials = postboxCredentials(env);
      if (!credentials) return { ok: true, detail: 'выключено' };
      try {
        return judgePostbox(
          await request({}, { credentials, timeoutMs: TIMEOUT_MS }),
        );
      } catch (e) {
        if ((e as { name?: string } | null)?.name === 'TimeoutError') {
          return {
            ok: false,
            detail: `Postbox не ответил за ${TIMEOUT_MS / 1000} с`,
          };
        }
        const msg = (e as Error)?.message ?? String(e);
        return {
          ok: false,
          detail: `Postbox недоступен: ${msg.slice(0, 160)}`,
        };
      }
    },
  };
}
