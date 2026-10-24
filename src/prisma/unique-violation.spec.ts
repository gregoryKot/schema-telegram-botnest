import { isUniqueViolation } from './unique-violation';

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
