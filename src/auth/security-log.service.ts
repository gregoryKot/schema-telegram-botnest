import { Injectable, Logger, Optional } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { AlertBudget } from '../utils/alert-throttle';

// Lightweight audit channel: posts security-relevant events to the admin
// Telegram chat (with e-mail fallback), plus structured server logs. Use
// sparingly — admin will mute everything if we spam.
//
// The DM is budgeted HERE, in the delivery channel, not at each call site —
// call sites forget (see incident below). The structured `logger.log` line
// stays ALWAYS unthrottled: logs are cheap and go nowhere near a human's
// muted chat, DMs are the scarce channel that suffers from flooding.
//
// Инцидент 2026-07-29 (suspicious_initdata) научил, что шквал одинаковых DM
// = замьюченный чат = ноль алертов. Урок применили точечно (initdata-alert.ts,
// auth-failure.report.ts), но `csrf_blocked` (auth-http.util.ts) и
// `refresh_token_reuse` (auth.service.ts) слали DM БЕЗ единого троттлинга —
// регрессия домена cookie/SameSite после деплоя ломает CSRF для каждой
// авторизованной записи каждого пользователя разом, то есть DM на каждый
// запрос, админ мьютит чат, и алертинг молчит ровно во время аварии.
//
// Один слот на событие (как AlertThrottle) не годится: `merge_confirmed`,
// `role_changed`, `therapist_request_submitted` — редкие, и КАЖДЫЙ важен
// по отдельности (двое разных пользователей слили аккаунты в один час — оба
// DM обязаны дойти). Поэтому здесь AlertBudget: до ALERT_BUDGET_MAX_PER_WINDOW
// алертов ОДНОГО имени события за окно доставляются все, дальше глушатся
// счётчиком, который всплывает в следующем допущенном алерте.

export type SecurityEvent =
  | 'login_success'
  | 'login_failed'
  | 'merge_initiated'
  | 'merge_confirmed'
  | 'provider_linked'
  | 'provider_unlinked'
  | 'role_changed'
  | 'therapist_request_submitted'
  | 'therapist_request_decided'
  | 'csrf_blocked'
  | 'rate_limited'
  | 'suspicious_initdata'
  // Мини-апп открыт в мессенджере, но прислал пустую подпись — сломан клиент,
  // а не пользователь (инцидент 2026-08-08: вход не работал у всех
  // пользователей Telegram, и на сервере это было неотличимо от фонового шума
  // неавторизованных запросов).
  | 'empty_signature'
  | 'refresh_token_reuse'
  // «Это не я» при сверке кода входа, а также перебор кодов через чат бота.
  // Намеренно НЕ в ALERT_EVENTS: одиночный промах по кнопке — фоновый шум, а
  // шквал одинаковых DM = замьюченный чат = ноль алертов (урок 2026-07-29).
  // Картину даёт не отдельное событие, а счётчик в /stats.
  | 'login_ticket_denied';

// Events we DM the admin about. Verbose events (success login etc) only
// go to server logs.
const ALERT_EVENTS = new Set<SecurityEvent>([
  'merge_confirmed',
  'role_changed',
  'therapist_request_submitted',
  'csrf_blocked',
  'suspicious_initdata',
  'empty_signature',
  'refresh_token_reuse',
]);

/** Сколько DM одного и того же события пропускаем за окно, прежде чем
 *  начать глушить счётчиком. Редкие события (merge_confirmed и т.п.) сюда
 *  никогда не упираются — потолок бьёт только по шквалу. */
const ALERT_BUDGET_MAX_PER_WINDOW = 3;
/** Ширина окна бюджета — 15 минут (см. заголовок файла). */
const ALERT_BUDGET_WINDOW_MS = 15 * 60_000;

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger('SecurityAudit');
  private readonly budget = new AlertBudget(
    ALERT_BUDGET_WINDOW_MS,
    ALERT_BUDGET_MAX_PER_WINDOW,
  );

  // Инжектируемые часы — по образцу auth-failure.report.ts: тесты бюджета
  // обязаны быть детерминированными, без реальных таймеров. @Optional(),
  // потому что Nest не знает провайдера для типа `() => number` — без него
  // DI бросил бы UnknownDependenciesException при сборке модуля.
  constructor(@Optional() private readonly now: () => number = Date.now) {}

  log(event: SecurityEvent, data: Record<string, unknown>): void {
    const line = `[${event}] ${JSON.stringify(this.redact(data))}`;
    // Структурный лог — ВСЕГДА без троттлинга: логи дёшевы, а бюджет ниже
    // защищает только скудный канал (DM админу).
    this.logger.log(line);
    if (ALERT_EVENTS.has(event)) {
      const { allow, suppressed } = this.budget.take(event, this.now());
      // Недоставленный DM обязан быть виден хоть где-то: структурный лог
      // выше не говорит, дошло ли предупреждение до админа — тишина здесь
      // и есть урок инцидента 2026-08-08 (обработанная авария невидимее
      // необработанной). Рекурсии в admin-alert.ts не создаём: logger.warn
      // не уходит в DM/e-mail, в отличие от AlertLogger.
      if (allow)
        this.alertAdmin(event, data, suppressed).catch((err) =>
          this.logger.warn(
            `не удалось отправить DM админу про ${event}: ${(err as Error)?.message}`,
          ),
        );
    }
  }

  // Strip obvious secrets before logging.
  private redact(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('token') ||
        lower.includes('password') ||
        lower.includes('secret') ||
        lower === 'initdata'
      ) {
        out[k] = '[redacted]';
      } else if (typeof v === 'bigint') {
        out[k] = v.toString();
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private async alertAdmin(
    event: SecurityEvent,
    data: Record<string, unknown>,
    suppressed: number,
  ): Promise<void> {
    const redacted = this.redact(data);
    const text =
      `🔐 ${event}\n` +
      Object.entries(redacted)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
        .join('\n') +
      // Непустой счётчик — значит, бюджет предыдущего окна упирался в
      // потолок; сообщаем, сколько таких же DM проглотили молча.
      (suppressed > 0 ? `\n\nещё ${suppressed} за окно` : '');
    // Telegram first, e-mail fallback so security events are never lost.
    await notifyAdminWithFallback(text, `🔐 Security: ${event}`);
  }
}
