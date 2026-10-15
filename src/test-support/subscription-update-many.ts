// Дублёр `prisma.subscription.updateMany` для стейтфул-фейков подписок:
// учитывает предикаты `id` и `status.in` и возвращает число изменённых строк,
// как Postgres. Без него тест «отмена → вебхук» проверял бы мок, а не CAS.
export function subscriptionUpdateMany(subs: Map<number, any>) {
  return jest.fn(({ where, data }: any) => {
    const row = subs.get(where.id);
    if (!row || (where.status?.in && !where.status.in.includes(row.status)))
      return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
}
