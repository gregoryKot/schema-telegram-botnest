/**
 * Нарушение уникальности: Prisma-код P2002 либо SQLSTATE 23505 из драйвера
 * (сырой SQL и частичные индексы, которых нет в schema.prisma, приходят
 * вторым видом). Имена полей не разбираются: вызывающий сам знает, какой
 * индекс мог сработать.
 */
export function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { code?: unknown; cause?: { code?: unknown } };
  return (
    err.code === 'P2002' || err.code === '23505' || err.cause?.code === '23505'
  );
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);

/**
 * Нарушение уникальности именно по колонке `column` — для повтора, уместного
 * только на «своём» индексе. Где имя индекса или полей:
 * - Prisma 7 с `@prisma/adapter-pg` — `meta.driverAdapterError.cause.constraint`:
 *   `{ index: '<Модель>_<колонка>_key' }` либо `{ fields: ['"колонка"'] }`;
 * - Prisma без адаптера — `meta.target`; голый `pg` — `constraint`.
 * Форма с живого Postgres — test/therapy-invite.e2e-spec.ts.
 */
export function uniqueViolationOn(e: unknown, column: string): boolean {
  if (!isUniqueViolation(e)) return false;
  const err = e as {
    constraint?: unknown;
    cause?: { constraint?: unknown };
    meta?: {
      target?: unknown;
      driverAdapterError?: {
        cause?: { constraint?: { index?: unknown; fields?: unknown } };
      };
    };
  };
  const c = err.meta?.driverAdapterError?.cause?.constraint;
  const names = [
    c?.index,
    err.constraint,
    err.cause?.constraint,
    ...asList(c?.fields),
    ...asList(err.meta?.target),
  ];
  return names.some(
    (n) =>
      typeof n === 'string' &&
      (n.replace(/"/g, '') === column || n.endsWith(`_${column}_key`)),
  );
}
