// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md, п.4): src/utils/encrypt-migration.ts —
// миграция клинических меток «плейнтекст → шифротекст» (Note.tags,
// User.mySchemaIds/myModeIds, SchemaDiaryEntry.schemaIds, ModeDiaryEntry.modeId,
// ClientConceptualization.schemaIds/modeIds/history).
//
// Важно: это НЕ универсальный скрипт ротации ENCRYPTION_KEY (тот —
// src/cli/rotate-encryption/rotate-all.ts, через reencrypt()). migrateClinicalLabels
// переводит легаси-плейнтекст в шифротекст текущим ключом эвристикой
// looksPlaintext/Array.isArray — и НЕ перешифровывает уже зашифрованное
// старым ключом (см. describe про смену ENCRYPTION_KEY, включая найденный
// баг двойного шифрования).
//
// Остаток: строки под потерянным ключом считаются в unknownKey и в JSON-полях
// (describe «остаток в JSON-полях» ниже), а не только в Note.tags/ModeDiaryEntry.
//
// Ключи читаются один раз при загрузке модуля — каждый сценарий грузит
// свежую пару crypto.ts/encrypt-migration.ts через jest.isolateModules
// (паттерн из src/utils/crypto.spec.ts).

import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaService } from '../prisma/prisma.service';

type CryptoModule = typeof import('./crypto');
type MigrationModule = typeof import('./encrypt-migration');

const KEY_A = 'aa'.repeat(32); // «старый» ключ (64 hex = 32 байта)
const KEY_B = 'bb'.repeat(32); // «новый» ключ после ротации
const ORIGINAL_ENV = { ...process.env };

