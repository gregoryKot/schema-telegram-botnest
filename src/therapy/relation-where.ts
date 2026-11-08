// where для активной связи терапевта с клиентом по «id клиента» из API.
// Офлайн-клиент — отрицательный id = -TherapyRelation.id (bigint, как User.id,
// аудит 2026-10, X-1). `clientId: null` обязателен: иначе -id связи РЕАЛЬНОГО
// клиента проходил бы как «виртуальный» (T4). id за int32 не существует и до
// Prisma не доходит (500, S18): вместо него — 0, которого у autoincrement нет.
const INT32_MAX = 2_147_483_647n;
export function activeRelationWhere(therapistId: bigint, clientId: bigint) {
  return clientId < 0n
    ? {
        id: -clientId <= INT32_MAX ? Number(-clientId) : 0,
        therapistId,
        clientId: null,
        status: 'active' as const,
      }
    : { therapistId, clientId, status: 'active' as const };
}
