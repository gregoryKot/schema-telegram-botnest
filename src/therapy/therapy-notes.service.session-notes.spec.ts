// Покрывает getNotes/createNote/deleteNote (заметки терапевта о сессиях)
// TherapyNotesService — до этого теста покрыт был только
// saveConceptualization (см. therapy-notes.service.spec.ts). Read-after-write
// на createNote → getNotes (правило CLAUDE.md про связку сохранение→показ) +
// граница доступа: чужой терапевт не читает/не пишет заметки о чужом клиенте.
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { SESSION_NOTES_PAGE } from './session-notes-page';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

function makeService(rels: Rel[]) {
  const notes: any[] = [];
  let nextId = 1;
  const prisma: any = {
    ...makeRelationPrismaMock(rels),
    therapistNote: {
      // Мок честно исполняет orderBy (массив) и take: без этого «101 заметка →
      // 100» и «какую отрезало» проверяли бы мок, а не запрос сервиса.
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        const cmp = (a: any, b: any) => {
          for (const o of orderBy as Record<string, 'asc' | 'desc'>[]) {
            const [k, dir] = Object.entries(o)[0];
            const x = a[k] instanceof Date ? a[k].getTime() : a[k];
            const y = b[k] instanceof Date ? b[k].getTime() : b[k];
            if (x !== y) return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
          }
          return 0;
        };
        return notes
          .filter(
            (n) =>
              n.therapistId === where.therapistId &&
              n.clientId === where.clientId,
          )
          .sort(cmp)
          .slice(0, take);
      }),
      count: jest.fn(
        async ({ where }: any) =>
          notes.filter(
            (n) =>
              n.therapistId === where.therapistId &&
              n.clientId === where.clientId,
          ).length,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        notes.push(row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = notes.length;
        for (let i = notes.length - 1; i >= 0; i--) {
          if (
            notes[i].id === where.id &&
            notes[i].therapistId === where.therapistId
          ) {
            notes.splice(i, 1);
          }
        }
        return { count: before - notes.length };
      }),
    },
  };
  const relationsService = new TherapyRelationsService(prisma, {} as any);
  const service = new TherapyNotesService(prisma, relationsService);
  return { service, prisma, notes };
}

const T1 = 100n; // терапевт-владелец
const T2 = 200n; // чужой терапевт
const CLIENT = 555n;

const activeRel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};

describe('TherapyNotesService — заметки о сессиях (session notes)', () => {
  it('сохранённая заметка читается назад с исходным текстом (createNote → getNotes)', async () => {
    const { service } = makeService([activeRel]);
    const created = await service.createNote(T1, CLIENT, {
      date: '2026-01-05',
      text: 'клиент рассказал про триггер',
    });
    expect(created.text).toBe('клиент рассказал про триггер');

    const { notes, total } = await service.getNotes(T1, CLIENT);
    expect(total).toBe(1);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('клиент рассказал про триггер');
    expect(notes[0].date).toBe('2026-01-05');
  });

  it('чужой терапевт не может читать заметки клиента', async () => {
    const { service } = makeService([activeRel]);
    await service.createNote(T1, CLIENT, {
      date: '2026-01-05',
      text: 'секрет',
    });
    await expect(service.getNotes(T2, CLIENT)).rejects.toThrow(
      'No active relation',
    );
  });

  it('чужой терапевт не может создать заметку клиенту', async () => {
    const { service, notes } = makeService([activeRel]);
    await expect(
      service.createNote(T2, CLIENT, { date: '2026-01-05', text: 'x' }),
    ).rejects.toThrow('No active relation');
    expect(notes).toHaveLength(0);
  });

  it('удаление заметки скопировано по id+therapistId — чужой id не удаляет запись владельца', async () => {
    const { service, notes } = makeService([activeRel]);
    const created = await service.createNote(T1, CLIENT, {
      date: '2026-01-05',
      text: 'заметка',
    });

    // T2 пытается удалить заметку T1 своим therapistId — where не совпадает, запись жива.
    await service.deleteNote(T2, created.id);
    expect(notes).toHaveLength(1);

    await service.deleteNote(T1, created.id);
    expect(notes).toHaveLength(0);
  });

  it('getNotes на пустой истории — пустой массив, без падения', async () => {
    const { service } = makeService([activeRel]);
    await expect(service.getNotes(T1, CLIENT)).resolves.toEqual({
      notes: [],
      total: 0,
    });
  });

  // Находка аудита 2026-10: take: 100 без признака «есть ещё» — при 105
  // заметках пять терялись из кабинета без следа, а «Сессия N» считалась от
  // среза. Срез обязан быть заметен (total) и резать с того конца, откуда
  // нумерация фронта (date, createdAt, id по возрастанию) не сдвигается.
  describe('срез в SESSION_NOTES_PAGE', () => {
    const seed = (notes: any[], count: number, extra: any[] = []) => {
      for (let i = 0; i < count; i++) {
        notes.push({
          id: i + 1,
          therapistId: T1,
          clientId: CLIENT,
          date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}`,
          text: `n${i}`,
          createdAt: new Date(Date.UTC(2026, 1, 1, 0, i)),
        });
      }
      notes.push(...extra);
    };

    it('101 заметка → 100 в ответе, total 101 (признак «есть ещё»)', async () => {
      const { service, notes } = makeService([activeRel]);
      seed(notes, 101);
      const res = await service.getNotes(T1, CLIENT);
      expect(res.notes).toHaveLength(SESSION_NOTES_PAGE);
      expect(res.total).toBe(101);
    });

    it('ровно 100 заметок → total равен длине среза', async () => {
      const { service, notes } = makeService([activeRel]);
      seed(notes, 100);
      const res = await service.getNotes(T1, CLIENT);
      expect(res.notes).toHaveLength(100);
      expect(res.total).toBe(100);
    });

    it('отрезается самая ранняя ПО ДАТЕ, даже если создана последней', async () => {
      const { service, notes } = makeService([activeRel]);
      // 100 свежих заметок + одна старая сессия, внесённая задним числом позже всех.
      seed(notes, 100, [
        {
          id: 999,
          therapistId: T1,
          clientId: CLIENT,
          date: '2025-12-01',
          text: 'старая сессия',
          createdAt: new Date(Date.UTC(2026, 5, 1)),
        },
      ]);
      const res = await service.getNotes(T1, CLIENT);
      expect(res.total).toBe(101);
      expect(res.notes.map((n) => n.id)).not.toContain(999);
      expect(res.notes).toHaveLength(100);
      // по createdAt desc старая сессия пережила бы срез и вытеснила бы свежую
    });

    it('порядок среза — date, createdAt, id по убыванию (обратен нумерации фронта)', async () => {
      const { service, prisma } = makeService([activeRel]);
      await service.getNotes(T1, CLIENT);
      expect(prisma.therapistNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: SESSION_NOTES_PAGE,
        }),
      );
    });

    it('чужие заметки не попадают ни в срез, ни в total', async () => {
      const { service, notes } = makeService([activeRel]);
      seed(notes, 3, [
        {
          id: 500,
          therapistId: T2,
          clientId: CLIENT,
          date: '2026-03-01',
          text: 'чужая',
          createdAt: new Date(),
        },
      ]);
      const res = await service.getNotes(T1, CLIENT);
      expect(res.total).toBe(3);
      expect(res.notes.map((n) => n.id)).not.toContain(500);
    });
  });
});
