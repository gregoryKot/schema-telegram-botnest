import { describe, it, expect } from 'vitest';
import { nextUnrated, summarizeDay, lowestObservation, completionHeadline } from './trackerFlow';

const IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

describe('nextUnrated', () => {
  it('идёт вперёд к ближайшей неоценённой, оценённые пропускает', () => {
    expect(nextUnrated(IDS, { autonomy: 4 }, 0, false)).toBe(2);
    expect(nextUnrated(IDS, {}, 1, false)).toBe(2);
  });

  it('без wrap на последней — null; с wrap возвращается к пропущенной раньше', () => {
    expect(nextUnrated(IDS, { attachment: 0 }, 4, false)).toBeNull();
    expect(nextUnrated(IDS, { autonomy: 4, expression: 4, play: 4, limits: 4 }, 4, true)).toBe(0);
  });

  it('все оценены — null даже с wrap; ноль считается «не оценено»', () => {
    const all = Object.fromEntries(IDS.map((id) => [id, 6]));
    expect(nextUnrated(IDS, all, 2, true)).toBeNull();
    expect(nextUnrated(IDS, { ...all, play: 0 }, 0, true)).toBe(3);
  });

  it('текущая только что оценена, а остальные нет — идёт к следующей, не стоит на месте', () => {
    expect(nextUnrated(IDS, { attachment: 8 }, 0, true)).toBe(1);
  });
});

describe('summarizeDay', () => {
  it('оценены все: индекс и самая низкая потребность', () => {
    const s = summarizeDay(IDS, { attachment: 8, autonomy: 6, expression: 4, play: 10, limits: 6 });
    expect(s).toEqual({ filled: 5, total: 5, index: 6.8, lowestId: 'expression' });
  });

  it('при равенстве самой низкой берётся первая по порядку потребностей', () => {
    const s = summarizeDay(IDS, { attachment: 8, autonomy: 8, expression: 6, play: 6, limits: 10 });
    expect(s.lowestId).toBe('expression');
    // порядок NEED_ORDER, а не порядок ключей в объекте оценок
    const s2 = summarizeDay(['limits', 'play'], { play: 4, limits: 4 });
    expect(s2.lowestId).toBe('play');
  });

  it('оценены не все: ни индекса, ни «самой низкой» — не выдумываем', () => {
    expect(summarizeDay(IDS, { attachment: 8, autonomy: 2 })).toEqual({ filled: 2, total: 5, index: null, lowestId: null });
    expect(summarizeDay(IDS, {})).toEqual({ filled: 0, total: 5, index: null, lowestId: null });
  });

  it('ноль не считается оценкой', () => {
    expect(summarizeDay(IDS, { attachment: 0, autonomy: 6 }).filled).toBe(1);
  });
});

describe('lowestObservation', () => {
  it('название в нижнем регистре, остальное дословно', () => {
    expect(lowestObservation('Привязанность')).toBe(
      'Ниже всего — привязанность. Не вывод, а точка: посмотрим, повторится ли.',
    );
  });
});

describe('completionHeadline', () => {
  it('оценены не все — «N из M» и подпись «заполнено», без индекса', () => {
    expect(completionHeadline(4, 5, null)).toEqual({ big: '4 из 5', caption: 'заполнено', aria: 'Заполнено 4 из 5' });
  });

  it('оценены все — индекс с запятой и подпись «индекс дня из 10»', () => {
    expect(completionHeadline(5, 5, 7.2)).toEqual({ big: '7,2', caption: 'индекс дня из 10', aria: 'Индекс дня 7,2 из 10' });
  });
});
