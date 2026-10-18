// Реестр быстрых действий, общий для сайта и мини-аппа: у каждого действия
// «плюса» есть группа, id реестра совпадают с определениями, форма «вы»
// доходит до подписи. Кросс-сверки с «Инструментами» и главным делом дня —
// в schema-miniapp/src/utils/quickActions.test.ts (им нужны модули мини-аппа).
import { describe, it, expect } from 'vitest';
import { QUICK_ACTION_IDS } from './quickActions';
import {
  QUICK_ACTIONS,
  buildPlusActions,
  getQuickAction,
} from './quickActionsRegistry';

describe('QUICK_ACTIONS', () => {
  it('определение есть у каждого id и только у них', () => {
    expect(QUICK_ACTIONS.map((a) => a.id).sort()).toEqual(
      [...QUICK_ACTION_IDS].sort(),
    );
  });

  it('у каждого действия «плюса» задана группа, у «Инструментов» — нет', () => {
    for (const a of QUICK_ACTIONS) {
      expect(Boolean(a.group)).toBe(a.surfaces.includes('plus'));
    }
  });

  it('getQuickAction возвращает определение по id', () => {
    expect(getQuickAction('tracker').label).toBe('Трекер потребностей');
  });

  it('getQuickAction на неизвестный id бросает', () => {
    expect(() => getQuickAction('nope' as never)).toThrow(/Неизвестное/);
  });
});

describe('buildPlusActions', () => {
  it('группы идут в заданном порядке, в каждой есть действия', () => {
    const groups = buildPlusActions((ty) => ty);
    expect(groups.map((g) => g.id)).toEqual([
      'case',
      'capture',
      'rate',
      'calm',
    ]);
    for (const g of groups) expect(g.actions.length).toBeGreaterThan(0);
  });

  it('подпись трекера разводится по ты/вы', () => {
    const sub = (tr: (a: string, b: string) => string) =>
      buildPlusActions(tr)
        .flatMap((g) => g.actions)
        .find((a) => a.id === 'tracker')!.sub;
    expect(sub((ty) => ty)).toBe('Оцени день по пяти шкалам');
    expect(sub((_, vy) => vy)).toBe('Оцените день по пяти шкалам');
  });
});
