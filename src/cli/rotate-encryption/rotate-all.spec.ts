// Ротация ENCRYPTION_KEY: поведение rotateAll на поддельном клиенте с НАСТОЯЩИМ
// шифрованием. Что делает SQL и совпадают ли списки с базой — доказывают
// живой спек test/key-rotation.e2e-spec.ts и сверка
// src/utils/encryption-rotation-coverage.spec.ts; здесь — логика цикла:
// устойчивость к падению модели, условие обновления, «не расшифровалось».
//
// Ключи читаются crypto.ts при загрузке модуля — каждый сценарий грузит свежую
// пару модулей под своими ключами (loadWithKeys).
import type { PrismaClient } from '@prisma/client';
import { loadWithKeys } from '../../test-support/load-with-keys';
import type { RotationTarget } from './targets';

type RotateModule = typeof import('./rotate-all');
type CryptoModule = typeof import('../../utils/crypto');

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
const KEY_C = 'cc'.repeat(32);
const ORIGINAL_ENV = { ...process.env };

function load(key: string, old?: string) {
  return loadWithKeys({ key, old }, () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    crypto: require('../../utils/crypto') as CryptoModule,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    rotate: require('./rotate-all') as RotateModule,
  }));
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

type Row = Record<string, unknown>;
type Where = Row;

function fakeClient(
  tables: Record<string, Row[]>,
  brokenModels: string[] = [],
) {
  const updates: Array<{ model: string; where: Where; data: Row }> = [];
  const count: Record<string, number> = {};
  const delegate = (model: string) => ({
    findMany: jest.fn(async () => {
      if (brokenModels.includes(model)) throw new Error('connection reset');
      return (tables[model] ?? []).map((r) => ({ ...r }));
    }),
    updateMany: jest.fn(async (a: { where: Where; data: Row }) => {
      updates.push({ model, ...a });
      return { count: count[model] ?? 1 };
    }),
  });
  const client = new Proxy(
    {},
    {
      get: (_t, name: string) =>
        name === 'ghost' ? undefined : delegate(name),
    },
  );
  return { client: client as unknown as PrismaClient, updates, count };
}

const noteTarget: RotationTarget = { name: 'note', fields: ['text', 'tags'] };

describe('rotateAll', () => {
  it('перешифровывает строку: читается новым ключом, старым — нет; условие несёт ключ и прежние значения', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const textA = a.crypto.encrypt('секретная заметка')!;
    const { client, updates } = fakeClient({
      note: [{ id: 7, text: textA, tags: null }],
    });

    const report = await b.rotate.rotateAll(client, { targets: [noteTarget] });

    expect(report).toEqual({ rows: 1, failed: [] });
    expect(updates).toHaveLength(1);
    const [u] = updates;
    expect(u.where).toEqual({ id: 7, text: { equals: textA } });
    expect(Object.keys(u.data)).toEqual(['text']);
    const stored = u.data.text as string;
    expect(b.crypto.decrypt(stored)).toBe('секретная заметка');
    const onlyOld = load(KEY_A);
    expect(onlyOld.crypto.decrypt(stored)).toBe(stored); // старым ключом не читается
    const onlyNew = load(KEY_B);
    expect(onlyNew.crypto.decrypt(stored)).toBe('секретная заметка');
  });

  it('составной ключ: условие по каждой колонке ключа, без «userId_type»', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const { client, updates } = fakeClient({
      diaryDraft: [
        { userId: 5n, type: 'schema', data: a.crypto.encrypt('{}') },
      ],
    });

    await b.rotate.rotateAll(client, {
      targets: [
        { name: 'diaryDraft', fields: ['data'], pk: ['userId', 'type'] },
      ],
    });

    expect(Object.keys(updates[0].where).sort()).toEqual([
      'data',
      'type',
      'userId',
    ]);
    expect(updates[0].where).toMatchObject({ userId: 5n, type: 'schema' });
  });

  it('null, массив и объект не трогает — обновления нет', async () => {
    const b = load(KEY_B, KEY_A);
    const { client, updates } = fakeClient({
      note: [
        { id: 1, text: null, tags: null },
        { id: 2, text: ['легаси'], tags: { a: 1 } },
      ],
    });

    const report = await b.rotate.rotateAll(client, { targets: [noteTarget] });

    expect(report).toEqual({ rows: 0, failed: [] });
    expect(updates).toEqual([]);
  });

  it('строка, которую приложение изменило за время ротации (count 0), не считается и не ошибка', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const { client, count } = fakeClient({
      note: [{ id: 1, text: a.crypto.encrypt('x'), tags: null }],
    });
    count.note = 0;
    const lines: string[] = [];

    const report = await b.rotate.rotateAll(client, {
      targets: [noteTarget],
      log: (l) => lines.push(l),
    });

    expect(report).toEqual({ rows: 0, failed: [] });
    expect(lines).toContain(
      '  note: менять нечего (строк: 1, изменились во время ротации: 1)',
    );
  });

  it('падение одной модели не обрывает остальные: она в failed, остальные ротированы', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const { client, updates } = fakeClient({
      userLetter: [{ id: 1, text: a.crypto.encrypt('письмо') }],
      userFlashcard: [{ id: 2, reflection: a.crypto.encrypt('карточка') }],
    });
    const targets: RotationTarget[] = [
      { name: 'userLetter', fields: ['text'] },
      { name: 'ghost', fields: ['x'] }, // модели нет в клиенте
      { name: 'userFlashcard', fields: ['reflection'] },
    ];
    const lines: string[] = [];

    const report = await b.rotate.rotateAll(client, {
      targets,
      log: (l) => lines.push(l),
    });

    expect(report).toEqual({ rows: 2, failed: ['ghost'] });
    expect(updates.map((u) => u.model)).toEqual([
      'userLetter',
      'userFlashcard',
    ]);
    expect(lines).toContain('✗ ghost: в клиенте Prisma нет модели ghost');
  });

  it('исключение из findMany тоже уходит в failed, дальше цикл идёт', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const { client, updates } = fakeClient(
      { userPractice: [{ id: 3, text: a.crypto.encrypt('практика') }] },
      ['userLetter'],
    );
    const lines: string[] = [];

    const report = await b.rotate.rotateAll(client, {
      targets: [
        { name: 'userLetter', fields: ['text'] },
        { name: 'userPractice', fields: ['text'] },
      ],
      log: (l) => lines.push(l),
    });

    expect(report).toEqual({ rows: 1, failed: ['userLetter'] });
    expect(updates.map((u) => u.model)).toEqual(['userPractice']);
    expect(lines).toContain('✗ userLetter: connection reset');
  });

  it('значение, похожее на шифротекст, но не читаемое ни одним ключом, — в failed; читаемое соседнее поле всё равно ротируется', async () => {
    const a = load(KEY_A);
    const c = load(KEY_C);
    const b = load(KEY_B, KEY_A); // ключа C у ротации нет
    const { client, updates } = fakeClient({
      note: [
        {
          id: 1,
          text: a.crypto.encrypt('читается'),
          tags: c.crypto.encrypt('потеряно'),
        },
      ],
    });

    const report = await b.rotate.rotateAll(client, { targets: [noteTarget] });

    expect(report.failed).toEqual(['note (не расшифровалось: 1)']);
    expect(report.rows).toBe(1);
    expect(Object.keys(updates[0].data)).toEqual(['text']);
  });

  it('легаси-открытый текст не считается нечитаемым', async () => {
    const b = load(KEY_B, KEY_A);
    const { client } = fakeClient({
      note: [{ id: 1, text: 'просто текст с пробелами', tags: null }],
    });

    const report = await b.rotate.rotateAll(client, { targets: [noteTarget] });

    expect(report).toEqual({ rows: 0, failed: [] });
  });

  it('повторный прогон идемпотентен: значения остаются читаемыми', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const table = [
      { id: 1, text: a.crypto.encrypt('раз'), tags: null },
    ] as Row[];
    const first = fakeClient({ note: table });
    await b.rotate.rotateAll(first.client, { targets: [noteTarget] });
    table[0].text = first.updates[0].data.text;

    const second = fakeClient({ note: table });
    const report = await b.rotate.rotateAll(second.client, {
      targets: [noteTarget],
    });

    expect(report.failed).toEqual([]);
    expect(b.crypto.decrypt(second.updates[0].data.text as string)).toBe('раз');
  });
});

