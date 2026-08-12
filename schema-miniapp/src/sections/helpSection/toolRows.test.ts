// toolRows — единственный источник строк блока «Инструменты» (для рендера
// и для листа настройки видимости). Проверяем: id уникальны и входят в
// реестр QuickActionId (сверка с utils/quickActions.ts, правило №4 —
// денормализованные реестры фиксируются тестом), порядок и тексты не
// изменились (регресс на дословные label — их видит и правит настройка).
import { describe, it, expect } from 'vitest';
import { buildToolRows } from './toolRows';
import { QUICK_ACTION_IDS } from '../../utils/quickActions';

const BASE_PROPS = {
  tasksCount: 0,
  practiceCount: null,
  planCount: null,
  childhoodDone: false,
};

describe('buildToolRows — реестр строк', () => {
  it('id уникальны', () => {
    const ids = buildToolRows(BASE_PROPS).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('каждый id ∈ QUICK_ACTION_IDS', () => {
    const registry = new Set<string>(QUICK_ACTION_IDS);
    for (const row of buildToolRows(BASE_PROPS)) {
      expect(registry.has(row.id)).toBe(true);
    }
  });

  it('порядок и подписи — ровно как были зашиты в ToolsList', () => {
    const rows = buildToolRows(BASE_PROPS);
    expect(rows.map((r) => [r.id, r.label])).toEqual([
      ['phrase_check', 'Критик или забота?'],
      ['tasks', 'Мои цели'],
      ['practices', 'Практики'],
      ['plans', 'Планы'],
      ['belief_check', 'Проверка убеждений'],
      ['safe_place', 'Безопасное место'],
      ['letter_to_self', 'Письмо себе'],
      ['flashcard', 'Схема включилась'],
      ['childhood_wheel', 'Колесо детства'],
      ['warm_words', 'Тёплые слова'],
    ]);
  });

  it('10 строк', () => {
    const rows = buildToolRows(BASE_PROPS);
    expect(rows).toHaveLength(10);
  });
});

describe('buildToolRows — динамические sub', () => {
  it('tasksCount=0 → «Нет активных», а не «0 целей»', () => {
    const rows = buildToolRows({ ...BASE_PROPS, tasksCount: 0 });
    expect(rows.find((r) => r.id === 'tasks')?.sub).toBe('Нет активных');
  });

  it('tasksCount=3 → «3 цели»', () => {
    const rows = buildToolRows({ ...BASE_PROPS, tasksCount: 3 });
    expect(rows.find((r) => r.id === 'tasks')?.sub).toBe('3 цели');
  });

  it('practiceCount=null → sub отсутствует (не выдуманный 0)', () => {
    const rows = buildToolRows({ ...BASE_PROPS, practiceCount: null });
    expect(rows.find((r) => r.id === 'practices')?.sub).toBeUndefined();
  });

  it('practiceCount=0 → «Нет практик»', () => {
    const rows = buildToolRows({ ...BASE_PROPS, practiceCount: 0 });
    expect(rows.find((r) => r.id === 'practices')?.sub).toBe('Нет практик');
  });

  it('planCount=0 → «История пуста»', () => {
    const rows = buildToolRows({ ...BASE_PROPS, planCount: 0 });
    expect(rows.find((r) => r.id === 'plans')?.sub).toBe('История пуста');
  });

  it('childhoodDone переключает подпись «Колесо детства»', () => {
    const notDone = buildToolRows({ ...BASE_PROPS, childhoodDone: false });
    expect(notDone.find((r) => r.id === 'childhood_wheel')?.sub).toBe(
      'Займёт 2 минуты',
    );
    const done = buildToolRows({ ...BASE_PROPS, childhoodDone: true });
    expect(done.find((r) => r.id === 'childhood_wheel')?.sub).toBe(
      'Паттерны из прошлого',
    );
  });
});
