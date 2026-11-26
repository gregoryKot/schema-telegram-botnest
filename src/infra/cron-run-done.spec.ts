// Отметка завершения прогона: форма запросов и ответ. Живая база —
// test/midnight-planner-resume.e2e-spec.ts (джоба migrations).
import { CronRunLedger } from './cron-run-done';
import type { PrismaService } from '../prisma/prisma.service';

const RUN = new Date('2026-10-22T00:00:00Z');
const H = 3_600_000;

function make(row: { runAt: Date; doneRunAt: Date | null } | null) {
  const cronLease = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findUnique: jest.fn().mockResolvedValue(row),
  };
  const ledger = new CronRunLedger({ cronLease } as unknown as PrismaService);
  return { ledger, cronLease };
}

describe('CronRunLedger', () => {
  it('finishRun помечает только прогон с тем же runAt', async () => {
    const { ledger, cronLease } = make(null);
    await ledger.finishRun('midnightPlanner', RUN);
    expect(cronLease.updateMany).toHaveBeenCalledWith({
      where: { name: 'midnightPlanner', runAt: RUN },
      data: { doneRunAt: RUN },
    });
  });

  it('unfinishedRun: строки нет — null', async () => {
    const { ledger } = make(null);
    await expect(
      ledger.unfinishedRun('midnightPlanner', 23 * H, RUN),
    ).resolves.toBeNull();
  });

  it('unfinishedRun: не завершён и внутри окна — его runAt', async () => {
    const { ledger, cronLease } = make({ runAt: RUN, doneRunAt: null });
    await expect(
      ledger.unfinishedRun('midnightPlanner', 23 * H, new Date(+RUN + H)),
    ).resolves.toEqual(RUN);
    expect(cronLease.findUnique).toHaveBeenCalledWith({
      where: { name: 'midnightPlanner' },
      select: { runAt: true, doneRunAt: true },
    });
  });

  it('unfinishedRun: завершён тем же runAt — null', async () => {
    const { ledger } = make({ runAt: RUN, doneRunAt: new Date(RUN) });
    await expect(
      ledger.unfinishedRun('midnightPlanner', 23 * H, new Date(+RUN + H)),
    ).resolves.toBeNull();
  });

  it('unfinishedRun: отметка от прошлого прогона — не завершён', async () => {
    const { ledger } = make({
      runAt: RUN,
      doneRunAt: new Date(+RUN - 24 * H),
    });
    await expect(
      ledger.unfinishedRun('midnightPlanner', 23 * H, new Date(+RUN + H)),
    ).resolves.toEqual(RUN);
  });

  it('unfinishedRun: окно истекло — null (это уже новый прогон для claimRun)', async () => {
    const { ledger } = make({ runAt: RUN, doneRunAt: null });
    await expect(
      ledger.unfinishedRun('midnightPlanner', 23 * H, new Date(+RUN + 23 * H)),
    ).resolves.toBeNull();
  });

  it('unfinishedRun без now — меряет окно от текущего времени', async () => {
    const recent = new Date(Date.now() - H);
    const { ledger } = make({ runAt: recent, doneRunAt: null });
    await expect(
      ledger.unfinishedRun('midnightPlanner', 6 * H),
    ).resolves.toEqual(recent);
    const old = make({ runAt: new Date(Date.now() - 7 * H), doneRunAt: null });
    await expect(
      old.ledger.unfinishedRun('midnightPlanner', 6 * H),
    ).resolves.toBeNull();
  });
});
