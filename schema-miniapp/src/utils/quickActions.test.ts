// Гейт-тест «универсальности плюса» (правило «правило без принуждения не
// работает», CLAUDE.md): любая быстрая практика/главное дело дня обязана
// быть достижима из кнопки «плюс» — иначе меню снова начнёт расходиться с
// реестрами, из которых собрано (как было раньше: 4 пункта зашиты вручную).
//
// Плюс — гейт на «один дом на действие» (свод дублей шести упражнений,
// 2026-08): раньше belief_check/phrase_check/flashcard/safe_place/
// letter_to_self/warm_words были показаны ОДНОВРЕМЕННО на «плюсе» и в
// «Инструментах» — сверка ниже падает, если дубль появится снова.
import { describe, it, expect } from 'vitest';
import {
  QUICK_ACTION_IDS,
  QUICK_ACTIONS,
  buildPlusActions,
  focusToQuickAction,
  type QuickActionId,
} from './quickActions';
import { buildToolRows } from '../sections/helpSection/toolRows';
import { QUICK_PRACTICE_IDS } from '../../../shared/src/practices/quickPractices';
import { FOCUS_OPTIONS } from './todayFocus';

const tr = (ty: string) => ty;

const TOOL_ROWS_BASE_PROPS = {
  tasksCount: 0,
  practiceCount: null,
  planCount: null,
  childhoodDone: false,
};

function plusActionIds(): QuickActionId[] {
  return buildPlusActions(tr).flatMap((g) => g.actions.map((a) => a.id));
}

function toolActionIds(): QuickActionId[] {
  return buildToolRows(TOOL_ROWS_BASE_PROPS).map((r) => r.id);
}

describe('QUICK_ACTION_IDS — реестр', () => {
  it('id уникальны', () => {
    const ids = [...QUICK_ACTION_IDS];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('у каждого id реестра есть определение в QUICK_ACTIONS', () => {
    const defined = new Set(QUICK_ACTIONS.map((a) => a.id));
    for (const id of QUICK_ACTION_IDS) expect(defined.has(id)).toBe(true);
  });
});

describe('QUICK_ACTIONS — ровно один дом на действие (регресс дублей)', () => {
  it('«плюс» и «Инструменты» не пересекаются', () => {
    const plus = new Set(plusActionIds());
    const tools = new Set(toolActionIds());
    const overlap = [...plus].filter((id) => tools.has(id));
    expect(overlap).toEqual([]);
  });

  it('объединение «плюса» и «Инструментов» покрывает весь реестр ровно по разу', () => {
    const combined = [...plusActionIds(), ...toolActionIds()].sort();
    const registry = [...QUICK_ACTION_IDS].sort();
    expect(combined).toEqual(registry);
  });

  it('шесть упражнений (было — дубль) показаны только в «Инструментах»', () => {
    const duplicated: QuickActionId[] = [
      'belief_check',
      'phrase_check',
      'flashcard',
      'safe_place',
      'letter_to_self',
      'warm_words',
    ];
    const plus = plusActionIds();
    const tools = toolActionIds();
    for (const id of duplicated) {
      expect(plus).not.toContain(id);
      expect(tools).toContain(id);
    }
  });
});

describe('buildPlusActions — покрытие быстрых практик (QuickPracticeId)', () => {
  it('каждая QuickPracticeId присутствует среди действий «плюса»', () => {
    const ids = plusActionIds();
    for (const practiceId of QUICK_PRACTICE_IDS) {
      expect(ids).toContain(practiceId);
    }
  });
});

describe('buildPlusActions — все id входят в реестр QUICK_ACTION_IDS', () => {
  it('каждое plus-действие ∈ QUICK_ACTION_IDS', () => {
    const registry = new Set<string>(QUICK_ACTION_IDS);
    for (const id of plusActionIds()) {
      expect(registry.has(id)).toBe(true);
    }
  });

  it('id действий внутри «плюса» уникальны', () => {
    const ids = plusActionIds();
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildPlusActions — новый пункт «Что это было» (разбор случая)', () => {
  it('первая группа, первый пункт — case, с ожидаемыми label/sub', () => {
    const groups = buildPlusActions(tr);
    expect(groups[0].actions[0]).toEqual({
      id: 'case',
      label: 'Что это было',
      sub: 'Разобрать момент, который задел',
    });
  });
});

describe('focusToQuickAction — покрытие «главного дела дня» (FocusPractice)', () => {
  it('каждая FocusPractice замаплена на действие плюса', () => {
    for (const opt of FOCUS_OPTIONS) {
      expect(focusToQuickAction[opt.id]).toBeDefined();
    }
  });

  it('явный маппинг: tracker/schema/mode/gratitude → свои действия', () => {
    expect(focusToQuickAction.tracker).toBe('tracker');
    expect(focusToQuickAction.schema).toBe('diary_schema');
    expect(focusToQuickAction.mode).toBe('diary_mode');
    expect(focusToQuickAction.gratitude).toBe('diary_gratitude');
  });

  it('результат маппинга — реально существующее plus-действие', () => {
    const ids = plusActionIds();
    for (const opt of FOCUS_OPTIONS) {
      expect(ids).toContain(focusToQuickAction[opt.id]);
    }
  });
});
