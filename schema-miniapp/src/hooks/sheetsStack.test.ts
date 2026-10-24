import { describe, expect, it } from 'vitest';
import { OVERLAY_SHEET_KEYS } from './anyOverlayOpen';
import { dropOpen, pushOpen, topOverlayKey } from './sheetsStack';
import { initialState, type SheetKey } from './useSheets';

const view = (open: SheetKey[], openOrder: SheetKey[] = open) => ({
  ...initialState,
  ...Object.fromEntries(open.map((k) => [k, true])),
  openOrder,
});

describe('pushOpen / dropOpen', () => {
  it('открытие кладёт ключ наверх', () => {
    expect(pushOpen(['tracker'], 'schemaInfo')).toEqual([
      'tracker',
      'schemaInfo',
    ]);
  });

  it('повторное открытие переносит ключ наверх, а не дублирует', () => {
    expect(pushOpen(['tracker', 'schemaInfo'], 'tracker')).toEqual([
      'schemaInfo',
      'tracker',
    ]);
  });

  it('закрытие убирает ключ; закрытие неоткрытого — no-op', () => {
    expect(dropOpen(['tracker', 'schemaInfo'], 'tracker')).toEqual([
      'schemaInfo',
    ]);
    expect(dropOpen(['tracker'], 'about')).toEqual(['tracker']);
  });
});

describe('topOverlayKey', () => {
  it('ничего не открыто — null', () => {
    expect(topOverlayKey(view([]))).toBeNull();
  });

  it('верхний — последний открытый', () => {
    expect(topOverlayKey(view(['tracker', 'schemaInfo']))).toBe('schemaInfo');
    expect(topOverlayKey(view(['schemaInfo', 'tracker']))).toBe('tracker');
  });

  it('закрытые ключи из порядка не учитываются', () => {
    const v = view(['tracker'], ['tracker', 'schemaInfo']);
    expect(topOverlayKey(v)).toBe('tracker');
  });

  it('открытый лист без записи в порядке закрывается последним', () => {
    expect(topOverlayKey(view(['about', 'tracker'], ['tracker']))).toBe(
      'tracker',
    );
    expect(topOverlayKey(view(['about'], []))).toBe('about');
  });

  it('экраны согласия приоритетнее листов, открытых позже', () => {
    expect(topOverlayKey(view(['addressPicker', 'trackerOverlay']))).toBe(
      'addressPicker',
    );
    expect(topOverlayKey(view(['joinConfirm', 'diaries']))).toBe('joinConfirm');
  });

  it('каждый ключ реестра становится верхним, когда открыт один', () => {
    for (const key of OVERLAY_SHEET_KEYS) {
      expect(topOverlayKey(view([key]))).toBe(key);
    }
  });
});
