import type { CrossCheck } from './env-check';
import { CANONICAL_HOST, isRedirectedHost } from './canonical-host';
import { ORIGIN_CROSS_CHECKS } from './env-check.origins';

// Кросс-проверки хостов (вынесены из env-check.ts: файл упирался в потолок
// размера, правило №10): CORS-origin и адрес мини-аппа.
export const HOST_CROSS_CHECKS: CrossCheck[] = [
  ...ORIGIN_CROSS_CHECKS,
  {
    // Правило №19: мини-апп живёт на каноническом хосте под /app/. MINIAPP_URL
    // со старым vercel-деплоем, www. или без /app/ вшивается в каждую
    // webApp-кнопку бота — пользователь открывает не то приложение. В dev
    // законен localhost, поэтому проверка только в проде.
    id: 'miniappUrlCanonicalHost',
    check: (env, mode) => {
      const raw = env.MINIAPP_URL?.trim();
      if (!raw || mode !== 'production') return null;
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return null; // формат ловит реестр (env-registry.entries.telegram.ts)
      }
      const host = url.hostname.toLowerCase();
      if (host !== CANONICAL_HOST || isRedirectedHost(host)) {
        return `MINIAPP_URL ведёт на «${host}», а мини-апп живёт на ${CANONICAL_HOST}`;
      }
      return url.pathname.startsWith('/app/')
        ? null
        : `MINIAPP_URL без пути /app/ (получено «${url.pathname}») — кнопки бота откроют сайт, а не мини-апп`;
    },
  },
];
