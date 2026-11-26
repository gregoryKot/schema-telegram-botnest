// Дублёр `prisma.subscription.updateMany` для стейтфул-фейков подписок:
// учитывает предикаты `id`, `status.in` и `status.not` и возвращает число изменённых строк,
// как Postgres. Без него тест «отмена → вебхук» проверял бы мок, а не CAS.
export function subscriptionUpdateMany(subs: Map<number, any>) {
  return jest.fn(({ where, data }: any) => {
    const row = subs.get(where.id);
    const st = where.status;
    if (
      !row ||
      (st?.in && !st.in.includes(row.status)) ||
      (st?.not !== undefined && st.not === row.status)
    )
      return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
}