describe('история концептуализаций', () => {
  it('строковые поля снапшотов ротируются, даты и не-строки — нет; условие несёт прежнюю историю', async () => {
    const a = load(KEY_A);
    const b = load(KEY_B, KEY_A);
    const history = [
      { savedAt: '2026-10-01', goals: a.crypto.encrypt('цели'), n: 3 },
      'мусор',
    ];
    const { client, updates } = fakeClient({
      clientConceptualization: [{ id: 'c1', history }],
    });

    const report = await b.rotate.rotateAll(client, { targets: [] });

    expect(report).toEqual({ rows: 1, failed: [] });
    expect(updates).toHaveLength(1);
    expect(updates[0].where).toEqual({
      id: 'c1',
      history: { equals: history },
    });
    const [snap, junk] = updates[0].data.history as Array<Row | string>;
    expect(junk).toBe('мусор');
    const s = snap as Row;
    expect(s.savedAt).toBe('2026-10-01');
    expect(s.n).toBe(3);
    expect(load(KEY_B).crypto.decrypt(s.goals as string)).toBe('цели');
  });

  it('нечитаемое поле снапшота попадает в failed', async () => {
    const c = load(KEY_C);
    const b = load(KEY_B, KEY_A);
    const { client } = fakeClient({
      clientConceptualization: [
        { id: 'c1', history: [{ goals: c.crypto.encrypt('потеряно') }] },
      ],
    });

    const report = await b.rotate.rotateAll(client, { targets: [] });

    expect(report.failed).toEqual([
      'clientConceptualization.history (не расшифровалось: 1)',
    ]);
  });
});

describe('summarize', () => {
  const { rotate } = load(KEY_B);

  it('успех: можно убирать старый ключ', () => {
    expect(rotate.summarize({ rows: 12, failed: [] })).toBe(
      'Готово: перешифровано строк — 12. ENCRYPTION_KEY_OLD можно убирать.',
    );
  });

  it('провал: перечисляет «НЕ ротировано» и запрещает убирать старый ключ', () => {
    const text = rotate.summarize({
      rows: 3,
      failed: ['userSafePlace', 'user'],
    });
    expect(text).toContain(
      'НЕ ротировано: [userSafePlace, user]. Перешифровано строк — 3.',
    );
    expect(text).toContain('ENCRYPTION_KEY_OLD НЕ убирать');
  });
});
