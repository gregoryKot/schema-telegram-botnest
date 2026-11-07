import { describe, it, expect } from 'vitest';
import {
  formerTherapistText,
  formerTherapistTitle,
  type FormerTherapistReason,
} from './formerTherapist';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;
const TY = trFor('ty');
const VY = trFor('vy');
// Границы слова — руками: `\b` в JS знает только латиницу.
const TY_FORMS = /(^|[^а-яё])(ты|теб[яе]|тво[а-яё]*)(?![а-яё])/i;

describe('formerTherapist: терапевт отказался от роли (и ответ без причины)', () => {
  it('заголовок называет терапевта по имени', () => {
    expect(formerTherapistTitle({ name: 'Анна' }, TY)).toBe(
      'Анна больше не работает в приложении как терапевт',
    );
    expect(
      formerTherapistTitle({ name: 'Анна', reason: 'therapist_resigned' }, VY),
    ).toBe('Анна больше не работает в приложении как терапевт');
  });

  it('пустое имя (и одни пробелы) — без имени', () => {
    for (const name of ['', '   ']) {
      expect(formerTherapistTitle({ name }, TY)).toBe(
        'Терапевт больше не работает в приложении',
      );
    }
  });

  it('текст в обеих формах обращения, «вы» — без «ты»-форм', () => {
    expect(formerTherapistText({ name: 'Анна' }, TY)).toBe(
      'Всё, что было сделано вместе, остаётся у тебя. Подключить другого терапевта можно по коду.',
    );
    const vy = formerTherapistText({ name: 'Анна' }, VY);
    expect(vy).toBe(
      'Всё, что было сделано вместе, остаётся у вас. Подключить другого терапевта можно по коду.',
    );
    expect(vy).not.toMatch(TY_FORMS);
  });
});

// 2026-11-05: связь больше не удаляется молча — у каждой причины своя строка.
describe('formerTherapist: терапевт убрал клиента', () => {
  const info = { name: 'Анна', reason: 'therapist_removed' as const };

  it('заголовок честно говорит, что работы в приложении больше нет', () => {
    expect(formerTherapistTitle(info, TY)).toBe(
      'Анна больше не работает с тобой в приложении',
    );
    expect(formerTherapistTitle(info, VY)).toBe(
      'Анна больше не работает с вами в приложении',
    );
    expect(formerTherapistTitle({ ...info, name: ' ' }, TY)).toBe(
      'Терапевт больше не работает с тобой в приложении',
    );
  });

  it('текст: записи закрыты, задания — личные цели, снова — по новому коду', () => {
    expect(formerTherapistText(info, TY)).toBe(
      'Твои записи терапевту больше не видны. Открытые задания от терапевта теперь в твоих целях: выполнить их или убрать — решать тебе. Подключиться снова можно по новому коду.',
    );
  });
});

describe('formerTherapist: клиент отключился сам', () => {
  const info = { name: 'Анна', reason: 'client_left' as const };

  it('нейтрально: кто больше не видит записи, без драмы', () => {
    expect(formerTherapistTitle(info, TY)).toBe(
      'Анна больше не видит твои записи',
    );
    expect(formerTherapistTitle({ ...info, name: '' }, VY)).toBe(
      'Терапевт больше не видит ваши записи',
    );
    expect(formerTherapistText(info, TY)).toBe(
      'Связь отключена. Открытые задания от терапевта теперь в твоих целях: выполнить их или убрать — решать тебе. Подключиться снова можно по новому коду.',
    );
  });
});

describe('formerTherapist: форма «вы» у каждой причины', () => {
  const reasons: (FormerTherapistReason | undefined)[] = [
    undefined,
    'therapist_resigned',
    'therapist_removed',
    'client_left',
  ];
  it.each(reasons)('%s — ни одной «ты»-формы', (reason) => {
    const info = { name: 'Анна', reason };
    expect(formerTherapistTitle(info, VY)).not.toMatch(TY_FORMS);
    expect(formerTherapistText(info, VY)).not.toMatch(TY_FORMS);
    // Контрольный образец: та же проверка на форме «ты» срабатывает.
    expect(formerTherapistText(info, TY)).toMatch(TY_FORMS);
  });
});
