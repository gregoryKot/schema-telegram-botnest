// Покрывает getNotes/createNote/deleteNote (заметки терапевта о сессиях)
// TherapyNotesService — до этого теста покрыт был только
// saveConceptualization (см. therapy-notes.service.spec.ts). Read-after-write
// на createNote → getNotes (правило CLAUDE.md про связку сохранение→показ) +
// граница доступа: чужой терапевт не читает/не пишет заметки о чужом клиенте.
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

function makeService(rels: Rel[]) {
  const notes: any[] = [];
  let nextId = 1;
  const prisma: any = {
    ...makeRelationPrismaMock(rels),
    therapistNote: {
      findMany: jest.fn(async ({ where }: any) =>
        notes
          .filter(
            (n) =>
              n.therapistId === where.therapistId &&
              n.clientId === where.clientId,
          )
          .sort((a, b) => b.createdAt - a.createdAt),
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
    const created = await service.createNote(T1, Number(CLIENT), {
      date: '2026-01-05',
      text: 'клиент рассказал про триггер',
    });
    expect(created.text).toBe('клиент рассказал про триггер');

    const notes = await service.getNotes(T1, Number(CLIENT));
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('клиент рассказал про триггер');
    expect(notes[0].date).toBe('2026-01-05');
  });

  it('чужой терапевт не может читать заметки клиента', async () => {
    const { service } = makeService([activeRel]);
    await service.createNote(T1, Number(CLIENT), {
      date: '2026-01-05',
      text: 'секрет',
    });
    await expect(service.getNotes(T2, Number(CLIENT))).rejects.toThrow(
      'No active relation',
    );
  });

  it('чужой терапевт не может создать заметку клиенту', async () => {
    const { service, notes } = makeService([activeRel]);
    await expect(
      service.createNote(T2, Number(CLIENT), { date: '2026-01-05', text: 'x' }),
    ).rejects.toThrow('No active relation');
    expect(notes).toHaveLength(0);
  });

  it('удаление заметки скопировано по id+therapistId — чужой id не удаляет запись владельца', async () => {
    const { service, notes } = makeService([activeRel]);
    const created = await service.createNote(T1, Number(CLIENT), {
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
    await expect(service.getNotes(T1, Number(CLIENT))).resolves.toEqual([]);
  });
});
