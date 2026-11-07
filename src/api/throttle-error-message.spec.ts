// Срок в тексте 429 берётся из счётчика, а не пишется «через минуту»: окна
// троттлинга бывают от секунды до суток (см. шапку throttle-error-message.ts).
import { throttleErrorMessage } from './throttle-error-message';

const HEAD = 'Слишком много попыток подряд. Повторить можно';

describe('throttleErrorMessage', () => {
  it.each([
    [1, 0, 'через минуту'],
    [60, 0, 'через минуту'],
    [61, 0, 'через 2 минуты'],
    [5 * 60, 0, 'через 5 минут'],
    [21 * 60, 0, 'через 21 минуту'],
    [59 * 60, 0, 'через 59 минут'],
    [3_600, 0, 'через час'],
    [3_601, 0, 'через 2 часа'],
    [24 * 3_600, 0, 'через 24 часа'],
    [11 * 3_600, 0, 'через 11 часов'],
  ])('блок %i с → «%s»', (block, window, tail) => {
    expect(
      throttleErrorMessage({ timeToBlockExpire: block, timeToExpire: window }),
    ).toBe(`${HEAD} ${tail}`);
  });

  it('срок блока важнее окна счётчика: блок снимается по своему сроку', () => {
    expect(
      throttleErrorMessage({ timeToBlockExpire: 30, timeToExpire: 3_600 }),
    ).toBe(`${HEAD} через минуту`);
  });

  it('блока в записи нет — срок по окну счётчика', () => {
    expect(
      throttleErrorMessage({ timeToBlockExpire: 0, timeToExpire: 600 }),
    ).toBe(`${HEAD} через 10 минут`);
  });

  it('срок неизвестен — без выдуманной цифры', () => {
    expect(
      throttleErrorMessage({ timeToBlockExpire: 0, timeToExpire: 0 }),
    ).toBe(`${HEAD} чуть позже`);
    expect(
      throttleErrorMessage({ timeToBlockExpire: NaN, timeToExpire: NaN }),
    ).toBe(`${HEAD} чуть позже`);
  });

  it('ни латиницы, ни имени исключения', () => {
    const text = throttleErrorMessage({
      timeToBlockExpire: 60,
      timeToExpire: 60,
    });
    expect(text).not.toMatch(/[A-Za-z]/);
  });
});
