import { ConsoleLogger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { AlertGate } from './alert-gate';
import { alertFacts, serverAlertText, type AlertFacts } from './alert-text';
import { isDbUnreachable, dbOutage, DB_ALERT_SUBJECT } from './db-outage';

export class AlertLogger extends ConsoleLogger {
  // Троттлинг DM: пер-контентный ключ, общий бюджет и анонимный подбюджет —
  // слои и их история в ./alert-gate.ts.
  private readonly gate = new AlertGate();

  error(message: unknown, ...optionalParams: unknown[]) {
    // В DM — место, тип и id без текста ошибки (РКН, #1135); полный текст —
    // в stdout с тем же id. Разбор аргументов — ./alert-text.ts.
    const facts = alertFacts(message, optionalParams, this.context);
    super.error(facts.logLine, ...optionalParams);
    this.alert(facts);
  }

  private alert(facts: AlertFacts) {
    // Недоступность БД (инцидент 2026-08-31) рассыпается на десятки разных по
    // тексту сообщений — по ключу их не свести, и шторм проходит мимо обоих
    // троттлов ниже. Ветка ведёт всю аварию как ОДНУ (см. ./db-outage.ts).
    if (isDbUnreachable(facts.text)) {
      const { text } = dbOutage.note(facts.text);
      if (text) void notifyAdminWithFallback(text, DB_ALERT_SUBJECT);
      return;
    }

    const verdict = this.gate.decide(facts.text, facts.context);
    if (!verdict.send) return;

    // Telegram first, e-mail fallback с тем же текстом. Never throws.
    void notifyAdminWithFallback(
      serverAlertText(facts) + verdict.tail,
      '🚨 Ошибка на сервере SchemeHappens',
    );
  }
}
