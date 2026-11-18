import { encryptJson } from '../utils/crypto';
import { findSessionWork } from './session-work-list';

const item = {
  id: 'w1',
  kind: 'technique',
  refId: 'chairwork',
  modeIds: ['punitive_critic'],
  schemaIds: [],
  needIds: [],
  fields: { theme: 'спор с Критиком' },
};

function prismaWith(rows: unknown[]) {
  const findMany = jest.fn(async () => rows);
  return { prisma: { therapistNote: { findMany } } as never, findMany };
}

describe('findSessionWork — пункты «Что делали» по клиенту', () => {
  it('сохранённые пункты читаются из шифротекста с днём и id записи', async () => {
    const stored = encryptJson([item]) ?? JSON.stringify([item]);
    const { prisma, findMany } = prismaWith([
      { id: 7, date: '2026-11-10', work: stored },
    ]);
    const res = await findSessionWork(prisma, 1n, 2n);
    expect(res.entries).toEqual([
      { noteId: 7, date: '2026-11-10', work: [item] },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { therapistId: 1n, clientId: 2n } }),
    );
  });

  it('записи без пунктов и с битым содержимым не отдаются', async () => {
    const { prisma } = prismaWith([
      { id: 1, date: '2026-11-01', work: [] },
      { id: 2, date: '2026-11-02', work: 'не шифротекст и не JSON' },
      { id: 3, date: '2026-11-03', work: [{ id: 'x', kind: 'unknown' }] },
    ]);
    expect((await findSessionWork(prisma, 1n, 2n)).entries).toEqual([]);
  });
});
