// where для активной связи терапевта с клиентом по «id клиента» из API.
//
// Виртуальный (офлайн) клиент кодируется отрицательным id = -TherapyRelation.id
// (в bigint — потому что весь контур, как и User.id, говорит bigint: веб-аккаунты
// живут выше 2^53, аудит 2026-10, X-1). `clientId: null` обязателен: иначе
// -id связи РЕАЛЬНОГО клиента проходил бы как «виртуальный» (T4).
export function activeRelationWhere(therapistId: bigint, clientId: bigint) {
  return clientId < 0n
    ? {
        id: Number(-clientId),
        therapistId,
        clientId: null,
        status: 'active' as const,
      }
    : { therapistId, clientId, status: 'active' as const };
}
