import {
  buildCapabilityReport,
  isAlertChannelDead,
} from '../capability-report';
import { Probe } from './types';

type Env = Record<string, string | undefined>;

/** Резервный канал алертов на почту сконфигурирован (RESEND_API_KEY +
 * ADMIN_EMAIL) — только конфиг, живой запрос в Resend не делаем (квота).
 * Выключенный резервный канал — не авария сам по себе, авария — когда мёртвы
 * ОБА (см. alertsProbe ниже). */
export function emailProbe(env: Env = process.env): Probe {
  return {
    id: 'email',
    title: 'Резервные алерты на почту',
    critical: false,
    run() {
      const cap = buildCapabilityReport(env).find((c) => c.id === 'alertEmail');
      const on = cap?.on ?? false;
      return Promise.resolve({
        ok: true,
        detail: on
          ? 'настроено (RESEND_API_KEY + ADMIN_EMAIL)'
          : 'не настроено — это резервный канал, основной может работать без него',
      });
    },
  };
}

/** Сигнализация владельцу не мертва целиком (ни Telegram, ни почта). */
export function alertsProbe(env: Env = process.env): Probe {
  return {
    id: 'alerts',
    title: 'Сигнализация владельцу',
    critical: true,
    run() {
      const dead = isAlertChannelDead(buildCapabilityReport(env));
      return Promise.resolve({
        ok: !dead,
        detail: dead
          ? 'ни Telegram, ни почта не настроены — алерты никуда не уходят'
          : 'хотя бы один канал настроен',
      });
    },
  };
}

/** Адрес возврата OAuth ведёт на канонический хост (иначе вход зацикливается
 * — инцидент 2026-09-16, src/auth/oauth-redirect-config.ts). */
export function oauthRedirectsProbe(env: Env = process.env): Probe {
  return {
    id: 'oauthRedirects',
    title: 'Адрес возврата OAuth',
    critical: false,
    run() {
      const cap = buildCapabilityReport(env).find(
        (c) => c.id === 'oauthRedirectSane',
      );
      const ok = cap?.on ?? true;
      return Promise.resolve({
        ok,
        detail: ok
          ? 'ведёт на канонический хост'
          : (cap?.offReason ?? 'мисконфиг'),
      });
    },
  };
}
