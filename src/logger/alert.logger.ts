import { ConsoleLogger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { AlertBudget } from '../utils/alert-throttle';

export class AlertLogger extends ConsoleLogger {
  // Simple in-memory throttle: don't send same error more than once per 60s
  private readonly seen = new Map<string, number>();

  // Общий потолок поверх пер-контентного ключа (M4, аудит 2026-08). Ключ ниже
  // нормализует только цифры/uuid — сток, чей первый аргумент содержит
  // варьируемый атакующим НЕ-цифровой текст (имена query-параметров, текст
  // ошибки парсинга), рождает новый ключ на каждый запрос и обходит троттлинг
  // лавиной DM. Пер-ключевой троттлинг против этого бессилен по построению,
  // поэтому сверху — общий бюджет: не больше N алертов за окно СУММАРНО по
  // всем ключам. Реальная авария из нескольких подсистем (десяток разных
  // ошибок) проходит; лавина подделанных ключей упирается в потолок и дальше
  // копится счётчиком, который сообщает о себе в первом алерте следующего окна.
  private readonly globalBudget = new AlertBudget(60_000, 15);

  error(message: unknown, ...optionalParams: unknown[]) {
    super.error(message, ...optionalParams);
    this.alert(typeof message === 'string' ? message : JSON.stringify(message));
  }

  private alert(message: string) {
    const now = Date.now();
    // Evict entries older than 1 hour to prevent unbounded Map growth
    for (const [k, t] of this.seen)
      if (now - t > 3_600_000) this.seen.delete(k);

    // Нормализованный ключ (аудит 2026-07, I-4): числа/uuid/hex заменяются
    // плейсхолдером, иначе «Failed … id=1», «id=2», … — это разные ключи, и
    // массовый сбой обходит троттлинг лавиной DM админу.
    const key = message
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
      .replace(/\d+/g, '<n>')
      .slice(0, 100);
    const lastSent = this.seen.get(key) ?? 0;
    if (now - lastSent < 60_000) return;
    this.seen.set(key, now);

    // Backstop против варьируемого буквами текста (M4): пер-контентный ключ
    // уже пропустил этот алерт, но общий бюджет за окно мог исчерпаться —
    // тогда молчим (в чат уже ушло N за минуту, дальше это флуд).
    const budget = this.globalBudget.take('__all__', now);
    if (!budget.allow) return;
    const tail = budget.suppressed
      ? `\n(за прошлое окно подавлено ещё ${budget.suppressed} — общий потолок алертов)`
      : '';

    // Telegram first, e-mail fallback. Fire-and-forget — never throws.
    void notifyAdminWithFallback(
      `🚨 Ошибка на сервере\n${message.slice(0, 300)}${tail}`,
      '🚨 Ошибка на сервере SchemeHappens',
    );
  }
}
