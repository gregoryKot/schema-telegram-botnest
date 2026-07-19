import { ExercisesService } from './exercises.service';

// Stateful in-memory fake Prisma для 4 независимых user-owned таблиц.
// Приоритет: read-after-write через шифрование (encrypt/decrypt round-trip)
// и изоляция по userId на delete (нельзя стереть чужую запись по id).
function makeDb() {
  const beliefChecks: any[] = [];
  const letters: any[] = [];
  const flashcards: any[] = [];
  let safePlace: any = null;
  let nextId = 1;

  const db: any = {
    userBeliefCheck: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        beliefChecks.push(row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        beliefChecks.filter((r) => r.userId === where.userId),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = beliefChecks.length;
        const kept = beliefChecks.filter(
          (r) => !(r.id === where.id && r.userId === where.userId),
        );
        beliefChecks.length = 0;
        beliefChecks.push(...kept);
        return { count: before - kept.length };
      }),
    },
    userLetter: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        letters.push(row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        letters.filter((r) => r.userId === where.userId),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = letters.length;
        const kept = letters.filter(
          (r) => !(r.id === where.id && r.userId === where.userId),
        );
        letters.length = 0;
        letters.push(...kept);
        return { count: before - kept.length };
      }),
    },
    userSafePlace: {
      findUnique: jest.fn(({ where }: any) =>
        safePlace && safePlace.userId === where.userId ? safePlace : null,
      ),
      upsert: jest.fn(({ where, update, create }: any) => {
        if (safePlace && safePlace.userId === where.userId) {
          Object.assign(safePlace, update);
        } else {
          safePlace = { ...create };
        }
        return safePlace;
      }),
    },
    userFlashcard: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        flashcards.push(row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        flashcards.filter((r) => r.userId === where.userId),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = flashcards.length;
        const kept = flashcards.filter(
          (r) => !(r.id === where.id && r.userId === where.userId),
        );
        flashcards.length = 0;
        flashcards.push(...kept);
        return { count: before - kept.length };
      }),
    },
  };
  return db;
}

describe('ExercisesService — read-after-write', () => {
  it('belief check: сохранённые поля (включая массивы) читаются назад расшифрованными', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);

    await svc.createBeliefCheck(1n, {
      belief: 'я всех подвожу',
      evidenceFor: ['опоздал вчера'],
      evidenceAgainst: ['обычно прихожу вовремя'],
      reframe: 'один раз — не системность',
    });
    const rows = await svc.getBeliefChecks(1n);

    expect(rows).toHaveLength(1);
    expect(rows[0].belief).toBe('я всех подвожу');
    expect(rows[0].evidenceFor).toEqual(['опоздал вчера']);
    expect(rows[0].evidenceAgainst).toEqual(['обычно прихожу вовремя']);
    expect(rows[0].reframe).toBe('один раз — не системность');
  });

  it('letter: текст читается назад как есть', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);

    await svc.createLetter(1n, 'письмо себе в прошлое');
    const rows = await svc.getLetters(1n);

    expect(rows[0].text).toBe('письмо себе в прошлое');
  });

  it('safe place: повторный upsert обновляет, а не дублирует', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);

    await svc.upsertSafePlace(1n, 'лес у бабушки');
    await svc.upsertSafePlace(1n, 'берег моря');
    const row = await svc.getSafePlace(1n);

    expect(row?.description).toBe('берег моря');
    expect(db.userSafePlace.upsert).toHaveBeenCalledTimes(2);
  });

  it('flashcard: reflection/action читаются назад', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);

    await svc.createFlashcard(1n, {
      modeId: 'vulnerable_child',
      needId: 'attachment',
      reflection: 'испугался',
      action: 'сделать паузу',
    });
    const rows = await svc.getFlashcards(1n);

    expect(rows[0].reflection).toBe('испугался');
    expect(rows[0].action).toBe('сделать паузу');
  });
});

describe('ExercisesService — изоляция по userId на удаление', () => {
  it('deleteBeliefCheck чужим userId не удаляет запись', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);
    await svc.createBeliefCheck(1n, {
      belief: 'x',
      evidenceFor: [],
      evidenceAgainst: [],
    });
    const [row] = await svc.getBeliefChecks(1n);

    await svc.deleteBeliefCheck(2n, row.id); // юзер 2 пытается стереть запись юзера 1

    expect(await svc.getBeliefChecks(1n)).toHaveLength(1);
  });

  it('deleteLetter владельцем удаляет запись', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);
    await svc.createLetter(1n, 'текст');
    const [row] = await svc.getLetters(1n);

    await svc.deleteLetter(1n, row.id);

    expect(await svc.getLetters(1n)).toHaveLength(0);
  });

  it('deleteFlashcard чужим userId не удаляет запись', async () => {
    const db = makeDb();
    const svc = new ExercisesService(db);
    await svc.createFlashcard(1n, { modeId: 'm', needId: 'n' });
    const [row] = await svc.getFlashcards(1n);

    await svc.deleteFlashcard(999n, row.id);

    expect(await svc.getFlashcards(1n)).toHaveLength(1);
  });
});