function load(env: { key?: string; old?: string }): {
  crypto: CryptoModule;
  migrateClinicalLabels: MigrationModule['migrateClinicalLabels'];
} {
  process.env.ENCRYPTION_KEY = env.key ?? '';
  process.env.ENCRYPTION_KEY_OLD = env.old ?? '';
  process.env.NODE_ENV = 'test';
  let crypto: CryptoModule | undefined;
  let migration: MigrationModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    crypto = require('./crypto') as CryptoModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    migration = require('./encrypt-migration') as MigrationModule;
  });
  return {
    crypto: crypto!,
    migrateClinicalLabels: migration!.migrateClinicalLabels,
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

// ── Фейковая Prisma: таблицы в памяти, findMany/update как в реальном API ──

type Row = Record<string, any>;

function makeTable(rows: Row[], throwOnId?: unknown) {
  return {
    findMany: jest.fn(() => Promise.resolve(rows.map((r) => ({ ...r })))),
    update: jest.fn(({ where, data }: any) => {
      if (throwOnId !== undefined && where.id === throwOnId) {
        return Promise.reject(
          new Error(`DB update failed for id=${String(where.id)}`),
        );
      }
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error(`row not found: ${String(where.id)}`);
      Object.assign(row, data);
      return { ...row };
    }),
  };
}

function makeDb(tables: {
  notes?: Row[];
  users?: Row[];
  schemaDiaryEntries?: Row[];
  modeDiaryEntries?: Row[];
  conceptualizations?: Row[];
  throwOn?: { table: string; id: unknown };
}) {
  const t = (name: string, rows: Row[]) =>
    makeTable(
      rows,
      tables.throwOn?.table === name ? tables.throwOn.id : undefined,
    );
  return {
    note: t('note', tables.notes ?? []),
    user: t('user', tables.users ?? []),
    schemaDiaryEntry: t('schemaDiaryEntry', tables.schemaDiaryEntries ?? []),
    modeDiaryEntry: t('modeDiaryEntry', tables.modeDiaryEntries ?? []),
    clientConceptualization: t(
      'clientConceptualization',
      tables.conceptualizations ?? [],
    ),
  } as unknown as PrismaService;
}

describe('migrateClinicalLabels — плейнтекст → шифротекст', () => {
  it('без ENCRYPTION_KEY — миграция не трогает ничего (bail out)', async () => {
    const { migrateClinicalLabels } = load({});
    // Logger внутри encrypt-migration.ts — своя изолированная копия
    // '@nestjs/common' (jest.isolateModules), пишет через process.stdout.write.
    const stdoutWrite = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const db = makeDb({
      notes: [{ id: 1, tags: 'anxiety,anger' }],
      users: [{ id: 1, mySchemaIds: ['defect'], myModeIds: [] }],
    }) as any;
    await migrateClinicalLabels(db);
    expect(db.note.update).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    // Bail out даже до findMany — не тихо, а с явным предупреждением.
    expect(db.note.findMany).not.toHaveBeenCalled();
    const logged = stdoutWrite.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toEqual(
      expect.stringContaining(
        'ENCRYPTION_KEY not set — skipping clinical-label migration',
      ),
    );
    stdoutWrite.mockRestore();
  });

  it('легаси-плейнтекст Note.tags шифруется текущим ключом и читается обратно', async () => {
    const { migrateClinicalLabels, crypto } = load({ key: KEY_A });
    const db = makeDb({ notes: [{ id: 1, tags: 'anxiety,anger' }] }) as any;
    await migrateClinicalLabels(db);
    expect(db.note.update).toHaveBeenCalledTimes(1);
    const stored = db.note.update.mock.calls[0][0].data.tags;
    expect(stored).not.toBe('anxiety,anger');
    expect(crypto.decrypt(stored)).toBe('anxiety,anger');
  });

  it('легаси-плейнтекст ModeDiaryEntry.modeId шифруется', async () => {
    const { migrateClinicalLabels, crypto } = load({ key: KEY_A });
    const db = makeDb({
      modeDiaryEntries: [{ id: 5, modeId: 'vulnerable_child' }],
    }) as any;
    await migrateClinicalLabels(db);
    const stored = db.modeDiaryEntry.update.mock.calls[0][0].data.modeId;
    expect(crypto.decrypt(stored)).toBe('vulnerable_child');
  });

  it('легаси JSON-массивы (User/SchemaDiaryEntry/ClientConceptualization) шифруются в строку', async () => {
    const { migrateClinicalLabels, crypto } = load({ key: KEY_A });
    const db = makeDb({
      users: [{ id: 1, mySchemaIds: ['defect'], myModeIds: ['vuln'] }],
      schemaDiaryEntries: [{ id: 2, schemaIds: ['abandon'] }],
      conceptualizations: [
        { id: 3, schemaIds: ['mistrust'], modeIds: ['angry'], history: [] },
      ],
    }) as any;
    await migrateClinicalLabels(db);

    const userPatch = db.user.update.mock.calls[0][0].data;
    expect(typeof userPatch.mySchemaIds).toBe('string');
    expect(crypto.decryptJson(userPatch.mySchemaIds)).toEqual(['defect']);
    expect(crypto.decryptJson(userPatch.myModeIds)).toEqual(['vuln']);

    const schemaPatch = db.schemaDiaryEntry.update.mock.calls[0][0].data;
    expect(crypto.decryptJson(schemaPatch.schemaIds)).toEqual(['abandon']);

    const conceptPatch =
      db.clientConceptualization.update.mock.calls[0][0].data;
    expect(crypto.decryptJson(conceptPatch.schemaIds)).toEqual(['mistrust']);
    expect(crypto.decryptJson(conceptPatch.modeIds)).toEqual(['angry']);
  });

  it('history-снапшоты ClientConceptualization шифруются поэлементно, уже-строковые снапшоты не трогаются', async () => {
    const { migrateClinicalLabels, crypto } = load({ key: KEY_A });
    const already = crypto.encryptJson(['old_mode'])!;
    const db = makeDb({
      conceptualizations: [
        {
          id: 9,
          schemaIds: 'already-string', // не массив — верхний уровень не трогаем
          modeIds: 'already-string',
          history: [
            { schemaIds: ['punitive'], modeIds: ['punitive_parent'] },
            { schemaIds: already, modeIds: already }, // уже строка
          ],
        },
      ],
    }) as any;
    await migrateClinicalLabels(db);

    expect(db.clientConceptualization.update).toHaveBeenCalledTimes(1);
    const patch = db.clientConceptualization.update.mock.calls[0][0].data;
    expect(patch.schemaIds).toBeUndefined(); // верхнеуровневая строка не тронута
    const history = patch.history;
    expect(crypto.decryptJson(history[0].schemaIds)).toEqual(['punitive']);
    expect(crypto.decryptJson(history[0].modeIds)).toEqual(['punitive_parent']);
    expect(history[1].schemaIds).toBe(already); // второй снапшот не менялся
  });

  it('строка, уже зашифрованная текущим ключом, не переписывается повторно', async () => {
    const { migrateClinicalLabels, crypto } = load({ key: KEY_A });
    const enc = crypto.encrypt('anxiety,anger')!;
    const notesRows = [{ id: 1, tags: enc }];
    const db = makeDb({ notes: notesRows }) as any;
    await migrateClinicalLabels(db);
    // Строка реально осмотрена (findMany дошёл), просто признана
    // уже-шифротекстом — это не bail out по отсутствию ключа.
    expect(db.note.findMany).toHaveBeenCalledTimes(1);
    expect(db.note.update).not.toHaveBeenCalled();
    // Байты в БД остались тем же шифротекстом — не переписаны «в себя же».
    expect(notesRows[0].tags).toBe(enc);
  });
});

describe('поведение при уже проведённой смене ENCRYPTION_KEY (это НЕ ротация)', () => {
  it('JSON-поле под старым ключом миграция не пишет (эвристика — только Array.isArray), но считает в остаток', async () => {
    const oldMods = load({ key: KEY_A });
    const oldBlob = oldMods.crypto.encryptJson(['abandon'])!;

    // Ротация ключа уже произошла: текущий — KEY_B, ENCRYPTION_KEY_OLD не задан.
    const { migrateClinicalLabels } = load({ key: KEY_B });
    const entryRows = [{ id: 1, schemaIds: oldBlob }];
    const db = makeDb({ schemaDiaryEntries: entryRows }) as any;
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const result = await migrateClinicalLabels(db);

    // Поле — строка (не массив), поэтому на запись эвристика считает его «уже
    // зашифрованным» и не трогает вообще — независимо от того, каким именно
    // ключом оно реально зашифровано. Строка остаётся нечитаемой без старого
    // ключа, и именно поэтому попадает в остаток (подробности — describe ниже).
    expect(result.unknownKey).toEqual({ SchemaDiaryEntry: 1 });
    expect(db.schemaDiaryEntry.findMany).toHaveBeenCalledTimes(1);
    expect(db.schemaDiaryEntry.update).not.toHaveBeenCalled();
    // Значение в «БД» не тронуто вообще — тот же blob, что записали в фикстуру.
    expect(entryRows[0].schemaIds).toBe(oldBlob);
  });

  it('строковое поле под старым ключом при активном ENCRYPTION_KEY_OLD пропускается (не перешифровывается новым ключом)', async () => {
    const oldMods = load({ key: KEY_A });
    const oldBlob = oldMods.crypto.encrypt('anxiety,anger')!;
    const { migrateClinicalLabels, crypto } = load({ key: KEY_B, old: KEY_A });
    const db = makeDb({ notes: [{ id: 1, tags: oldBlob }] }) as any;
    await migrateClinicalLabels(db);

    // decrypt() успешно читает старым ключом из ENCRYPTION_KEY_OLD ⇒
    // looksPlaintext=false ⇒ строка пропускается как «уже зашифрованная».
    // Значит, migrateClinicalLabels НЕ выполняет фактическую перешифровку на
    // новый ключ — этим занимается только src/cli/rotate-encryption/rotate-all.ts.
    expect(db.note.update).not.toHaveBeenCalled();
    expect(crypto.decrypt(oldBlob)).toBe('anxiety,anger'); // читается, пока жив OLD-ключ
  });

  it('ФИКС (был БАГ): если OLD-ключ уже убран, старый шифроблок распознаётся по формату и пропускается — не шифруется повторно', async () => {
    const oldMods = load({ key: KEY_A });
    const oldBlob = oldMods.crypto.encrypt('anxiety,anger')!;

    // Сценарий инцидента: старый ключ убрали из env, не прогнав
    // src/cli/rotate-encryption/rotate-all.ts перед этим.
    const { migrateClinicalLabels } = load({ key: KEY_B });
    const stdoutWrite = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderrWrite = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const db = makeDb({ notes: [{ id: 1, tags: oldBlob }] }) as any;
    const result = await migrateClinicalLabels(db);

    // Раньше: decrypt(oldBlob) новым ключом не срабатывает ⇒ decrypt()
    // возвращает oldBlob без изменений ⇒ looksPlaintext(oldBlob) === true
    // (совпал сам с собой) ⇒ код считал блок «плейнтекстом» и шифровал его
    // ЕЩЁ РАЗ — оригинал терялся необратимо.
    //
    // Теперь: строка decrypt-инвариантна, НО похожа на формат шифротекста
    // (looksLikeCiphertext — строгий base64 ≥29 байт) ⇒ классифицируется как
    // «неизвестный ключ», а не «плейнтекст» ⇒ строка НЕ трогается, только
    // громкий warn — можно восстановить после починки ENCRYPTION_KEY_OLD.
    expect(db.note.update).not.toHaveBeenCalled();
    expect(result.unknownKey).toEqual({ Note: 1 });
    const warned = stdoutWrite.mock.calls.map((c) => String(c[0])).join('\n');
    expect(warned).toContain(
      'возможна неполная ротация ENCRYPTION_KEY — строка похожа на шифротекст, пропущена',
    );
    // Итог — ОДИН error (его алертит AlertLogger), только счётчики и имя
    // таблицы: ни id строки, ни шифроблок в сводку не попадают.
    // (decrypt() в crypto.ts отдельно логирует свой error на нечитаемый blob —
    // это его сигнал, здесь считаем только сводку миграции.)
    const errored = stderrWrite.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.includes('[EncryptMigration]'));
    expect(errored).toHaveLength(1);
    expect(errored[0]).toContain('строк под нечитаемым ключом: 1 (Note: 1)');
    expect(errored[0]).toContain('старый ключ шифрования убран раньше');
    expect(errored[0]).not.toContain(oldBlob);

    // Блоб остался нетронутым и всё ещё читается старым ключом.
    expect(oldMods.crypto.decrypt(oldBlob)).toBe('anxiety,anger');
  });
});

