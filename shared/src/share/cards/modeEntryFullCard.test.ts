// @vitest-environment jsdom
// Тест раскладки полей полной карточки: фильтрация пустых, порядок (шаги
// дневника, ЗВ последним), подписи. drawModeEntryFullCard проверяется
// отдельно ниже с подменённым 2d-контекстом (jsdom его не реализует, см.
// комментарий practiceCard.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  modeEntryFullFields,
  hasModeEntryFullContent,
  modeEntryShareOptions,
  drawModeEntryFullCard,
} from './modeEntryFullCard';
import type { ModeEntryMode } from './modeEntryCard';

function mockCtx() {
  return {
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const MODE: ModeEntryMode = {
  name: 'Уязвимый ребёнок',
  emoji: '🥹',
  groupName: 'Ребёнок',
  groupColor: '#5aa8f7',
};

describe('modeEntryFullFields', () => {
  it('пустая запись (только обязательная ситуация) → одно поле', () => {
    const fields = modeEntryFullFields({ situation: 'Позвонил папа' });
    expect(fields).toEqual([{ label: 'Ситуация', text: 'Позвонил папа' }]);
  });

  it('пустые/пробельные поля отфильтрованы', () => {
    const fields = modeEntryFullFields({
      situation: 'Позвонил папа',
      thoughts: '   ',
      feelings: '',
      bodyFeelings: null,
      actions: undefined,
    });
    expect(fields).toEqual([{ label: 'Ситуация', text: 'Позвонил папа' }]);
  });

  it('порядок соответствует шагам дневника, ЗВ — последним', () => {
    const fields = modeEntryFullFields({
      childhoodMemories: 'мама приходила уставшая',
      healthyResponse: 'я имею право на отдых',
      situation: 'Позвонил папа',
      feelings: 'пустота',
    });
    expect(fields.map((f) => f.label)).toEqual([
      'Ситуация',
      'Чувства',
      'Откуда знакомо',
      'Здоровый Взрослый',
    ]);
  });

  it('все поля заполнены → все 8 в правильном порядке', () => {
    const fields = modeEntryFullFields({
      situation: 'ситуация',
      thoughts: 'мысли',
      feelings: 'чувства',
      bodyFeelings: 'тело',
      actions: 'действия',
      actualNeed: 'что нужно',
      childhoodMemories: 'откуда знакомо',
      healthyResponse: 'ЗВ',
    });
    expect(fields.map((f) => f.label)).toEqual([
      'Ситуация',
      'Мысли',
      'Чувства',
      'Тело',
      'Действия',
      'Что было нужно',
      'Откуда знакомо',
      'Здоровый Взрослый',
    ]);
  });

  it('текст обрезается по пробелам (trim)', () => {
    const fields = modeEntryFullFields({
      situation: '  с пробелами по краям  ',
    });
    expect(fields[0].text).toBe('с пробелами по краям');
  });
});

describe('hasModeEntryFullContent', () => {
  it('заполнена только ситуация (обязательное поле дневника) — true: она не healthyResponse', () => {
    expect(hasModeEntryFullContent({ situation: 'Позвонил папа' })).toBe(true);
  });

  it('заполнен только healthyResponse (ситуации нет) — false', () => {
    expect(
      hasModeEntryFullContent({ healthyResponse: 'я имею право на отдых' }),
    ).toBe(false);
  });

  it('ситуация + healthyResponse — true (ситуация уже за рамками короткой карточки)', () => {
    expect(
      hasModeEntryFullContent({
        situation: 'Позвонил папа',
        healthyResponse: 'я имею право на отдых',
      }),
    ).toBe(true);
  });

  it('нет ситуации, но заполнено другое поле — true', () => {
    expect(hasModeEntryFullContent({ feelings: 'пустота' })).toBe(true);
  });

  it('ничего не заполнено (или только пробелы) — false', () => {
    expect(hasModeEntryFullContent({ thoughts: '   ' })).toBe(false);
    expect(hasModeEntryFullContent({})).toBe(false);
  });
});

describe('modeEntryShareOptions', () => {
  it('нет mode → ни одной опции, даже если данные есть', () => {
    const o = modeEntryShareOptions(
      undefined,
      'я имею право на отдых',
      { situation: 'Позвонил папа' },
      't.me/TestBot',
    );
    expect(o).toEqual({
      hasHealthy: false,
      hasFull: false,
      shortProps: null,
      fullProps: null,
    });
  });

  it('только healthyResponse → только краткая опция', () => {
    const o = modeEntryShareOptions(
      MODE,
      'я имею право на отдых',
      undefined,
      't.me/TestBot',
    );
    expect(o.hasHealthy).toBe(true);
    expect(o.hasFull).toBe(false);
    expect(o.shortProps).not.toBeNull();
    expect(o.fullProps).toBeNull();
  });

  it('healthyResponse + заполненный entry → обе опции', () => {
    const o = modeEntryShareOptions(
      MODE,
      'я имею право на отдых',
      { situation: 'Позвонил папа', healthyResponse: 'я имею право на отдых' },
      't.me/TestBot',
    );
    expect(o.hasHealthy).toBe(true);
    expect(o.hasFull).toBe(true);
    expect(o.shortProps).not.toBeNull();
    expect(o.fullProps).not.toBeNull();
  });

  it('entry без healthyResponse → только опция полной записи', () => {
    const o = modeEntryShareOptions(
      MODE,
      null,
      { situation: 'Позвонил папа' },
      't.me/TestBot',
    );
    expect(o.hasHealthy).toBe(false);
    expect(o.hasFull).toBe(true);
    expect(o.shortProps).toBeNull();
    expect(o.fullProps).not.toBeNull();
  });

  it('ни healthyResponse, ни заполненного entry → ничего', () => {
    const o = modeEntryShareOptions(
      MODE,
      null,
      { situation: '' },
      't.me/TestBot',
    );
    expect(o.hasHealthy).toBe(false);
    expect(o.hasFull).toBe(false);
  });
});

describe('drawModeEntryFullCard', () => {
  it('несколько полей с датой — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawModeEntryFullCard(canvas, {
        color: '#5aa8f7',
        name: 'Уязвимый ребёнок',
        emoji: '🥹',
        dateLabel: '3 мая',
        fields: modeEntryFullFields({
          situation: 'Позвонил папа',
          feelings: 'пустота',
          healthyResponse: 'я имею право на отдых',
        }),
      }),
    ).not.toThrow();
  });

  it('без даты и с одним полем — компактнее, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawModeEntryFullCard(canvas, {
        color: '#5aa8f7',
        name: 'Уязвимый ребёнок',
        emoji: '🥹',
        fields: modeEntryFullFields({ situation: 'Позвонил папа' }),
      }),
    ).not.toThrow();
  });
});
