// Юнит-тесты бюджета восстановлений (refresh-recover-budget.ts).
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import {
  RECOVER_MAX_PER_WINDOW,
  RECOVER_WINDOW_MS,
  applyRecoverBudget,
  countRecentRecoveries,
} from './refresh-recover-budget';
import type { ReuseVerdict } from './refresh-rotation';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const recover: ReuseVerdict = { outcome: 'recover', logMessage: 'lost' };

describe('applyRecoverBudget', () => {
  it('меньше лимита — recover остаётся recover', () => {
    for (let n = 0; n < RECOVER_MAX_PER_WINDOW; n++) {
      expect(applyRecoverBudget(recover, n, 1n)).toBe(recover);
    }
  });

  it('лимит исчерпан → theft с причиной в логе', () => {
    const v = applyRecoverBudget(recover, RECOVER_MAX_PER_WINDOW, 5n);
    expect(v.outcome).toBe('theft');
    expect(v.logMessage).toContain('третье восстановление за сутки');
    expect(v.logMessage).toContain('5');
  });

  it.each<ReuseVerdict['outcome']>(['reject', 'theft'])(
    'исход %s счётчик не меняет',
    (outcome) => {
      const v: ReuseVerdict = { outcome, logMessage: 'x' };
      expect(applyRecoverBudget(v, 99, 1n)).toBe(v);
    },
  );
});

describe('countRecentRecoveries', () => {
  const prismaWith = (rows: Row[]) =>
    ({ webSession: createFakeTable(rows) }) as never;

  it('считает только строки этой семьи внутри окна', async () => {
    const rows: Row[] = [
      { family: 'a', recoveredAt: new Date(NOW.getTime() - 1000) },
      {
        family: 'a',
        recoveredAt: new Date(NOW.getTime() - RECOVER_WINDOW_MS + 1000),
      },
      {
        family: 'a',
        recoveredAt: new Date(NOW.getTime() - RECOVER_WINDOW_MS - 1000),
      },
      { family: 'a', recoveredAt: null },
      { family: 'b', recoveredAt: new Date(NOW.getTime() - 1000) },
    ];
    expect(await countRecentRecoveries(prismaWith(rows), 'a', NOW)).toBe(2);
  });
});
