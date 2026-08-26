// @vitest-environment jsdom
// Тест раскладки полей карточки заметки (схема/режим): фильтрация пустых,
// подписи, порядок — плюс отрисовка с подменённым 2d-контекстом (jsdom его
// не реализует, см. комментарий practiceCard.test.ts). Главный инвариант —
// пустые поля не увеличивают высоту карточки (требование задачи).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  noteCardFields,
  drawNoteCard,
  SCHEMA_NOTE_FIELD_ORDER,
  MODE_NOTE_FIELD_ORDER,
  type NoteCardData,
} from './noteCard';
import { canvasWithMockCtx } from './canvas.test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('noteCardFields', () => {
  it('схема: только заполненные поля, в порядке шагов SchemaIntroSheet', () => {
    const fields = noteCardFields(SCHEMA_NOTE_FIELD_ORDER, {
      triggers: 'Когда критикуют',
      thoughts: '   ',
      reality: '',
      behavior: null,
      healthyView: undefined,
      feelings: 'Ком в горле',
    });
    expect(fields).toEqual([
      { label: 'Что включает', text: 'Когда критикуют' },
      { label: 'Что чувствую', text: 'Ком в горле' },
    ]);
  });

  it('схема: все 7 полей заполнены → все 7 в правильном порядке', () => {
    const fields = noteCardFields(SCHEMA_NOTE_FIELD_ORDER, {
      triggers: 'триггеры',
      feelings: 'чувства',
      thoughts: 'мысли',
      origins: 'откуда',
      reality: 'реальность',
      healthyView: 'ЗВ',
      behavior: 'поведение',
    });
    expect(fields.map((f) => f.label)).toEqual([
      'Что включает',
      'Что чувствую',
      'Какие мысли',
      'Откуда это',
      'Как на самом деле',
      'Взгляд Здорового Взрослого',
      'Что делаю',
    ]);
  });

  it('режим: порядок совпадает с buildModeIntroQuestions, needs подписан', () => {
    const fields = noteCardFields(MODE_NOTE_FIELD_ORDER, {
      triggers: 'триггеры',
      feelings: 'чувства',
      thoughts: 'мысли',
      behavior: 'поведение',
      modeFunction: 'функция',
      needs: 'потребность',
      needsMet: 'даёт ли',
      origins: 'откуда',
      healthyView: 'ЗВ',
    });
    expect(fields.map((f) => f.label)).toEqual([
      'Что включает',
      'Что чувствую',
      'Какие мысли',
      'Что делаю',
      'От чего защищает',
      'Что на самом деле нужно',
      'Даёт ли то, что нужно',
      'Откуда это',
      'Взгляд Здорового Взрослого',
    ]);
  });

  it('текст обрезается по пробелам (trim)', () => {
    const fields = noteCardFields(['triggers'], {
      triggers: '  с пробелами по краям  ',
    });
    expect(fields[0].text).toBe('с пробелами по краям');
  });

  it('ничего не заполнено → пустой массив', () => {
    expect(noteCardFields(SCHEMA_NOTE_FIELD_ORDER, {})).toEqual([]);
  });
});

const BASE: Omit<NoteCardData, 'fields'> = {
  color: '#5aa8f7',
  title: 'Покинутость',
  subtitle: 'Разрыв связи и отвержение',
};

describe('drawNoteCard', () => {
  it('полный набор полей — не падает, высота канваса > 0', () => {
    const { canvas } = canvasWithMockCtx();
    const fields = noteCardFields(SCHEMA_NOTE_FIELD_ORDER, {
      triggers: 'Когда не отвечают на сообщения',
      feelings: 'Тревога и ком в горле',
      thoughts: '«Меня бросят»',
      origins: 'Папа часто уезжал',
      reality: 'Друзья остаются рядом',
      healthyView: 'Сейчас я в безопасности',
      behavior: 'Пишу что чувствую',
    });
    expect(() => drawNoteCard(canvas, { ...BASE, fields })).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('одно поле — карточка ниже, чем с семью (пустые не растягивают высоту)', () => {
    const full = canvasWithMockCtx().canvas;
    const fullFields = noteCardFields(SCHEMA_NOTE_FIELD_ORDER, {
      triggers: 'Когда не отвечают на сообщения',
      feelings: 'Тревога и ком в горле',
      thoughts: '«Меня бросят»',
      origins: 'Папа часто уезжал',
      reality: 'Друзья остаются рядом',
      healthyView: 'Сейчас я в безопасности',
      behavior: 'Пишу что чувствую',
    });
    drawNoteCard(full, { ...BASE, fields: fullFields });

    const single = canvasWithMockCtx().canvas;
    const singleFields = noteCardFields(SCHEMA_NOTE_FIELD_ORDER, {
      triggers: 'Когда не отвечают на сообщения',
    });
    drawNoteCard(single, { ...BASE, fields: singleFields });

    expect(single.height).toBeLessThan(full.height);
  });

  it('без подзаголовка и без полей — не падает', () => {
    const { canvas } = canvasWithMockCtx();
    expect(() =>
      drawNoteCard(canvas, {
        color: '#5aa8f7',
        title: 'Покинутость',
        fields: [],
      }),
    ).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('очень длинный текст поля — не падает, обрезается (не растит высоту сверх лимита строк)', () => {
    const longText = Array(80).fill('очень длинное слово').join(' ');
    const { canvas: shortCanvas } = canvasWithMockCtx();
    drawNoteCard(shortCanvas, {
      ...BASE,
      fields: [{ label: 'Что включает', text: 'коротко' }],
    });

    const { canvas: longCanvas } = canvasWithMockCtx();
    expect(() =>
      drawNoteCard(longCanvas, {
        ...BASE,
        fields: [{ label: 'Что включает', text: longText }],
      }),
    ).not.toThrow();
    expect(longCanvas.height).toBeGreaterThan(0);
    // Клампится до MAX_LINES_PER_FIELD (5) строк — не растёт бесконечно с
    // ростом текста, разница высот ограничена, а не пропорциональна длине.
    expect(longCanvas.height - shortCanvas.height).toBeLessThan(
      shortCanvas.height,
    );
  });
});
