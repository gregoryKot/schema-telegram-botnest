// Юнит-часть к `start-payload.seam.spec.ts`: шов доказывает, ЧТО приходит от
// telegraf, а здесь — что мы разбираем это без сюрпризов.
import { readStartPayload } from './start-payload';

describe('readStartPayload', () => {
  it('берёт payload — поле, которое реально проставляет bot.command', () => {
    expect(readStartPayload({ payload: 'login_ABC' })).toBe('login_ABC');
  });

  it('понимает startPayload — на случай перехода на bot.start()', () => {
    expect(readStartPayload({ startPayload: 'src_seed1' })).toBe('src_seed1');
  });

  it('payload сильнее startPayload, если пришли оба', () => {
    expect(readStartPayload({ payload: 'a', startPayload: 'b' })).toBe('a');
  });

  it('пустая строка — это отсутствие payload, а не payload из нуля символов', () => {
    expect(readStartPayload({ payload: '' })).toBeUndefined();
  });

  it('пустой контекст и не-строка не роняют разбор', () => {
    expect(readStartPayload({})).toBeUndefined();
    expect(readStartPayload({ payload: 42 })).toBeUndefined();
  });
});
