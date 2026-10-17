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
