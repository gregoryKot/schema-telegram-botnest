// Строка «подтверждённых где ещё не готовы ссылка или календарь» в блоке «Деньги» (правило №8):
// форматтер, включая пустое состояние, и запрос count.
import {
  countConfirmedWithoutLink,
  formatWithoutLink,
  renderMoneyBlock,
} from './money-metrics.without-link';
import { MoneyMetrics, MoneyWindow } from './money-metrics.format';

const emptyWindow = (): MoneyWindow => ({
  donations: { paidCount: 0, paidSum: 0, pendingCount: 0 },
  subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
  paidSessions: 0,
  pendingSessions: 0,
});
const paid: MoneyWindow = { ...emptyWindow(), paidSessions: 2 };
const prismaWith = (n: number) =>
  ({ booking: { count: jest.fn(async () => n) } }) as never;

describe('formatWithoutLink', () => {
  it('пустая база и ничего не застряло: строки нет вовсе', () => {
    expect(formatWithoutLink(0, true)).toEqual([]);
  });

  it('деньги есть, застрявших нет: «нет», а не «0»', () => {
    const out = formatWithoutLink(0, false).join('\n');
    expect(out).toBe(
      'Подтверждённых записей, где ещё не готовы ссылка или календарь: нет.',
    );
  });

  it('есть застрявшие: число и что делать, простым языком', () => {
    const out = formatWithoutLink(3, false).join('\n');
    expect(out).toContain(
      '⚠️ Подтверждённых записей, где ещё не готовы ссылка или календарь: 3',
    );
    expect(out).toContain('каждые 5 минут');
    expect(out).toContain(
      'клиенту нужно отправить ссылку вручную, а календарь проверить',
    );
    expect(out).not.toContain('в админке'); // кнопки «доделать» там нет
    expect(out).not.toMatch(/meetingUrl|CONFIRMED|cron|крон|NaN|undefined/i);
  });

  it('никто не платил, но бесплатная запись зависла: строка всё равно видна', () => {
    expect(formatWithoutLink(1, true).join('\n')).toContain(
      'где ещё не готовы ссылка или календарь: 1',
    );
  });
});

describe('countConfirmedWithoutLink', () => {
  it('считает CONFIRMED с пустым флагом доделанности и началом впереди, без сырого SQL', async () => {
    const prisma = prismaWith(2);
    await expect(countConfirmedWithoutLink(prisma)).resolves.toBe(2);
    expect(
      (prisma as unknown as { booking: { count: jest.Mock } }).booking.count,
    ).toHaveBeenCalledWith({
      where: {
        status: 'CONFIRMED',
        confirmEffectsDoneAt: null,
        startsAt: { gt: expect.any(Date) },
      },
    });
  });
});

describe('renderMoneyBlock', () => {
  const metrics = (w: MoneyWindow): MoneyMetrics => ({ week: w, allTime: w });

  it('пустая база: ровно прежний текст отчёта, без строки про ссылки и без «0»', async () => {
    const out = await renderMoneyBlock(prismaWith(0), metrics(emptyWindow()));
    expect(out).toBe('💰 <b>Деньги</b>\nПока никто не платил.');
  });

  it('деньги есть, застрявших нет: отчёт плюс «нет» отдельным абзацем', async () => {
    const out = await renderMoneyBlock(prismaWith(0), metrics(paid));
    expect(out).toContain('Оплатили сессию: 2 раза');
    expect(out).toMatch(
      /\n\nПодтверждённых записей, где ещё не готовы ссылка или календарь: нет\.$/,
    );
  });

  it('застряло: предупреждение с числом в конце блока', async () => {
    const out = await renderMoneyBlock(prismaWith(4), metrics(paid));
    expect(out).toMatch(
      /\n\n⚠️ Подтверждённых записей, где ещё не готовы ссылка или календарь: 4\n/,
    );
  });
});
