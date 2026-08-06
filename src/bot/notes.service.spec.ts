import { NotesService } from './notes.service';
import { decryptRecord } from '../utils/crypto';

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
      const existing = store.find(
        (r) => r.userId === key.userId && r[keyField] === key[keyField],
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: store.length + 1, ...create };
      store.push(row);
      return row;
    });

  const findOne = (store: any[], keyField: string) =>
    jest.fn(async ({ where }: any) => {
      const key = where[Object.keys(where)[0]];
      return (
        store.find(
          (r) => r.userId === key.userId && r[keyField] === key[keyField],
        ) ?? null
      );
    });

  const db: any = {
    userSchemaNote: {
      upsert: upsert(schemaNotes, 'schemaId'),
      findUnique: findOne(schemaNotes, 'schemaId'),
      findMany: jest.fn(async ({ where }: any) =>
        schemaNotes.filter((r) => r.userId === where.userId),
      ),
    },
    userModeNote: {
      upsert: upsert(modeNotes, 'modeId'),
      findUnique: findOne(modeNotes, 'modeId'),
      findMany: jest.fn(async ({ where }: any) =>
        modeNotes.filter((r) => r.userId === where.userId),
      ),
    },
    user: {
      // getUserSettings/addToMyList both go through findUnique+select
      findUnique: jest.fn(async () => ({ ...user })),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(user, data);
        return user;
      }),
    },
    _user: user,
  };
  // addToMyList теперь read-modify-write в интерактивной транзакции —
  // фейк просто исполняет колбэк на самом себе.
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  return db;
}

describe('NotesService — карточка схемы/режима попадает в коллекцию', () => {
  it('сохранённая карточка схемы находится в архиве (schemaId в mySchemaIds)', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);

    await svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'я плохой' });

    // 1) заметка реально сохранена и читается назад
    const notes = await svc.getSchemaNotes(1n);
    expect(notes.map((n: any) => n.schemaId)).toContain('defectiveness');

    // 2) схема добавлена в коллекцию — иначе архив «Мои записи» её отфильтрует
    // (коллекция денормализована в User.mySchemaIds — читаем/расшифровываем
    // напрямую, как это делает bot.service.getUserSettings).
    const settings = decryptRecord(db._user, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
    expect(settings.mySchemaIds).toContain('defectiveness');
  });

  it('повторное сохранение той же схемы не дублирует id в коллекции', async () => {
    const db = makeDb({ mySchemaIds: ['defectiveness'], myModeIds: [] });
    const svc = new NotesService(db);

    await svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'обновил' });

    expect(db.user.update).not.toHaveBeenCalled();
    expect(db._user.mySchemaIds).toEqual(['defectiveness']);
  });

  it('сохранённая карточка режима попадает в myModeIds', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);

    await svc.upsertModeNote(1n, 'vulnerable_child', { feelings: 'страшно' });

    const settings = decryptRecord(db._user, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
    expect(settings.myModeIds).toContain('vulnerable_child');
  });

  // Карточка режима донабрала origins/healthyView (зеркало полей карточки
  // схемы) — read-after-write: сохранил → прочитал теми же значениями, и
  // инвариант «карточка в myModeIds» не сломался этим изменением.
  it('origins/healthyView карточки режима: сохранил → читается теми же значениями', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);

    await svc.upsertModeNote(1n, 'vulnerable_child', {
      origins: 'так реагировали в детстве',
      healthyView: 'сейчас я в безопасности',
    });

    const [note] = await svc.getModeNotes(1n);
    expect(note.origins).toBe('так реагировали в детстве');
    expect(note.healthyView).toBe('сейчас я в безопасности');

    const settings = decryptRecord(db._user, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
    expect(settings.myModeIds).toContain('vulnerable_child');
  });
});

describe('NotesService.getSchemaNote/getModeNote — единичное чтение', () => {
  it('getSchemaNote: существующая карточка расшифровывается и возвращается', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);
    await svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'я плохой' });

    const note = await svc.getSchemaNote(1n, 'defectiveness');
    expect(note).not.toBeNull();
    expect(note!.thoughts).toBe('я плохой');
  });

  it('getSchemaNote: карточки нет → null, а не выдуманные данные', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);
    await expect(svc.getSchemaNote(1n, 'abandonment')).resolves.toBeNull();
  });

  it('getModeNote: существующая карточка расшифровывается и возвращается', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);
    await svc.upsertModeNote(1n, 'vulnerable_child', { feelings: 'страшно' });

    const note = await svc.getModeNote(1n, 'vulnerable_child');
    expect(note).not.toBeNull();
    expect(note!.feelings).toBe('страшно');
  });

  it('getModeNote: карточки нет → null', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    const svc = new NotesService(db);
    await expect(svc.getModeNote(1n, 'punitive_parent')).resolves.toBeNull();
  });
});

describe('NotesService.addToMyList — денормализованная коллекция, крайние случаи', () => {
  it('пользователь не найден (гонка с удалением аккаунта) — не падает, update не вызывается', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    db.user.findUnique = jest.fn(async () => null);
    const svc = new NotesService(db);

    await expect(
      svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'x' }),
    ).resolves.toBeDefined();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('битое/отсутствующее mySchemaIds (не массив) трактуется как пустой список, id добавляется', async () => {
    const db = makeDb({ mySchemaIds: [], myModeIds: [] });
    // Симулируем legacy-строку в поле вместо json-массива: decryptRecord с
    // jsonArrays попробует JSON.parse и, если результат не массив, отдаёт как есть.
    db.user.findUnique = jest.fn(async () => ({
      mySchemaIds: JSON.stringify('не массив'),
    }));
    const svc = new NotesService(db);

    await svc.upsertSchemaNote(1n, 'defectiveness', { thoughts: 'x' });

    expect(db.user.update).toHaveBeenCalledTimes(1);
    const settings = decryptRecord(
      (db.user.update as jest.Mock).mock.calls[0][0].data,
      { jsonArrays: ['mySchemaIds'] },
    );
    expect(settings.mySchemaIds).toEqual(['defectiveness']);
  });
});
