// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md, п.4): src/utils/encrypt-migration.ts —
// миграция клинических меток «плейнтекст → шифротекст» (Note.tags,
// User.mySchemaIds/myModeIds, SchemaDiaryEntry.schemaIds, ModeDiaryEntry.modeId,
// ClientConceptualization.schemaIds/modeIds/history).
//
// Важно: это НЕ универсальный скрипт ротации ENCRYPTION_KEY (тот —
// scripts/rotate-encryption-key.ts, через reencrypt()). migrateClinicalLabels
// переводит легаси-плейнтекст в шифротекст текущим ключом эвристикой
// looksPlaintext/Array.isArray — и НЕ перешифровывает уже зашифрованное
// старым ключом (см. describe про смену ENCRYPTION_KEY, включая найденный
// баг двойного шифрования).
//
// Ключи читаются один раз при загрузке модуля — каждый сценарий грузит
// свежую пару crypto.ts/encrypt-migration.ts через jest.isolateModules
// (паттерн из src/utils/crypto.spec.ts).

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
    const db = makeDb({
      notes: [{ id: 1, tags: 'anxiety,anger' }],
      users: [{ id: 1, mySchemaIds: ['defect'], myModeIds: [] }],
    }) as any;
    await migrateClinicalLabels(db);
    expect(db.note.update).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
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
    const db = makeDb({ notes: [{ id: 1, tags: enc }] }) as any;
    await migrateClinicalLabels(db);
    expect(db.note.update).not.toHaveBeenCalled();
  });
});

describe('поведение при уже проведённой смене ENCRYPTION_KEY (это НЕ ротация)', () => {
  it('JSON-поле под старым ключом миграция не трогает вообще (эвристика — только Array.isArray)', async () => {
    const oldMods = load({ key: KEY_A });
    const oldBlob = oldMods.crypto.encryptJson(['abandon'])!;

    // Ротация ключа уже произошла: текущий — KEY_B, ENCRYPTION_KEY_OLD не задан.
    const { migrateClinicalLabels } = load({ key: KEY_B });
    const db = makeDb({
      schemaDiaryEntries: [{ id: 1, schemaIds: oldBlob }],
    }) as any;
    await migrateClinicalLabels(db);

    // Поле — строка (не массив), поэтому эвристика считает его «уже
    // зашифрованным» и не трогает вообще — независимо от того, каким именно
    // ключом оно реально зашифровано. Строка остаётся нечитаемой без старого ключа.
    expect(db.schemaDiaryEntry.update).not.toHaveBeenCalled();
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
    // новый ключ — этим занимается только scripts/rotate-encryption-key.ts.
    expect(db.note.update).not.toHaveBeenCalled();
    expect(crypto.decrypt(oldBlob)).toBe('anxiety,anger'); // читается, пока жив OLD-ключ
  });

  it('ФИКС (был БАГ): если OLD-ключ уже убран, старый шифроблок распознаётся по формату и пропускается — не шифруется повторно', async () => {
    const oldMods = load({ key: KEY_A });
    const oldBlob = oldMods.crypto.encrypt('anxiety,anger')!;

    // Сценарий инцидента: старый ключ убрали из env, не прогнав
    // scripts/rotate-encryption-key.ts перед этим.
    const { migrateClinicalLabels } = load({ key: KEY_B });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const db = makeDb({ notes: [{ id: 1, tags: oldBlob }] }) as any;
    await migrateClinicalLabels(db);

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
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'возможна неполная ротация ENCRYPTION_KEY — строка похожа на шифротекст, пропущена',
      ),
    );

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
    await expect(migrateClinicalLabels(db)).resolves.toBeUndefined();

    // Строка id=1 упала и осталась нетронутой в БД (update откатился),
    // но строка id=2 всё равно обработана, и таблица User дошла до findMany
    // и update — миграция не оборвалась на первой ошибке.
    expect(db.note.update).toHaveBeenCalledTimes(2); // id=1 (упала) + id=2 (успех)
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.update).toHaveBeenCalledTimes(1);

    // Сводка о падениях залогирована через Logger.warn.
    const logged = stdoutWrite.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toEqual(expect.stringContaining('1 row failure'));
    stdoutWrite.mockRestore();
  });
});
