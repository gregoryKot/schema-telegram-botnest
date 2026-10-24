// Связь TherapyRelation → User в фейковой Prisma: `include: { client /
// therapist }` и фильтр по связанной записи в where (`therapist: { role: … }`).
// Generic makeTable (fake-prisma-engine.ts) джойнов не умеет: без include
// `rel.client` был бы `undefined`, и getAllTasksForTherapist молча терял бы
// задачи; без фильтра по связи where `therapist: {…}` сравнивался бы как поле
// строки и не находил ничего (former-therapist-info.ts, 2026-10-24).
import { makeTable, matches, type Row } from './fake-prisma-engine';

type Table = ReturnType<typeof makeTable>;
const RELATIONS = { client: 'clientId', therapist: 'therapistId' } as const;

export function withUserJoin(table: Table, userTable: Table) {
  const userOf = (id: unknown): Row | null =>
    userTable._rows.find((u) => u.id === id) ?? null;
  const join = (row: Row | null, include?: Row): Row | null => {
    if (!row || !include) return row;
    const result = { ...row };
    for (const [rel, key] of Object.entries(RELATIONS))
      if (include[rel]) result[rel] = userOf(row[key]);
    return result;
  };
  // Как Prisma: фильтр по to-one связи — условие на связанную запись; нет
  // записи — строка не подходит.
  const split = (where: Row = {}) => {
    const rest: Row = { ...where };
    const byRel: [string, Row][] = [];
    for (const [rel, key] of Object.entries(RELATIONS)) {
      if (rest[rel] === undefined) continue;
      byRel.push([key, rest[rel]]);
      delete rest[rel];
    }
    const ok = (row: Row) =>
      byRel.every(([key, cond]) => {
        const u = userOf(row[key]);
        return u !== null && matches(u, cond);
      });
    return { rest, ok, filtered: byRel.length > 0 };
  };
  const { findMany, findFirst, findUnique } = table;
  table.findMany = jest.fn(({ where, include, orderBy, take }: any = {}) => {
    const { rest, ok, filtered } = split(where);
    // Срез — после фильтра по связи, иначе take отрезал бы подходящие строки.
    const rows = (
      findMany({
        where: rest,
        orderBy,
        take: filtered ? undefined : take,
      }) as Row[]
    ).filter(ok);
    const cut =
      filtered && typeof take === 'number' ? rows.slice(0, take) : rows;
    return cut.map((r) => join(r, include));
  });
  table.findFirst = jest.fn(({ where, include }: any = {}) => {
    const { rest, ok, filtered } = split(where);
    const row = filtered
      ? ((findMany({ where: rest }) as Row[]).find(ok) ?? null)
      : (findFirst({ where: rest }) as Row | null);
    return join(row, include);
  });
  table.findUnique = jest.fn(({ where, include }: any = {}) =>
    join(findUnique({ where }), include),
  );
  return table;
}
