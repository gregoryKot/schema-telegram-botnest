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
});
