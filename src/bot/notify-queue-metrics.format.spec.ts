import {
  formatNotifyQueueMetrics,
  type QueueTotals,
  type SnoozeTotals,
} from './notify-queue-metrics.format';

const totals = (t: Partial<QueueTotals> = {}): QueueTotals => ({
  ticks: 0,
  sent: 0,
  pushed: 0,
  transient: 0,
  waited: 0,
  deferred: 0,
  ...t,
});

const noSnooze: SnoozeTotals = {
  snoozed: 0,
  quietShift: 0,
  delivered: 0,
  cancelled: 0,
};

describe('formatNotifyQueueMetrics', () => {
  it('пустая база — одна понятная строка, без нулей и NaN', () => {
    const out = formatNotifyQueueMetrics({
      day: totals(),
      week: totals(),
      snooze: noSnooze,
    });
    expect(out).toBe(
      '📬 <b>Напоминания из бота</b>\nЗа неделю напоминаний из очереди не было.',
    );
    expect(out).not.toMatch(/NaN|undefined|\b0\b/);
  });

  it('только отправки: доля сбоев не считается, лимита не было', () => {
    const out = formatNotifyQueueMetrics({
      day: totals({ ticks: 4, sent: 12 }),
      week: totals({ ticks: 30, sent: 90 }),
      snooze: noSnooze,
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
      snooze: noSnooze,
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
      snooze: noSnooze,
    });
    expect(out).toContain('За сутки напоминаний не было.');
    expect(out).toContain('За неделю ушло 5');
  });

  it('все упали: 100%, без деления на ноль', () => {
    const out = formatNotifyQueueMetrics({
      day: totals({ ticks: 1, transient: 4 }),
      week: totals({ ticks: 1, transient: 4 }),
      snooze: noSnooze,
    });
    expect(out).toContain('За сутки ушло 0, не ушло из-за сбоя 4 (100%).');
  });
});

// Аудит 2026-10, backend#16: рестарт стирал «⏰ Напомню через час», и заметил
// это человек. Строка «отложили N — пришло M» делает поломку видной в /stats.
describe('formatNotifyQueueMetrics — «Напомню через час»', () => {
  const busyWeek = { day: totals(), week: totals({ ticks: 3, sent: 9 }) };

  it('очередь работала, кнопкой не пользовались — словами, без нулей', () => {
    const out = formatNotifyQueueMetrics({ ...busyWeek, snooze: noSnooze });
    expect(out).toContain(
      'Кнопкой «⏰ Напомню через час» за неделю не пользовались.',
    );
  });

  it('отложили, пришло и не понадобилось — одной строкой', () => {
    const out = formatNotifyQueueMetrics({
      ...busyWeek,
      snooze: { snoozed: 5, quietShift: 2, delivered: 3, cancelled: 1 },
    });
    expect(out).toContain(
      'Кнопкой «⏰ Напомню через час» за неделю отложили 5 раз, из них 2 — к ' +
        'концу тихих часов. Пришло 3, не понадобилось 1 (дневник уже заполнен или пауза).',
    );
  });

  it('отложили, но ни одно не пришло — ноль виден: это и есть поломка', () => {
    const out = formatNotifyQueueMetrics({
      ...busyWeek,
      snooze: { snoozed: 2, quietShift: 0, delivered: 0, cancelled: 0 },
    });
    expect(out).toContain('отложили 2 раза. Пришло 0.');
    expect(out).not.toContain('тихих часов');
  });

  it('очередь молчала, а кнопкой пользовались — строка кнопки всё равно есть', () => {
    const out = formatNotifyQueueMetrics({
      day: totals(),
      week: totals(),
      snooze: { snoozed: 1, quietShift: 0, delivered: 1, cancelled: 0 },
    });
    expect(out).toContain('За неделю напоминаний из очереди не было.');
    expect(out).toContain('отложили 1 раз. Пришло 1.');
  });

  // Уведомления в приложении (src/push/): доля пушей видна в том же итоге,
  // а при нуле строки «из них» нет вовсе.
  it('ушедшие в приложение показаны долей недели, ноль не пишется', () => {
    const week = totals({ ticks: 10, sent: 40, pushed: 12 });
    const out = formatNotifyQueueMetrics({
      day: totals(),
      week,
      snooze: noSnooze,
    });
    expect(out).toContain('За неделю ушло 40 (из них в приложение 12),');
    const none = formatNotifyQueueMetrics({
      day: totals(),
      week: totals({ ticks: 10, sent: 40 }),
      snooze: noSnooze,
    });
    expect(none).not.toContain('в приложение');
  });
});
