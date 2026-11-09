// Вход через Telegram на сайте глазами oauth.telegram.org (инцидент
// 2026-08-21: привязка домена к боту в BotFather слетела, страница входа
// отвечала «Bot domain invalid», и узнали об этом от пользователя).
//
// Сторожок TelegramDomainWatchdogService (src/auth/telegram-domain-watchdog.service.ts)
// шлёт DM по переходу состояния, но держит `broken` в памяти своего процесса:
// ни в /health, ни в /stats его не было — пропустил DM, и смотреть некуда.
// Читать его состояние отсюда нельзя: сторожок и самопроверка берут аренду
// независимо и на двух инстансах попадают в разные процессы. Поэтому проба
// делает ту же проверку сама — тот же URL (telegramOauthLoginUrl, его же
// открывает боевой редирект) и те же маркеры поломки (сверка со сторожком —
// probe-telegram-domain.spec.ts). Отличие от сторожка: HTTP-ошибка и сбой
// сети здесь — красная проба (правило №21), вспышку связи гасит retryOnce.
// Наружу в /health не идёт, как вход Google/VK: связь Amvera с зарубежными
// хостами нестабильна, а красный /health держал бы смок прода.
import { telegramOauthLoginUrl } from '../../auth/telegram-oauth-url';
import { Probe, ProbeResult } from './types';

const TIMEOUT_MS = 8_000;
/** Тексты oauth.telegram.org, когда домен не привязан к боту или бота нет. */
export const DOMAIN_BROKEN_MARKERS = ['Bot domain invalid', 'Bot not found'];

type Env = Record<string, string | undefined>;

/** Вердикт по ответу страницы входа. Чистая функция. */
export function judgeTelegramDomain(
  status: number,
  body: string,
  frontendBase: string,
): ProbeResult {
  const marker = DOMAIN_BROKEN_MARKERS.find((m) => body.includes(m));
  if (marker) {
    return {
      ok: false,
      detail:
        `oauth.telegram.org отвечает «${marker}» для ${frontendBase}: домен ` +
        'отвязался от бота. Починить: @BotFather → /setdomain → бот → домен сайта',
    };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      detail: `oauth.telegram.org ответил HTTP ${status} на страницу входа`,
    };
  }
  return {
    ok: true,
    detail: `oauth.telegram.org отдаёт страницу входа для ${frontendBase}`,
  };
}

export function telegramDomainProbe(env: Env = process.env): Probe {
  return {
    id: 'telegramDomain',
    title: 'Вход через Telegram на сайте',
    reportInHealth: false,
    retryOnce: true, // живой запрос к oauth.telegram.org (Probe.retryOnce)
    async run() {
      const botToken = env.BOT_TOKEN?.trim();
      const webappUrl = env.WEBAPP_URL?.trim();
      if (!botToken || !webappUrl) return { ok: true, detail: 'выключено' };
      const frontendBase = webappUrl.replace(/\/$/, '');
      const url = telegramOauthLoginUrl(botToken.split(':')[0], frontendBase);
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return judgeTelegramDomain(res.status, await res.text(), frontendBase);
      } catch (e) {
        return {
          ok: false,
          detail: `oauth.telegram.org не ответил: ${(e as Error)?.message?.slice(0, 200) ?? 'ошибка'}`,
        };
      }
    },
  };
}
