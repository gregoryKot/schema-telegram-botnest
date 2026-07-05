import { BotService } from './bot.service';

// Регрессия на инцидент «карточка сохранилась, но её не найти»:
// упражнение «Карточка схемы/режима» писало UserSchemaNote, но не добавляло
// схему в mySchemaIds, а архив «Мои записи» фильтрует карточки по коллекции —
// заметка была в БД, но невидима. upsertSchemaNote/upsertModeNote теперь
// обязаны поддерживать инвариант «заполнил карточку ⇒ она в коллекции».
//
// Тест — read-after-write через in-memory-подделку Prisma (две задействованные
// таблицы), чтобы ловить именно связку сохранение→отображение, а не только запись.

function makeDb(user: { mySchemaIds: string[]; myModeIds: string[] }) {
  const schemaNotes: any[] = [];
  const modeNotes: any[] = [];

  const upsert = (store: any[], keyField: string) =>
    jest.fn(async ({ where, create, update }: any) => {
      const key = where[Object.keys(where)[0]];
      const existing = store.find(r => r.userId === key.userId && r[keyField] === key[keyField]);
      if (existing) { Object.assign(existing, update); return existing; }
      const row = { id: store.length + 1, ...create };
      store.push(row);
      return row;
    });

  return {
    userSchemaNote: {
      upsert: upsert(schemaNotes, 'schemaId'),
      findMany: jest.fn(async ({ where }: any) => schemaNotes.filter(r => r.userId === where.userId)),
    },
    userModeNote: {
      upsert: upsert(modeNotes, 'modeId'),
      findMany: jest.fn(async ({ where }: any) => modeNotes.filter(r => r.userId === where.userId)),
    },
    user: {
      // getUserSettings/addToMyList both go through findUnique+select
      findUnique: jest.fn(async () => ({ ...user })),
      update: jest.fn(async ({ data }: any) => { Object.assign(user, data); return user; }),
    },
    _user: user,
  } as any;
}

describe('BotService — карточка схемы/режима попадает в коллекцию', () => {
  it('сохранённая карточка схемы находится в архиве (schemaId в mySchemaIds)', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new BotService(db);

    await svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'я плохой' });

    // 1) заметка реально сохранена и читается назад
    const notes = await svc.getSchemaNotes(1n);
    expect(notes.map((n: any) => n.schemaId)).toContain('defectiveness');

    // 2) схема добавлена в коллекцию — иначе архив «Мои записи» её отфильтрует
    const settings = await svc.getUserSettings(1n);
    expect((settings as any).mySchemaIds).toContain('defectiveness');
  });

  it('повторное сохранение той же схемы не дублирует id в коллекции', async () => {
    const db = makeDb({ mySchemaIds: ['defectiveness'], myModeIds: [] });
    const svc = new BotService(db);

    await svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'обновил' });

    expect(db.user.update).not.toHaveBeenCalled();
    expect(db._user.mySchemaIds).toEqual(['defectiveness']);
  });

  it('сохранённая карточка режима попадает в myModeIds', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new BotService(db);

    await svc.upsertModeNote(1n, 'vulnerable_child', { feelings: 'страшно' });

    const settings = await svc.getUserSettings(1n);
    expect((settings as any).myModeIds).toContain('vulnerable_child');
  });
});
