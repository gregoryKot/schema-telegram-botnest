// Гейт-тест «универсальности плюса» (правило «правило без принуждения не
// работает», CLAUDE.md): любая быстрая практика/главное дело дня обязана
// быть достижима из кнопки «плюс» — иначе меню снова начнёт расходиться с
// реестрами, из которых собрано (как было раньше: 4 пункта зашиты вручную).
import { describe, it, expect } from 'vitest';
import {
  QUICK_ACTION_IDS,
  buildPlusActions,
  focusToQuickAction,
  type QuickActionId,
} from './quickActions';
import { QUICK_PRACTICE_IDS } from '../../../shared/src/practices/quickPractices';
import { FOCUS_OPTIONS } from './todayFocus';

const tr = (ty: string) => ty;

function plusActionIds(): QuickActionId[] {
  return buildPlusActions(tr).flatMap((g) => g.actions.map((a) => a.id));
}

describe('QUICK_ACTION_IDS — реестр', () => {
  it('id уникальны', () => {
    const ids = [...QUICK_ACTION_IDS];
    expect(new Set(ids).size).toBe(ids.length);
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
