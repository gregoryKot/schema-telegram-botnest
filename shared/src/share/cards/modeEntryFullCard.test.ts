// Тест раскладки полей полной карточки: фильтрация пустых, порядок (шаги
// дневника, ЗВ последним), подписи. Отрисовку канваса не тестируем (см.
// комментарий practiceCard.test.ts — canvas в jsdom не реализован).
import { describe, it, expect } from 'vitest';
import {
  modeEntryFullFields,
  hasModeEntryFullContent,
  modeEntryShareOptions,
} from './modeEntryFullCard';
import type { ModeEntryMode } from './modeEntryCard';

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
