// Маршрут задания по тапу — общий для «Сегодня», «Практики» сайта и «Помощи»
// мини-аппа. Регрессия 2026-10-26: «Сегодня» сайта открывало настройки вместо
// упражнения, а «Своё задание» не вело никуда (docs/INCIDENTS.md).
import { describe, it, expect } from 'vitest';
import { taskRoute, completesOnSave } from './taskRoute';

const route = (type: string, text = '') => taskRoute({ type, text });

describe('taskRoute', () => {
  it('серии ведут в дневник и трекер', () => {
    expect(route('diary_streak')).toEqual({ kind: 'diary' });
    expect(route('schema_diary')).toEqual({ kind: 'diary' });
    expect(route('mode_diary')).toEqual({ kind: 'diary' });
    expect(route('tracker_streak')).toEqual({ kind: 'tracker' });
  });

  it('каждый тип упражнения открывает своё упражнение, а не настройки', () => {
    for (const ex of [
      'belief_check',
      'letter_to_self',
      'safe_place',
      'flashcard',
    ]) {
      expect(route(ex, 'Проверить убеждение')).toEqual({
        kind: 'exercise',
        exercise: ex,
      });
    }
  });

  it('карточка схемы/режима несёт id; пустой текст — выбор из списка', () => {
    expect(route('schema_intro', 'abandonment')).toEqual({
      kind: 'schema',
      id: 'abandonment',
    });
    expect(route('mode_intro', 'invincible_oc')).toEqual({
      kind: 'mode',
      id: 'invincible_oc',
    });
    expect(route('schema_intro', '')).toEqual({
      kind: 'schema',
      id: undefined,
    });
  });

  it('старый формат: id схемы/режима в тексте своего задания', () => {
    expect(route('custom', 'abandonment')).toEqual({
      kind: 'schema',
      id: 'abandonment',
    });
    expect(route('custom', 'invincible_oc')).toEqual({
      kind: 'mode',
      id: 'invincible_oc',
    });
  });

  it('«Своё задание» — самоотметка; неизвестный тип — никуда', () => {
    expect(route('custom', 'позвонить другу')).toEqual({ kind: 'self' });
    expect(route('note', 'что-то')).toEqual({ kind: 'none' });
    expect(route('childhood_wheel')).toEqual({ kind: 'childhood_wheel' });
  });
});

describe('completesOnSave', () => {
  it('упражнения и карточки закрывают задание сохранением', () => {
    expect(completesOnSave(route('belief_check'))).toBe(true);
    expect(completesOnSave(route('flashcard'))).toBe(true);
    expect(completesOnSave(route('schema_intro', 'abandonment'))).toBe(true);
    expect(completesOnSave(route('custom', 'invincible_oc'))).toBe(true);
  });

  it('серии и своё задание — нет (их закрывают бэкенд и «Готово»)', () => {
    expect(completesOnSave(route('tracker_streak'))).toBe(false);
    expect(completesOnSave(route('diary_streak'))).toBe(false);
    expect(completesOnSave(route('custom', 'позвонить другу'))).toBe(false);
    expect(completesOnSave(route('note'))).toBe(false);
  });
});
