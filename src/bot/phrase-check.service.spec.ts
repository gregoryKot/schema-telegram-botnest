// ENCRYPTION_KEY выставляется ДО импорта сервиса: crypto.ts читает ключ при
// первом require, а без ключа encrypt() отдаёт текст как есть (dev-режим) —
// и проверка «в БД не лежит открытый текст» проходила бы вхолостую.
// Подробности — в шапке src/auth/totp.service.spec.ts.
process.env.ENCRYPTION_KEY = 'cc'.repeat(32);
process.env.ENCRYPTION_KEY_OLD = '';

import { PhraseCheckService } from './phrase-check.service';
import { PHRASE_MARK_IDS } from './phrase-check.constants';

// Приоритет — read-after-write: фраза уезжает в БД зашифрованной, а обратно
// обязана прийти читаемой вместе с приметами (правило «Тесты»: тест на запись
// зелёный и тогда, когда экран истории показывает мусор). Плюс изоляция по
// userId: чужую запись нельзя ни увидеть, ни удалить по id.
function makeDb() {
  const rows: any[] = [];
  let nextId = 1;
  const db: any = {
    userPhraseCheck: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        rows.filter((r) => r.userId === where.userId),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = rows.length;
        const kept = rows.filter(
          (r) => !(r.id === where.id && r.userId === where.userId),
        );
        rows.length = 0;
        rows.push(...kept);
        return { count: before - kept.length };
      }),
    },
  };
  return { db, rows };
}

const USER = 111n;
const OTHER = 222n;

describe('PhraseCheckService', () => {
  it('сохранил → нашёл: фраза, приметы и переписанный вариант возвращаются целыми', async () => {
    const { db } = makeDb();
    const service = new PhraseCheckService(db);

    await service.createPhraseCheck(USER, {
      phrase: 'Опять всё завалила, ни на что не гожусь',
      marks: ['person', 'absolute'],
      rewrite: 'Отчёт вышел с ошибкой. В следующий раз проверяю цифры дважды',
    });

    const [saved] = await service.getPhraseChecks(USER);
    expect(saved.phrase).toBe('Опять всё завалила, ни на что не гожусь');
    expect(saved.marks).toEqual(['person', 'absolute']);
    expect(saved.rewrite).toContain('проверяю цифры дважды');
  });

  it('свободный текст не лежит в БД открытым', async () => {
    const { db, rows } = makeDb();
    const service = new PhraseCheckService(db);

    await service.createPhraseCheck(USER, {
      phrase: 'секретная фраза критика',
      marks: ['fear'],
      rewrite: 'секретная переформулировка',
    });

    const raw = `${rows[0].phrase}|${rows[0].rewrite}`;
    expect(raw).not.toContain('секретная фраза критика');
    expect(raw).not.toContain('секретная переформулировка');
  });

  it('разбор без переписывания сохраняется (шаг необязательный)', async () => {
    const { db } = makeDb();
    const service = new PhraseCheckService(db);

    await service.createPhraseCheck(USER, {
      phrase: 'Так и знал',
      marks: [],
    });

    const [saved] = await service.getPhraseChecks(USER);
    expect(saved.rewrite).toBeNull();
    expect(saved.marks).toEqual([]);
  });

  it('одна и та же примета не считается дважды', async () => {
    const { db } = makeDb();
    const service = new PhraseCheckService(db);

    const created = await service.createPhraseCheck(USER, {
      phrase: 'фраза',
      marks: ['worth', 'worth', 'person'],
    });

    expect(created.marks).toEqual(['worth', 'person']);
    expect((await service.getPhraseChecks(USER))[0].marks).toEqual([
      'worth',
      'person',
    ]);
  });

  it('чужие разборы не видны и не удаляются по id', async () => {
    const { db } = makeDb();
    const service = new PhraseCheckService(db);

    const foreign = await service.createPhraseCheck(OTHER, {
      phrase: 'чужая фраза',
      marks: ['person'],
    });

    expect(await service.getPhraseChecks(USER)).toEqual([]);
    expect((await service.deletePhraseCheck(USER, foreign.id)).count).toBe(0);
    expect((await service.getPhraseChecks(OTHER))[0].phrase).toBe(
      'чужая фраза',
    );
  });

  it('протухший id приметы в старой записи не ломает историю', async () => {
    const { db, rows } = makeDb();
    const service = new PhraseCheckService(db);

    await service.createPhraseCheck(USER, { phrase: 'фраза', marks: [] });
    // Запись, сделанная версией с другим набором примет.
    rows[0].marks = ['person', 'снятая_примета'];

    expect((await service.getPhraseChecks(USER))[0].marks).toEqual(['person']);
  });

  it('список примет совпадает с фронтендом (паритет реестров)', () => {
    // Двойник — schema-miniapp/src/components/phraseCheck/criteria.ts:
    // правка одной стороны обязана уронить тест другой (бэкенд не может
    // импортировать фронтенд, поэтому сверка через явный список).
    expect([...PHRASE_MARK_IDS]).toEqual([
      'goal',
      'notok',
      'person',
      'label',
      'fear',
      'never',
      'mistake',
      'absolute',
      'worth',
    ]);
  });
});
