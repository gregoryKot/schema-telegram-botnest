import { buildCapabilityReport } from '../capability-report';
import {
  AlertEmailFailure,
  describeAlertEmailFailure,
  getAlertEmailHealth,
} from '../../utils/alert-email-health';
import { ago } from './format';
import { Probe, ProbeResult } from './types';

type Env = Record<string, string | undefined>;

/** Временный сбой (429, 5xx, сеть, таймаут) держит пробу красной в этом окне, дальше
 * считается давним: почта шлётся только при отказе Telegram, следующей отправки,
 * которая бы его «вылечила», может не быть днями. */
export const TRANSIENT_WINDOW_MS = 6 * 3_600_000;

/** 4xx, кроме 408/429: ключ отклонён (403) либо письмо не принято (400) — само не
 * пройдёт. Суточная квота приходит как 'quota' и сбрасывается сама. */
function isPermanent(status: AlertEmailFailure): boolean {
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

/**
 * Резервный канал алертов на почту (ключи Postbox + ADMIN_EMAIL).
 *
 * Проба идёт по результату ПОСЛЕДНЕЙ РЕАЛЬНОЙ отправки (alert-email-health.ts)
 * и видит то, чего не видит живая проба ключа (probe-postbox.ts): отказ самого
 * письма — домен отправителя не подтверждён, отправка на паузе, исчерпана
 * суточная квота. Тестовых писем не шлём: они эту квоту и тратят.
 * Выключенный канал — не авария; настроенный и не принимающий — авария (№21).
 *
 * Снимок в памяти процесса: сбой на соседнем инстансе виден только его warn-логом.
 * Письма входа (auth/email.service.ts) пишут в тот же снимок — ключи общие.
 */
export function emailProbe(
  env: Env = process.env,
  now: () => number = Date.now,
): Probe {
  return {
    id: 'email',
    title: 'Резервные алерты на почту',
    run() {
      const cap = buildCapabilityReport(env).find((c) => c.id === 'alertEmail');
      if (!cap?.on) {
        return Promise.resolve({
          ok: true,
          detail:
            'не настроено — это резервный канал, основной может работать без него',
        });
      }
      return Promise.resolve(configuredResult(now()));
    },
  };
}

function configuredResult(now: number): ProbeResult {
  const h = getAlertEmailHealth();
  if (h.at === null) {
    return {
      ok: true,
      detail:
        'настроено (ключи Postbox + ADMIN_EMAIL); писем в этом процессе ещё не отправлялось — проверяется по первой реальной отправке, тестовых писем не шлём',
    };
  }
  if (h.ok || h.status === null) {
    return {
      ok: true,
      detail: `настроено; последнее письмо принято ${ago(h.at, now)}`,
    };
  }
  const what = `Postbox не принял письмо: ${describeAlertEmailFailure(h.status)}, ${ago(h.at, now)}`;
  if (isPermanent(h.status)) {
    return {
      ok: false,
      detail: `${what} — ключ отклонён (403) либо письмо не принято: домен отправителя не подтверждён или отправка на паузе (400)`,
    };
  }
  if (now - h.at < TRANSIENT_WINDOW_MS) {
    const why =
      h.status === 'quota'
        ? 'квота сбросится сама; если повторяется — поднять лимит в кабинете Postbox'
        : 'похоже на временный сбой';
    return { ok: false, detail: `${what} — ${why}` };
  }
  return { ok: true, detail: `настроено; давний временный сбой (${what})` };
}
