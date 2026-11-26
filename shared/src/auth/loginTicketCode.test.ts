import { describe, it, expect } from 'vitest';
import { formatUserCode } from './loginTicketCode';

describe('formatUserCode', () => {
  it('разбивает код пополам — так его сверяют глазами', () => {
    expect(formatUserCode('K7M2QX94')).toBe('K7M2-QX94');
  });

  // Зеркало бэкендового formatUserCode (src/telegram/login-payload.ts):
  // расхождение формата превратило бы сверку в «наверное, это оно».
  it('совпадает с тем, что показывает бот', () => {
    expect(formatUserCode('ABCD2345')).toBe('ABCD-2345');
  });
});