describe('устойчивость к ошибкам при записи (изоляция по строке)', () => {
  it('ФИКС: ошибка prisma.update на одной строке НЕ обрывает миграцию — остальные строки и таблицы всё равно обрабатываются', async () => {
    const { migrateClinicalLabels } = load({ key: KEY_A });
    // Logger внутри encrypt-migration.ts пишет через process.stdout.write
    // (дефолтный Nest ConsoleLogger), не через console.* — а модуль
    // encrypt-migration.ts подгружен через jest.isolateModules со своей
    // изолированной копией '@nestjs/common', поэтому spyOn(Logger.prototype)
    // из внешнего скоупа его не перехватит. Перехватываем на уровне стрима.
    const stdoutWrite = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderrWrite = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const db = makeDb({
      notes: [
        { id: 1, tags: 'anxiety' },
        { id: 2, tags: 'fear' },
      ],
      users: [{ id: 1, mySchemaIds: ['defect'], myModeIds: [] }],
      throwOn: { table: 'note', id: 1 },
    }) as any;

    // Раньше: первая же упавшая строка обрывала for-цикл целиком (throw
    // наружу из migrateClinicalLabels) — вторая заметка (id=2) и таблица
    // User так и не обрабатывались, try/catch по строке отсутствовал.
    const result = await migrateClinicalLabels(db);
    expect(result.failures).toBe(1);
    expect(result.encrypted).toMatchObject({ Note: 1, User: 1 });

    // Строка id=1 упала и осталась нетронутой в БД (update откатился),
    // но строка id=2 всё равно обработана, и таблица User дошла до findMany
    // и update — миграция не оборвалась на первой ошибке.
    expect(db.note.update).toHaveBeenCalledTimes(2); // id=1 (упала) + id=2 (успех)
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.update).toHaveBeenCalledTimes(1);

    // Сводка о падениях залогирована через Logger.warn.
    const logged = stdoutWrite.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toEqual(expect.stringContaining('update failed, skipping'));
    // Сводка — error (alert), а не warn: иначе до владельца не доходит.
    const errored = stderrWrite.mock.calls.map((c) => String(c[0])).join('\n');
    expect(errored).toContain('не удалось записать строк: 1');
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it('чистый прогон не шлёт error-сводку', async () => {
    const { migrateClinicalLabels } = load({ key: KEY_A });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrWrite = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const db = makeDb({ notes: [{ id: 1, tags: 'anxiety' }] }) as any;
    const result = await migrateClinicalLabels(db);
    expect(result).toEqual({
      encrypted: expect.objectContaining({ Note: 1 }),
      failures: 0,
      unknownKey: {},
    });
    expect(stderrWrite).not.toHaveBeenCalled();
  });
});

// Остаток в JSON-полях: строка под потерянным ключом — тот же остаток, что у
// Note.tags. Раньше её молча считали «уже зашифрованной», и проба рапортовала
// «все метки зашифрованы» при нечитаемых данных. Считаем, но не пишем.
describe('остаток в JSON-полях (строка под потерянным ключом)', () => {
  const lostBlob = () => load({ key: KEY_A }).crypto.encryptJson(['abandon'])!;

  const quietLogs = () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  };

  it('User: обе колонки под потерянным ключом — одна строка таблицы, не пишется', async () => {
    const blob = lostBlob();
    const { migrateClinicalLabels } = load({ key: KEY_B });
    quietLogs();
    const db = makeDb({
      users: [
        { id: 1, mySchemaIds: blob, myModeIds: blob },
        { id: 2, mySchemaIds: blob, myModeIds: [] }, // массив пишется, строка считается
      ],
    }) as any;
    const result = await migrateClinicalLabels(db);

    expect(result.unknownKey).toEqual({ User: 2 });
    expect(db.user.update).toHaveBeenCalledTimes(1); // только myModeIds: [] у id=2
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty(
      'mySchemaIds',
    );
  });

  it('ClientConceptualization: верхний уровень и снапшот истории — одна строка таблицы', async () => {
    const blob = lostBlob();
    const { migrateClinicalLabels } = load({ key: KEY_B });
    quietLogs();
    const db = makeDb({
      conceptualizations: [
        { id: 1, schemaIds: blob, modeIds: blob, history: [] },
        {
          id: 2,
          schemaIds: [],
          modeIds: [],
          history: [{ modeIds: blob }, null],
        },
      ],
    }) as any;
    const result = await migrateClinicalLabels(db);

    expect(result.unknownKey).toEqual({ ClientConceptualization: 2 });
  });

  it('строка под текущим ключом и пустое значение в остаток не идут; итог без error', async () => {
    const { migrateClinicalLabels, crypto } = load({ key: KEY_B });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const ok = crypto.encryptJson(['abandon'])!;
    const db = makeDb({
      users: [{ id: 1, mySchemaIds: ok, myModeIds: '' }],
      schemaDiaryEntries: [{ id: 2, schemaIds: ok }],
      conceptualizations: [
        { id: 3, schemaIds: ok, modeIds: ok, history: [{ schemaIds: ok }] },
      ],
    }) as any;
    const result = await migrateClinicalLabels(db);

    expect(result.unknownKey).toEqual({});
    expect(stderr).not.toHaveBeenCalled();
  });

  it('под ENCRYPTION_KEY_OLD строка читается — не остаток', async () => {
    const blob = lostBlob();
    const { migrateClinicalLabels } = load({ key: KEY_B, old: KEY_A });
    quietLogs();
    const db = makeDb({ schemaDiaryEntries: [{ id: 1, schemaIds: blob }] });
    const result = await migrateClinicalLabels(db);

    expect(result.unknownKey).toEqual({});
  });

  it('остаток из JSON-поля попадает в error-сводку с именем таблицы, без шифроблока', async () => {
    const blob = lostBlob();
    const { migrateClinicalLabels } = load({ key: KEY_B });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const db = makeDb({
      schemaDiaryEntries: [{ id: 7, schemaIds: blob }],
    });
    await migrateClinicalLabels(db);

    const errored = stderr.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.includes('[EncryptMigration]'));
    expect(errored).toHaveLength(1);
    expect(errored[0]).toContain('(SchemaDiaryEntry: 1)');
    expect(errored[0]).not.toContain(blob);
  });
});

// Класс «сигнал мимо AlertLogger» (аудит 2026-10): console.* и logger.warn не
// доходят до владельца. Трипваер строгий, без исключений: в этих файлах
// сообщения идут только через Nest Logger.
describe('миграция клинических меток не пишет в console.*', () => {
  it.each([
    'src/utils/encrypt-migration.ts',
    'src/utils/encrypt-migration.rows.ts',
    'src/main.ts',
  ])('%s', (file) => {
    const src = readFileSync(join(__dirname, '..', '..', file), 'utf8');
    expect(src).not.toMatch(/\bconsole\.(log|warn|error|info)\(/);
  });
});
