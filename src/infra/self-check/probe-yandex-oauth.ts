// Вход через Яндекс ID глазами площадки (правило №21: новая внешняя интеграция —
// проба с живым вызовом). oauthRedirects сверяет только наш env с каноническим
// хостом — что ответит Яндекс, она не знает (класс инцидента 2026-10-03, VK).
//
// Два запроса, оба анонимные, входа не происходит:
//  (а) GET на ссылку входа, построенную ТЕМ ЖЕ кодом провайдера, что и прод,
//      без перехода по редиректу. Записано 2026-11-12 (yandex-id-oauth.json):
//      302 на passport.yandex.ru, наш state лежит в retpath без изменений.
//      Тот же ответ приходит и на чужой client_id — этот шаг проверяет только
//      доступность площадки и сохранность state.
//  (б) POST /token теми же client_id и секретом, что и прод (метод провайдера
//      requestToken), с кодом-пустышкой. Записано: неверный секрет и
//      неизвестное приложение — 400 invalid_client. ГИПОТЕЗА зелёного исхода:
//      с верной парой Яндекс доходит до проверки кода и отвечает invalid_grant
//      или bad_verification_code (так в документации). Записать этот ответ до
//      выкладки было нечем — секрета у сессии записи не было; он сверяется на
//      проде после выкладки по detail пробы в /stats и кладётся в фикстуру.
//
// В /health не идёт, как вход VK и почта Postbox: сбой связи до внешней
// площадки или несбывшаяся гипотеза держали бы смок прода красным. Владельцу —
// DM и /stats. Секрет и токены в detail не попадают: из ответа берётся только
// код ошибки (oauth-error-code.ts).
import { YandexProvider } from '../../auth/providers/yandex.provider';
import { OAUTH_PROVIDER_ENV } from '../../auth/oauth-provider-switch';
import { oauthErrorCode } from '../../auth/oauth-error-code';
import { Probe, ProbeResult } from './types';
import {
  FirstHop,
  SAMPLE_STATE,
  configFrom,
  failed,
  firstHop,
  isRedirect,
} from './probe-oauth-providers';

const TIMEOUT_MS = 8_000;
/** Той же формы, что настоящий код (16 символов a-z0-9), но никем не выдан. */
const DUMMY_CODE = 'selfcheck0000000';
const LOGIN_HOST = 'passport.yandex.ru';
/** Яндекс дошёл до проверки кода — значит, приложение и секрет принял. */
const CODE_REFUSED = new Set(['invalid_grant', 'bad_verification_code']);
const CLIENT_REFUSED = new Set(['invalid_client', 'unauthorized_client']);

type Env = Record<string, string | undefined>;

function parseUrl(raw: string | null | undefined): URL | null {
  try {
    return raw ? new URL(raw) : null;
  } catch {
    return null; // не адрес — проба ответит «state изменён» или «не переход»
  }
}

export function judgeYandexAuthorize(
  hop: FirstHop,
  sentState: string,
): ProbeResult {
  const to = parseUrl(hop.location);
  if (!isRedirect(hop.status) || to?.host !== LOGIN_HOST) {
    // Куда увели — только хост: в адресе перехода лежит наш state.
    const where = to ? ` (переход на ${to.host})` : '';
    return {
      ok: false,
      detail:
        `Яндекс ID ответил HTTP ${hop.status}${where} вместо перехода ко входу ` +
        `на ${LOGIN_HOST} — площадка недоступна или изменила первый шаг входа`,
    };
  }
  const back = parseUrl(to.searchParams.get('retpath'))?.searchParams.get(
    'state',
  );
  if (back !== sentState) {
    return {
      ok: false,
      detail:
        `Яндекс ID вернул state изменённым (${sentState.length} → ` +
        `${back?.length ?? 0} символов) — колбэк отклонит каждый вход`,
    };
  }
  return { ok: true, detail: 'запрос входа принят, state без изменений' };
}

export function judgeYandexToken(status: number, body: unknown): ProbeResult {
  const raw =
    body !== null && typeof body === 'object'
      ? (body as { error?: unknown }).error
      : undefined;
  const error = oauthErrorCode(raw);
  if (CODE_REFUSED.has(error)) {
    return {
      ok: true,
      detail: `приложение и секрет приняты (на код-пустышку — ${error})`,
    };
  }
  if (CLIENT_REFUSED.has(error)) {
    return {
      ok: false,
      detail:
        `Яндекс отклонил client_id или секрет (${error}, HTTP ${status}) — ` +
        'сверить YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET с кабинетом oauth.yandex.ru',
    };
  }
  return {
    ok: false,
    detail: `неожиданный ответ Яндекса на пробный обмен кода: HTTP ${status}, код ошибки «${error}»`,
  };
}

export function yandexOAuthProbe(env: Env = process.env): Probe {
  return {
    id: 'yandexOAuth',
    title: 'Вход через Яндекс',
    reportInHealth: false,
    retryOnce: true, // живые authorize и token Яндекс ID (Probe.retryOnce)
    async run() {
      if (!OAUTH_PROVIDER_ENV.yandex.every((name) => env[name]?.trim()))
        return { ok: true, detail: 'выключено' };
      try {
        const provider = new YandexProvider(configFrom(env));
        const url = provider.buildAuthUrl(SAMPLE_STATE);
        const [hop, token] = await Promise.all([
          firstHop(url),
          provider.requestToken(DUMMY_CODE, TIMEOUT_MS),
        ]);
        const first = judgeYandexAuthorize(hop, SAMPLE_STATE);
        if (!first.ok) return first;
        const second = judgeYandexToken(token.status, token.body);
        return second.ok
          ? { ok: true, detail: `Яндекс ID: ${first.detail}; ${second.detail}` }
          : second;
      } catch (e) {
        return failed(e, 'Яндекс ID');
      }
    },
  };
}
