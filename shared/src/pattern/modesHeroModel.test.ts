import { describe, it, expect } from 'vitest';
import { modesHeroModel } from './modesHeroModel';
import { INTRO_MODE_ID } from './weekPatternText';
import { hasTyForms } from '../utils/tyFormsSweep';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;
const summary = { id: INTRO_MODE_ID, days: 3, windowDays: 7 };

describe('modesHeroModel', () => {
  it('режимов нет: знакомство с Критиком и два входа — даже если сводка есть', () => {
    const m = modesHeroModel(ty, {
      hasModes: false,
      summary,
      canOpenDiary: true,
    });
    expect(m.kind).toBe('intro');
    if (m.kind !== 'intro') return;
    expect(m.intro.title).toBe('Встретить своего Критика');
    expect(m.library.label).toBe('Что такое режимы');
    expect(m.manual.sub).toBe('если уже знаешь свои режимы');
  });

  it('режимы есть и есть сводка: карточка недели с id режима', () => {
    const m = modesHeroModel(ty, {
      hasModes: true,
      summary,
      canOpenDiary: false,
    });
    expect(m).toMatchObject({
      kind: 'week',
      id: INTRO_MODE_ID,
      text: { label: 'Чаще всего включается' },
    });
  });

  it('сводка про режим, которого нет в справочнике, — не показываем ничего', () => {
    const m = modesHeroModel(ty, {
      hasModes: true,
      summary: { ...summary, id: 'nope' },
      canOpenDiary: true,
    });
    expect(m).toEqual({ kind: 'none' });
  });

  it('режимы есть, записей за неделю нет: строка про дневник; без дневника — пусто', () => {
    const m = modesHeroModel(ty, {
      hasModes: true,
      summary: null,
      canOpenDiary: true,
    });
    expect(m).toMatchObject({
      kind: 'diary',
      row: { label: 'Картина недели появится из дневника' },
    });
    expect(
      modesHeroModel(ty, {
        hasModes: true,
        summary: null,
        canOpenDiary: false,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('форма «вы»: ни одного «ты» ни в одном состоянии', () => {
    const states = [
      modesHeroModel(vy, {
        hasModes: false,
        summary: null,
        canOpenDiary: true,
      }),
      modesHeroModel(vy, { hasModes: true, summary, canOpenDiary: true }),
      modesHeroModel(vy, { hasModes: true, summary: null, canOpenDiary: true }),
    ];
    expect(hasTyForms(JSON.stringify(states))).toBe(false);
    expect(JSON.stringify(states)).toContain('замечайте моменты');
  });
});
