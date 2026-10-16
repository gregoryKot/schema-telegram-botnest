// Фикстуры коллизий по UNIQUE_RULES для test/merge-unique-rules.e2e-spec.ts.
// По одной записи на таблицу с unique-констрейнтом по userId: как создать
// строку с заданным ключом и как опознать «чья это строка» после merge.
// Колонки пишутся делегатами напрямую (без шифрования): merge переносит их
// SQL-ом как есть, читать обратно сервисами с decryptRecord здесь нельзя.
export interface UniqueFixture {
  /** Имя таблицы в UNIQUE_RULES (PascalCase). */
  table: string;
  /** Делегат Prisma (camelCase). */
  delegate: string;
  /** Данные строки: key 'a' — общий ключ коллизии, 'b' — другой ключ. */
  data: (userId: bigint, key: 'a' | 'b', mark: string) => object;
  /** По чему опознать строку после merge (у AppActivity метки нет — id). */
  markOf: (row: any) => string;
}

const D = '2026-03-01';
export const UNIQUE_FIXTURES: UniqueFixture[] = [
  {
    table: 'Rating',
    delegate: 'rating',
    data: (userId, key, mark) => ({
      userId,
      date: D,
      needId: key === 'a' ? 'safety' : 'play',
      value: Number(mark),
    }),
    markOf: (r) => String(r.value),
  },
  {
    table: 'Note',
    delegate: 'note',
    data: (userId, key, mark) => ({
      userId,
      date: key === 'a' ? D : '2026-03-02',
      text: mark,
    }),
    markOf: (r) => r.text,
  },
  {
    table: 'GratitudeDiaryEntry',
    delegate: 'gratitudeDiaryEntry',
    data: (userId, key, mark) => ({
      userId,
      date: key === 'a' ? D : '2026-03-02',
      items: [mark],
    }),
    markOf: (r) => r.items[0],
  },
  {
    table: 'AppActivity',
    delegate: 'appActivity',
    data: (userId, key) => ({ userId, date: key === 'a' ? D : '2026-03-02' }),
    markOf: (r) => String(r.id),
  },
  {
    table: 'YsqProgress',
    delegate: 'ysqProgress',
    data: (userId, _key, mark) => ({
      userId,
      answers: [1],
      page: Number(mark),
    }),
    markOf: (r) => String(r.page),
  },
  {
    table: 'YsqResult',
    delegate: 'ysqResult',
    data: (userId, _key, mark) => ({ userId, answers: [Number(mark)] }),
    markOf: (r) => String(r.answers[0]),
  },
  {
    table: 'UserSchemaNote',
    delegate: 'userSchemaNote',
    data: (userId, key, mark) => ({
      userId,
      schemaId: key === 'a' ? 'abandonment' : 'mistrust',
      triggers: mark,
    }),
    markOf: (r) => r.triggers,
  },
  {
    table: 'UserModeNote',
    delegate: 'userModeNote',
    data: (userId, key, mark) => ({
      userId,
      modeId: key === 'a' ? 'vulnerable-child' : 'angry-child',
      triggers: mark,
    }),
    markOf: (r) => r.triggers,
  },
  {
    table: 'UserSafePlace',
    delegate: 'userSafePlace',
    data: (userId, _key, mark) => ({ userId, description: mark }),
    markOf: (r) => r.description,
  },
  {
    table: 'ChildhoodRating',
    delegate: 'childhoodRating',
    data: (userId, key, mark) => ({
      userId,
      needId: key === 'a' ? 'safety' : 'play',
      value: Number(mark),
    }),
    markOf: (r) => String(r.value),
  },
  {
    table: 'DiaryDraft',
    delegate: 'diaryDraft',
    data: (userId, key, mark) => ({
      userId,
      type: key === 'a' ? 'schema' : 'mode',
      startedAt: new Date('2026-03-01T10:00:00Z'),
      data: { mark },
    }),
    markOf: (r) => r.data.mark,
  },
  {
    table: 'TherapistRequest',
    delegate: 'therapistRequest',
    data: (userId, _key, mark) => ({
      userId,
      fullName: mark,
      qualification: 'q',
      contacts: 'c',
    }),
    markOf: (r) => r.fullName,
  },
];
