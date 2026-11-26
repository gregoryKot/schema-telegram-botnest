// Сверка (правило №4): всё, что «плюс» показывает, сайт умеет открыть —
// либо оверлеем, либо трекером. Новое действие в общем реестре без решения
// площадки роняет тест, а не молча ничего не делает по тапу.
import { describe, it, expect } from 'vitest';
import { buildPlusActions } from '../../../../shared/src/quickActions/quickActions';
import { isOverlayQuickAction, OVERLAY_QUICK_ACTIONS } from './quickActionRouting';

describe('quickActionRouting', () => {
  it('каждое действие «плюса» открывается: оверлеем или трекером', () => {
    const ids = buildPlusActions((ty) => ty).flatMap((g) => g.actions.map((a) => a.id));
    const unrouted = ids.filter((id) => id !== 'tracker' && !isOverlayQuickAction(id));
    expect(unrouted).toEqual([]);
  });

  it('оверлеи — только действия «плюса» (инструменты и tracker сюда не попадают)', () => {
    const plus = buildPlusActions((ty) => ty).flatMap((g) => g.actions.map((a) => a.id));
    for (const id of OVERLAY_QUICK_ACTIONS) expect(plus).toContain(id);
    expect(isOverlayQuickAction('tracker')).toBe(false);
    expect(isOverlayQuickAction('belief_check')).toBe(false);
  });
});
