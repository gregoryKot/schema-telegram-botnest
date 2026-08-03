// Тесты разбора записи теста на схемы для карточки «Моего пути»: профиль всех
// 20 схем рисуется только когда в записи есть средние баллы. У совсем старых
// записей их нет — карточка не должна показывать двадцать прочерков.
import { describe, it, expect } from 'vitest';
import { ysqResultFromEntry } from './journeyParts';
import { historyScoresByName } from '../hooks/ysqScoring';

const entry = (scores: { id: string; pct5plus: number; avg?: number }[]) => ({
  id: 1,
  completedAt: '2026-07-23',
  scores,
});

describe('ysqResultFromEntry', () => {
  it('запись со средними баллами превращается в счёт по названиям схем', () => {
    const res = ysqResultFromEntry(
      entry([
        { id: 'Покорность', pct5plus: 60, avg: 4.5 },
        { id: 'Неуспешность', pct5plus: 10, avg: 2 },
      ]),
    );
    expect(res).not.toBeNull();
    expect(res?.scores['Покорность']).toEqual({ pct5plus: 60, avg: 4.5 });
    expect(res?.activeCount).toBe(1);
  });

  it('старая запись без средних баллов — null (останется текстовая карточка)', () => {
    expect(
      ysqResultFromEntry(
        entry([
          { id: 'Покорность', pct5plus: 60 },
          { id: 'Неуспешность', pct5plus: 80 },
        ]),
      ),
    ).toBeNull();
  });

  it('пустой счёт, не тот объект и мусор — тоже null', () => {
    expect(ysqResultFromEntry(entry([]))).toBeNull();
    expect(ysqResultFromEntry({ scores: 'мусор' })).toBeNull();
    expect(ysqResultFromEntry(null)).toBeNull();
    expect(ysqResultFromEntry(undefined)).toBeNull();
  });

  it('нулевой средний балл не считается за данные', () => {
    expect(
      ysqResultFromEntry(entry([{ id: 'Покорность', pct5plus: 0, avg: 0 }])),
    ).toBeNull();
  });
});

describe('historyScoresByName', () => {
  it('ключ — название схемы, отсутствующий avg становится нулём', () => {
    const byName = historyScoresByName(
      entry([
        { id: 'Уязвимость', pct5plus: 30, avg: 3.2 },
        { id: 'Покорность', pct5plus: 70 },
      ]),
    );
    expect(byName).toEqual({
      Уязвимость: { pct5plus: 30, avg: 3.2 },
      Покорность: { pct5plus: 70, avg: 0 },
    });
  });
});

// ── buildJourneyResultParts / buildJourneyDetailParts ──────────────────────
// Разбор записи «Моего пути» в короткие карточки-части (share) и в полные
// детальные части (тап по записи). Ошибка = карточка показывает пустоту или
// чужое поле вместо настоящего текста записи — тестируем каждую ветку switch.
import {
  buildJourneyDetailParts,
  buildJourneyResultParts,
} from './journeyParts';

