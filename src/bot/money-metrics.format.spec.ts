// Форматтер блока «Деньги» для /stats. Пустое состояние проверяем обязательно
// (правило №8): на чистой БД отчёт не должен показывать «0/NaN/мусор» — он
// обязан сказать человеческую фразу.
import { formatMoneyMetrics, MoneyWindow } from './money-metrics.format';

const emptyWindow = (): MoneyWindow => ({
  donations: { paidCount: 0, paidSum: 0, pendingCount: 0 },
  subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
  paidSessions: 0,
  pendingSessions: 0,
});

describe('пустая база', () => {
  it('говорит словами, что никто не платил, без цифр и NaN', () => {
    const out = formatMoneyMetrics({
      week: emptyWindow(),
      allTime: emptyWindow(),
    });

    expect(out).toContain('Пока никто не платил.');
    expect(out).not.toMatch(/\b0\b/);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('undefined');
  });
});

describe('обычный отчёт', () => {
  it('показывает донаты, подписку, сессии и то, что висит неоплаченным — за 7 дней и за всё время', () => {
    const week: MoneyWindow = {
      donations: { paidCount: 3, paidSum: 1500, pendingCount: 1 },
      subscriptions: { paidCount: 2, paidSum: 600, pendingCount: 0 },
      paidSessions: 1,
      pendingSessions: 1,
    };
    const allTime: MoneyWindow = {
      donations: { paidCount: 40, paidSum: 20000, pendingCount: 2 },
      subscriptions: { paidCount: 15, paidSum: 4500, pendingCount: 1 },
      paidSessions: 12,
      pendingSessions: 0,
    };
    const out = formatMoneyMetrics({ week, allTime });

    expect(out).toContain('За 7 дней:');
    expect(out).toContain('Поддержали проект: 3 раза на 1500 ₽');
    expect(out).toContain('Оплатили подписку: 2 раза на 600 ₽');
    expect(out).toContain('Оплатили сессию: 1 раз');
    // 1 (донат) + 0 (подписка) + 1 (сессия) = 2
    expect(out).toContain('Висит неоплаченным: 2');

    expect(out).toContain('За всё время:');
    expect(out).toContain('Поддержали проект: 40 раз на 20000 ₽');
    expect(out).toContain('Оплатили подписку: 15 раз на 4500 ₽');
    expect(out).toContain('Оплатили сессию: 12 раз');
    // 2 (донат) + 1 (подписка) + 0 (сессии) = 3
    expect(out).toContain('Висит неоплаченным: 3');
  });

  it('за неделю ничего не было, а за всё время есть — неделя говорит об этом словами', () => {
    const out = formatMoneyMetrics({
      week: emptyWindow(),
      allTime: {
        donations: { paidCount: 5, paidSum: 2500, pendingCount: 0 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
    });

    expect(out).toContain('За 7 дней:\nНикто не платил.');
    expect(out).toContain('Поддержали проект: 5 раз на 2500 ₽');
  });

  it('пропущенные источники не оставляют пустых строк или «0 раз»', () => {
    const out = formatMoneyMetrics({
      week: {
        donations: { paidCount: 3, paidSum: 1500, pendingCount: 0 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
      allTime: {
        donations: { paidCount: 3, paidSum: 1500, pendingCount: 0 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
    });

    expect(out).not.toContain('Оплатили подписку');
    expect(out).not.toContain('Оплатили сессию');
    expect(out).not.toContain('Висит неоплаченным');
  });

  it('язык простой: без англицизмов и служебных имён таблиц/полей', () => {
    const out = formatMoneyMetrics({
      week: {
        donations: { paidCount: 3, paidSum: 1500, pendingCount: 1 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
      allTime: {
        donations: { paidCount: 3, paidSum: 1500, pendingCount: 1 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
    });

    expect(out).not.toMatch(
      /donation|subscription|booking|PaymentStatus|amount|paidCount/i,
    );
  });
});
