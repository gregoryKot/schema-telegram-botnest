import { activeRelationWhere } from './relation-where';

describe('activeRelationWhere', () => {
  it('реальный клиент — по паре therapistId/clientId, веб-id остаётся точным bigint', () => {
    expect(activeRelationWhere(7n, 1000000000000000123n)).toEqual({
      therapistId: 7n,
      clientId: 1000000000000000123n,
      status: 'active',
    });
  });

  it('виртуальный клиент — по id связи и clientId IS NULL (T4)', () => {
    expect(activeRelationWhere(7n, -42n)).toEqual({
      id: 42,
      therapistId: 7n,
      clientId: null,
      status: 'active',
    });
  });

  it('офлайн-id за int32 до Prisma не доходит: id 0, связи нет (S18)', () => {
    expect(activeRelationWhere(7n, -3000000000n)).toMatchObject({
      id: 0,
      clientId: null,
    });
    expect(activeRelationWhere(7n, -2147483647n).id).toBe(2147483647);
  });
});
