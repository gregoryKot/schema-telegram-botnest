import { isUniqueViolation, uniqueViolationOn } from './unique-violation';

describe('isUniqueViolation', () => {
  it.each([
    ['Prisma P2002', { code: 'P2002' }],
    ['SQLSTATE 23505', { code: '23505' }],
    ['SQLSTATE в cause драйвера', { code: 'P2010', cause: { code: '23505' } }],
  ])('узнаёт: %s', (_n, e) => expect(isUniqueViolation(e)).toBe(true));

  it.each([
    ['другой код Prisma', { code: 'P2025' }],
    ['другой SQLSTATE в cause', { code: 'P2010', cause: { code: '40001' } }],
    ['обычная ошибка', new Error('boom')],
    ['null', null],
    ['строка', 'P2002'],
    ['undefined', undefined],
  ])('не узнаёт: %s', (_n, e) => expect(isUniqueViolation(e)).toBe(false));
});

describe('uniqueViolationOn — конфликт именно по этой колонке', () => {
  // Форма Prisma 7 с @prisma/adapter-pg: индекс в driverAdapterError.cause.
  const adapter = (constraint: object) => ({
    code: 'P2002',
    meta: {
      modelName: 'TherapyRelation',
      driverAdapterError: {
        cause: { kind: 'UniqueConstraintViolation', constraint },
      },
    },
  });

  it.each([
    ['индекс адаптера', adapter({ index: 'TherapyRelation_urlCode_key' })],
    ['поля адаптера в кавычках', adapter({ fields: ['"urlCode"'] })],
    ['meta.target полями', { code: 'P2002', meta: { target: ['urlCode'] } }],
    [
      'meta.target индексом',
      { code: 'P2002', meta: { target: 'TherapyRelation_urlCode_key' } },
    ],
    ['голый pg', { code: '23505', constraint: 'TherapyRelation_urlCode_key' }],
  ])('узнаёт urlCode: %s', (_n, e) =>
    expect(uniqueViolationOn(e, 'urlCode')).toBe(true),
  );

  it.each([
    ['индекс code', adapter({ index: 'TherapyRelation_code_key' })],
    ['активная пара', adapter({ index: 'TherapyRelation_active_pair_key' })],
    ['поле code', { code: 'P2002', meta: { target: ['code'] } }],
    ['без имени индекса', { code: 'P2002' }],
    [
      'не уникальность',
      { code: 'P2003', meta: { target: 'TherapyRelation_urlCode_key' } },
    ],
  ])('не узнаёт urlCode: %s', (_n, e) =>
    expect(uniqueViolationOn(e, 'urlCode')).toBe(false),
  );

  it('code и urlCode не путаются: индекс urlCode — не конфликт по code', () => {
    const e = adapter({ index: 'TherapyRelation_urlCode_key' });
    expect(uniqueViolationOn(e, 'code')).toBe(false);
  });
});
