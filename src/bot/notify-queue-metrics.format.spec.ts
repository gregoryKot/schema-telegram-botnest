import {
  formatNotifyQueueMetrics,
  type QueueTotals,
} from './notify-queue-metrics.format';

const totals = (t: Partial<QueueTotals> = {}): QueueTotals => ({
  ticks: 0,
  sent: 0,
  transient: 0,
  waited: 0,
  deferred: 0,
  ...t,
});

describe('formatNotifyQueueMetrics', () => {
  it('пустая база — одна понятная строка, без нулей и NaN', () => {
    const out = formatNotifyQueueMetrics({ day: totals(), week: totals() });
    expect(out).toBe(
      '📬 <b>Напоминания из бота</b>\nЗа неделю напоминаний из очереди не было.',
    );
    expect(out).not.toMatch(/NaN|undefined|\b0\b/);
  });

  it('только отправки: доля сбоев не считается, лимита не было', () => {
    const out = formatNotifyQueueMetrics({
      day: totals({ ticks: 4, sent: 12 }),
      week: totals({ ticks: 30, sent: 90 }),
    });
    expect(out).toContain('За сутки ушло 12, сбоев не было.');
    expect(out).toContain('Telegram ни разу не просил подождать.');
    expect(out).toContain(
      'За неделю ушло 90, сбоев не было; Telegram просил подождать 0 раз, отложено 0.',
    );
    expect(out).not.toMatch(/NaN|%/);
  });

  it('смесь со сбоями и лимитом: доля сбоя и просьбы подождать', () => {
    const out = formatNotifyQueueMetrics({
      day: totals({
        ticks: 5,
        sent: 97,
        transient: 3,
        waited: 2,
        deferred: 40,
      }),
      week: totals({ ticks: 40, sent: 300, transient: 3, waited: 1 }),
    });
    expect(out).toContain('За сутки ушло 97, не ушло из-за сбоя 3 (3%).');
    expect(out).toContain(
      'Telegram попросил подождать: 2 раза; отложено на следующий заход: 40.',
    );
    expect(out).toContain(
      'За неделю ушло 300, не ушло из-за сбоя 3 (1%); Telegram просил подождать 1 раз, отложено 0.',
    );
  });

  it('за сутки тишина, а за неделю было — сутки отдельной строкой', () => {
    const out = formatNotifyQueueMetrics({
      day: totals(),
      week: totals({ ticks: 2, sent: 5 }),
    });
    expect(out).toContain('За сутки напоминаний не было.');
    expect(out).toContain('За неделю ушло 5');
  });

  it('все упали: 100%, без деления на ноль', () => {
    const out = formatNotifyQueueMetrics({
      day: totals({ ticks: 1, transient: 4 }),
      week: totals({ ticks: 1, transient: 4 }),
    });
    expect(out).toContain('За сутки ушло 0, не ушло из-за сбоя 4 (100%).');
  });
});
