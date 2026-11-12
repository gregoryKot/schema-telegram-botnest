import { describe, it, expect } from 'vitest';
import { hasLegacy, mergeLegacy, noteOf, setNote, setRating, withChildhood } from './wheelData';

// Правки колеса потребностей клиента (ClientConceptualization.needLinks): холст шлёт колесо
// целиком, поэтому каждая правка возвращает нормализованное колесо.

describe('wheelData — правки колеса', () => {
  it('оценка и текст пишутся по периоду и потребности, не задевая соседей; порядок — NEED_ORDER', () => {
    let l = setRating([], 'now', 'play', 7);
    l = setRating(l, 'child', 'attachment', 3);
    l = setNote(l, 'teen', 'play', 'Спорт');
    expect(l).toEqual([
      { needId: 'attachment', ratings: { child: 3 }, notes: {} },
      { needId: 'play', ratings: { now: 7 }, notes: { teen: 'Спорт' } },
    ]);
    expect(noteOf(l, 'teen', 'play')).toBe('Спорт');
    expect(noteOf(l, 'now', 'play')).toBe('');
  });

  it('снятая оценка и пустой текст стирают значение; потребность без данных выпадает из колеса', () => {
    const l = setNote(setRating([], 'now', 'play', 7), 'now', 'play', 'x');
    expect(setRating(l, 'now', 'play', undefined)).toEqual([{ needId: 'play', ratings: {}, notes: { now: 'x' } }]);
    expect(setNote(setRating(l, 'now', 'play', undefined), 'now', 'play', '')).toEqual([]);
  });

  it('правка не меняет исходное колесо (черновик поверх загруженного)', () => {
    const src = [{ needId: 'play', ratings: { now: 7 }, notes: {} }];
    setRating(src, 'now', 'play', 2);
    expect(src[0].ratings.now).toBe(7);
  });

  it('«Колесо детства» клиента перекрывает детство, мусор отбрасывает, остальные периоды не трогает', () => {
    const l = [{ needId: 'attachment', ratings: { child: 9, now: 5 }, notes: {} }, { needId: 'limits', ratings: { child: 2 }, notes: {} }];
    expect(withChildhood(l, { attachment: 3, play: 12, junk: 1 })).toEqual([
      { needId: 'attachment', ratings: { child: 3, now: 5 }, notes: {} },
      { needId: 'limits', ratings: { child: 2 }, notes: {} },
    ]);
  });
});

// Карты #1065 держали оценки и тексты в узле карты.
describe('wheelData — перенос из узла карты в концептуализацию', () => {
  const legacy = { ratings: { now: { attachment: 4, play: 6 }, child: { attachment: 1 } }, notes: { now: { play: 'Мало игры' } } };

  it('в узле есть оценки или тексты — есть что переносить; только вид — нет', () => {
    expect(hasLegacy(legacy)).toBe(true);
    expect(hasLegacy({})).toBe(false);
    expect(hasLegacy({ ratings: { now: {} } })).toBe(false);
    expect(hasLegacy(undefined)).toBe(false);
  });

  it('пустая концептуализация получает всё из узла', () => {
    expect(mergeLegacy([], legacy)).toEqual([
      { needId: 'attachment', ratings: { child: 1, now: 4 }, notes: {} },
      { needId: 'play', ratings: { now: 6 }, notes: { now: 'Мало игры' } },
    ]);
  });

  it('концептуализация сильнее: узел заполняет только пустые места', () => {
    const own = [{ needId: 'attachment', ratings: { now: 8 }, notes: {} }];
    const merged = mergeLegacy(own, legacy);
    expect(merged.find((l) => l.needId === 'attachment')?.ratings).toEqual({ child: 1, now: 8 });
    expect(merged.find((l) => l.needId === 'play')?.ratings).toEqual({ now: 6 });
  });

  it('повторный перенос ничего не меняет (можно убирать значения из карты)', () => {
    const once = mergeLegacy([], legacy);
    expect(mergeLegacy(once, legacy)).toEqual(once);
  });
});
