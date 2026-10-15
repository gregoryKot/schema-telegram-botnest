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

/** 4xx, кроме 408/429, — ключ отозван или неверен, домен отправителя не
 * подтверждён: само не пройдёт. */
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
 * Резервный канал алертов на почту (RESEND_API_KEY + ADMIN_EMAIL).
 *
 * Проба идёт по результату ПОСЛЕДНЕЙ РЕАЛЬНОЙ отправки (alert-email-health.ts).
 * Живой запрос в Resend «без письма» не делаем намеренно: ключ, как правило,
 * только на отправку, и любой служебный GET отвечал бы 401 на исправном ключе;
 * записанного ответа площадки нет (правило №23), а тестовые письма тратят
 * квоту. Выключенный канал — не авария; сконфигурированный и не принимающий
 * письма — авария (правило №21).
 *
 * Границы: снимок живёт в памяти процесса. Сбой отправки на соседнем инстансе
 * эта проба не видит — его покрывает warn-лог того инстанса. Письма
 * magic-link (auth/email.service.ts) в снимок не пишут.
 */
export function emailProbe(
  env: Env = process.env,
  now: () => number = Date.now,
): Probe {
  return {
    id: 'email',
    title: 'Резервные алерты на почту',
    critical: false,
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
        'настроено (RESEND_API_KEY + ADMIN_EMAIL); писем в этом процессе ещё не отправлялось — проверяется по первой реальной отправке, тестовых писем не шлём',
    };
  }
  if (h.ok || h.status === null) {
    return {
      ok: true,
      detail: `настроено; последнее письмо принято ${ago(h.at, now)}`,
    };
  }
  const what = `Resend не принял письмо: ${describeAlertEmailFailure(h.status)}, ${ago(h.at, now)}`;
  if (isPermanent(h.status)) {
    return {
      ok: false,
      detail: `${what} — ключ отозван или неверен, либо домен отправителя не подтверждён`,
    };
  }
  if (now - h.at < TRANSIENT_WINDOW_MS) {
    return { ok: false, detail: `${what} — похоже на временный сбой` };
  }
  return { ok: true, detail: `настроено; давний временный сбой (${what})` };
}
