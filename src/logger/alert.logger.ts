import { ConsoleLogger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { AlertGate } from './alert-gate';
import { isDbUnreachable, dbOutage, DB_ALERT_SUBJECT } from './db-outage';

export class AlertLogger extends ConsoleLogger {
  // Троттлинг DM: пер-контентный ключ, общий бюджет и анонимный подбюджет —
  // слои и их история в ./alert-gate.ts.
  private readonly gate = new AlertGate();

  error(message: unknown, ...optionalParams: unknown[]) {
    super.error(message, ...optionalParams);
    // Контекст — последний строковый аргумент: так его передаёт
    // `new Logger(X.name).error(…)`. Без него — собственный контекст логгера.
    const last = optionalParams[optionalParams.length - 1];
    this.alert(
      typeof message === 'string' ? message : JSON.stringify(message),
      typeof last === 'string' ? last : this.context,
    );
  }

  private alert(message: string, context: string | undefined) {
    // Недоступность БД (инцидент 2026-08-31) рассыпается на десятки разных по
    // тексту сообщений — по ключу их не свести, и шторм проходит мимо обоих
    // троттлов ниже. Ветка ведёт всю аварию как ОДНУ (см. ./db-outage.ts).
    if (isDbUnreachable(message)) {
      const { text } = dbOutage.note(message);
      if (text) void notifyAdminWithFallback(text, DB_ALERT_SUBJECT);
      return;
    }

    const verdict = this.gate.decide(message, context);
    if (!verdict.send) return;

    // Telegram first, e-mail fallback. Fire-and-forget — never throws.
    void notifyAdminWithFallback(
      `🚨 Ошибка на сервере\n${message.slice(0, 300)}${verdict.tail}`,
      '🚨 Ошибка на сервере SchemeHappens',
    );
  }
}
