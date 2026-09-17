import { telemetryUrl } from '../utils/telemetryUrl';

// Отправка пойманной ErrorBoundary ошибки на бэкенд (best-practice «видимость
// прода», 2026-07) — единственная копия для обоих фронтендов (правило №3,
// раньше жила дословным дублем в webapp/src/api.ts и schema-miniapp/src/api.ts).
// Без auth, fire-and-forget, keepalive — долетает даже при краше на выгрузке;
// сама никогда не бросает: телеметрия не мешает UI.
//
// H0 (аудит 2026-07-20): в url — ТОЛЬКО путь, без query/fragment. Во фрагменте
// живут секреты обоих фронтендов: у вебаппа после логина
// `/auth/callback#access_token=<JWT>` (TTL 15 мин, хеш чистится лишь в
// useEffect), у мини-аппа — initData (`#tgWebAppData=…&hash=…`, реплей 1 ч =
// имперсонация). Краш на фазе рендера успевал отправить секрет в логи сервера
// и в DM админа — поэтому срезает telemetryUrl, а не сами фронтенды.
export function createClientErrorReporter(
  base: string,
  source: 'webapp' | 'miniapp',
) {
  return function reportClientError(payload: {
    message: string;
    section: string;
    stack?: string;
    componentStack?: string;
  }): void {
    try {
      void fetch(`${base}/api/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payload.message.slice(0, 500),
          section: payload.section.slice(0, 120),
          stack: payload.stack?.slice(0, 4000),
          componentStack: payload.componentStack?.slice(0, 4000),
          source,
          url:
            typeof location !== 'undefined'
              ? telemetryUrl(location.href)
              : undefined,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* best-effort */
    }
  };
}
