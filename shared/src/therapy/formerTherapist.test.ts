import { describe, it, expect } from 'vitest';
import { formerTherapistText, formerTherapistTitle } from './formerTherapist';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;

describe('formerTherapist: тексты сообщения о бывшем терапевте', () => {
  it('заголовок называет терапевта по имени', () => {
    expect(formerTherapistTitle('Анна')).toBe(
      'Анна больше не работает в приложении как терапевт',
    );
  });

  it('пустое имя (и одни пробелы) — без имени', () => {
    for (const name of ['', '   ']) {
      expect(formerTherapistTitle(name)).toBe(
        'Терапевт больше не работает в приложении',
      );
    }
  });

  it('текст в обеих формах обращения, «вы» — без «ты»-форм', () => {
    expect(formerTherapistText(trFor('ty'))).toBe(
      'Всё, что было сделано вместе, остаётся у тебя. Подключить другого терапевта можно по коду.',
    );
    const vy = formerTherapistText(trFor('vy'));
    expect(vy).toBe(
      'Всё, что было сделано вместе, остаётся у вас. Подключить другого терапевта можно по коду.',
    );
    expect(vy).not.toMatch(/\bтеб[яе]\b|\bты\b/);
  });
});
