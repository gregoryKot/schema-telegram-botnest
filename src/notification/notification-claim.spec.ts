// Захват строки очереди: условие окна считается от переданного «сейчас», а
// ответ — «строка наша» только при одной обновлённой строке. Атомарность на
// живом Postgres — test/notification-claim.e2e-spec.ts.
import { CLAIM_WINDOW_MS, claimForSend } from './notification-claim';

function db(updated: number) {
  const $executeRaw = jest.fn().mockResolvedValue(updated);
  return { prisma: { $executeRaw } as never, $executeRaw };
}

describe('claimForSend', () => {
  const now = new Date('2026-11-15T12:00:00Z');

  it('одна обновлённая строка — наша; ноль — взята другим прогоном', async () => {
    expect(await claimForSend(db(1).prisma, 5, now)).toBe(true);
    expect(await claimForSend(db(0).prisma, 5, now)).toBe(false);
  });

  it('в UPDATE уходят id, «сейчас» и граница окна now − окно', async () => {
    const { prisma, $executeRaw } = db(1);
    await claimForSend(prisma, 42, now);
    const values = $executeRaw.mock.calls[0].slice(1);
    expect(values).toEqual([
      now,
      42,
      new Date(now.getTime() - CLAIM_WINDOW_MS),
    ]);
  });
});
