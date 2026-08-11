// Блок «Деньги» для /stats (правило №8: событие/сумма, которой нет в отчёте, —
// невидимо). Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Зачем блок вообще есть: до него донаты, подписка и платные сессии нигде не
// считались в отчёте — тихий сбой Robokassa (например, разъехалась подпись
// после ротации пароля) выглядел бы как «никто просто не платит», без
// единого сигнала. «Висит неоплаченным» — тот же принцип, что и блок
// «Вход в мессенджере»: живая очередь застрявших платежей видна сразу, а не
// после жалобы человека.
//
// Язык простой: «поддержали проект», а не «donations: count=3 sum=1500».

export interface MoneySourceStats {
  /** Сколько раз реально заплатили. */
  paidCount: number;
  /** На какую сумму заплатили, рубли. */
  paidSum: number;
  /** Сколько платежей начали и не довели до оплаты (висят). */
  pendingCount: number;
}

export interface MoneyWindow {
  donations: MoneySourceStats;
  subscriptions: MoneySourceStats;
  /** Платных сессий подтверждено (сумму по ним отдельно не храним). */
  paidSessions: number;
  /** Платных сессий забронировано, но оплата ещё не пришла. */
  pendingSessions: number;
}

export interface MoneyMetrics {
  /** За последние 7 дней. */
  week: MoneyWindow;
  /** За всё время. */
  allTime: MoneyWindow;
}

const plural = (n: number, one: string, few: string, many: string): string =>
  n % 10 === 1 && n % 100 !== 11
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? few
      : many;

const times = (n: number): string => `${n} ${plural(n, 'раз', 'раза', 'раз')}`;

function windowIsEmpty(w: MoneyWindow): boolean {
  return (
    w.donations.paidCount === 0 &&
    w.donations.pendingCount === 0 &&
    w.subscriptions.paidCount === 0 &&
    w.subscriptions.pendingCount === 0 &&
    w.paidSessions === 0 &&
    w.pendingSessions === 0
  );
}

function renderWindow(w: MoneyWindow): string[] {
  const lines: string[] = [];
  if (w.donations.paidCount > 0) {
    lines.push(
      `Поддержали проект: ${times(w.donations.paidCount)} на ${w.donations.paidSum} ₽`,
    );
  }
  if (w.subscriptions.paidCount > 0) {
    lines.push(
      `Оплатили подписку: ${times(w.subscriptions.paidCount)} на ${w.subscriptions.paidSum} ₽`,
    );
  }
  if (w.paidSessions > 0) {
    lines.push(`Оплатили сессию: ${times(w.paidSessions)}`);
  }
  const pending =
    w.donations.pendingCount + w.subscriptions.pendingCount + w.pendingSessions;
  if (pending > 0) {
    lines.push(`Висит неоплаченным: ${pending}`);
  }
  if (lines.length === 0) {
    lines.push('Никто не платил.');
  }
  return lines;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatMoneyMetrics(m: MoneyMetrics): string {
  const lines = ['💰 <b>Деньги</b>'];
  if (windowIsEmpty(m.allTime)) {
    lines.push('Пока никто не платил.');
    return lines.join('\n');
  }
  lines.push('', 'За 7 дней:', ...renderWindow(m.week));
  lines.push('', 'За всё время:', ...renderWindow(m.allTime));
  return lines.join('\n');
}
