import { PrismaService } from '../prisma/prisma.service';
import { findNotePlanWork } from './note-plan-work';

describe('findNotePlanWork', () => {
  it('отдаёт только записи пары с отмеченными пунктами плана', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 3, date: '2026-11-12', planItemIds: [7, 9] },
      { id: 2, date: '2026-11-05', planItemIds: [] },
      { id: 1, date: '2026-10-29', planItemIds: [7] },
    ]);
    const prisma = { therapistNote: { findMany } } as unknown as PrismaService;

    const result = await findNotePlanWork(prisma, 10n, -57n);

    expect(result.entries).toEqual([
      { noteId: 3, date: '2026-11-12', planItemIds: [7, 9] },
      { noteId: 1, date: '2026-10-29', planItemIds: [7] },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { therapistId: 10n, clientId: -57n } }),
    );
  });
});