describe('buildJourneyResultParts', () => {
  it('schema_diary: ситуация + здоровый взгляд, пустые поля не создают частей', () => {
    expect(
      buildJourneyResultParts('schema_diary', {
        trigger: 'Молчание в переписке',
        healthyView: '',
      }),
    ).toEqual([{ title: 'Ситуация', text: 'Молчание в переписке' }]);
  });

  it('mode_diary: ситуация + что было нужно', () => {
    expect(
      buildJourneyResultParts('mode_diary', {
        situation: 'Опоздал на встречу',
        actualNeed: 'Поддержка, а не критика',
      }),
    ).toEqual([
      { title: 'Ситуация', text: 'Опоздал на встречу' },
      { title: 'Что было нужно', text: 'Поддержка, а не критика' },
    ]);
  });

  it('gratitude: не больше трёх пунктов, даже если items больше', () => {
    const parts = buildJourneyResultParts('gratitude', {
      items: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.text)).toEqual(['a', 'b', 'c']);
  });

  it('gratitude: нечисловые/пустые items отфильтрованы', () => {
    expect(
      buildJourneyResultParts('gratitude', { items: [1, null, 'кофе'] }),
    ).toEqual([{ text: 'кофе' }]);
  });

  it('belief_check: убеждение + переосмысление', () => {
    expect(
      buildJourneyResultParts('belief_check', {
        belief: 'Я всегда всё порчу',
        reframe: 'Ошибка — часть обучения',
      }),
    ).toEqual([
      { title: 'Убеждение', text: 'Я всегда всё порчу' },
      { title: 'Здоровый взгляд', text: 'Ошибка — часть обучения' },
    ]);
  });

  it('letter/note/safe_place: одна часть без заголовка', () => {
    expect(buildJourneyResultParts('letter', { text: 'Привет себе' })).toEqual(
      [{ title: undefined, text: 'Привет себе' }],
    );
    expect(buildJourneyResultParts('note', { text: 'заметка' })).toEqual([
      { title: undefined, text: 'заметка' },
    ]);
    expect(
      buildJourneyResultParts('safe_place', { description: 'лес у озера' }),
    ).toEqual([{ title: undefined, text: 'лес у озера' }]);
  });

  it('flashcard: напоминание + что делать', () => {
    expect(
      buildJourneyResultParts('flashcard', {
        reflection: 'Это пройдёт',
        action: 'Подышать 2 минуты',
      }),
    ).toEqual([
      { title: 'Напоминание себе', text: 'Это пройдёт' },
      { title: 'Что делать', text: 'Подышать 2 минуты' },
    ]);
  });

  it('practice/plan_done: одна часть со своим заголовком', () => {
    expect(
      buildJourneyResultParts('practice', { text: 'Прогулка' }),
    ).toEqual([{ title: 'Моя практика', text: 'Прогулка' }]);
    expect(
      buildJourneyResultParts('plan_done', { practiceText: 'Дыхание 4-7-8' }),
    ).toEqual([{ title: 'Практика', text: 'Дыхание 4-7-8' }]);
  });

  it('tracker_day: строка оценок в фиксированном порядке потребностей', () => {
    const [part] = buildJourneyResultParts('tracker_day', {
      limits: 6,
      attachment: 7,
      play: 4,
    });
    expect(part.title).toBe('Оценки дня (из 10)');
    expect(part.text).toBe('Привязанность — 7 · Спонтанность — 4 · Границы — 6');
  });

  it('tracker_day без единой оценки — пусто, а не выдуманные нули', () => {
    expect(buildJourneyResultParts('tracker_day', {})).toEqual([]);
  });

  it('schema_note/mode_note: несколько полей с подписями', () => {
    expect(
      buildJourneyResultParts('schema_note', {
        triggers: 'Критика от начальника',
        healthyView: 'Обратная связь — не приговор',
        behavior: 'Пауза перед ответом',
      }),
    ).toEqual([
      { title: 'Триггеры', text: 'Критика от начальника' },
      { title: 'Здоровый взгляд', text: 'Обратная связь — не приговор' },
      { title: 'Что помогает', text: 'Пауза перед ответом' },
    ]);
    expect(
      buildJourneyResultParts('mode_note', { needs: 'Побыть в тишине' }),
    ).toEqual([{ title: 'Что мне нужно', text: 'Побыть в тишине' }]);
  });

  it('ysq: число выраженных схем из scores; битые scores — пусто', () => {
    const [part] = buildJourneyResultParts('ysq', {
      scores: [
        { id: 'abandonment', pct5plus: 60 },
        { id: 'mistrust', pct5plus: 10 },
      ],
    });
    expect(part.text).toBe('Выраженных схем: 1 из 20');
    expect(buildJourneyResultParts('ysq', { scores: 'мусор' })).toEqual([]);
  });

  it('незнакомый тип и битый вход (не объект) — пусто, не падение', () => {
    expect(buildJourneyResultParts('unknown_type', { any: 1 })).toEqual([]);
    expect(buildJourneyResultParts('letter', null)).toEqual([]);
    expect(buildJourneyResultParts('letter', 'строка')).toEqual([]);
  });

  it('длинный текст обрезается многоточием (карточка не переполняется)', () => {
    const long = 'слово '.repeat(60).trim();
    const [part] = buildJourneyResultParts('letter', { text: long });
    expect(part.text.length).toBeLessThanOrEqual(221);
    expect(part.text.endsWith('…')).toBe(true);
  });
});

describe('buildJourneyDetailParts', () => {
  it('типы из DETAIL_FIELDS отдают ВСЕ заполненные поля без обрезки', () => {
    const long = 'слово '.repeat(60).trim();
    const parts = buildJourneyDetailParts('schema_diary', {
      trigger: 'Триггер',
      thoughts: '',
      healthyView: long,
    });
    expect(parts).toEqual([
      { title: 'Ситуация', text: 'Триггер' },
      { title: 'Здоровый взгляд', text: long }, // без «…» — детальный вид не режет
    ]);
  });

  it('gratitude в детальном виде — все пункты, а не только три', () => {
    expect(
      buildJourneyDetailParts('gratitude', {
        items: ['a', 'b', 'c', 'd'],
      }),
    ).toEqual([{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }]);
  });

  it('tracker_day/ysq без своих DETAIL_FIELDS падают на buildJourneyResultParts', () => {
    const detail = buildJourneyDetailParts('tracker_day', { attachment: 5 });
    const result = buildJourneyResultParts('tracker_day', { attachment: 5 });
    expect(detail).toEqual(result);
  });

  it('битый вход (не объект) — пусто', () => {
    expect(buildJourneyDetailParts('schema_diary', undefined)).toEqual([]);
  });
});
