// @vitest-environment jsdom
// Бутстрап тестов miniapp (TEST_COVERAGE_PLAN.md, этап 2 п.9): первый тест
// пакета — реестр видимости оверлеев useSheets.ts. Раньше на каждый оверлей
// был отдельный useState в App.tsx; useSheets свёл их в один reducer, чтобы
// open/close было унифицировано и не разъезжалось между экранами.
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSheets } from './useSheets';

describe('useSheets — начальное состояние', () => {
  it('все оверлеи закрыты, табы на дефолтах', () => {
    const { result } = renderHook(() => useSheets());
    expect(result.current.about).toBe(false);
    expect(result.current.schemaInfo).toBe(false);
    expect(result.current.settings).toBe(false);
    expect(result.current.practices).toBe(false);
    expect(result.current.plans).toBe(false);
    expect(result.current.todayNote).toBe(false);
    expect(result.current.pairSheet).toBe(false);
    expect(result.current.practicesOnboarding).toBe(false);
    expect(result.current.childhoodWheel).toBe(false);
    expect(result.current.tracker).toBe(false);
    expect(result.current.trackerOverlay).toBe(false);
    expect(result.current.trackerGoal).toBe(false);
    expect(result.current.diaries).toBe(false);
    expect(result.current.addressPicker).toBe(false);
    expect(result.current.schemaInitialTab).toBe('needs');
    expect(result.current.trackerTab).toBe('today');
    expect(result.current.trackerNeedId).toBeNull();
    expect(result.current.schemaHighlight).toBeUndefined();
  });
});

describe('useSheets — open/close без payload', () => {
  it('open переключает конкретный ключ в true, остальные не трогает', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('settings'));
    expect(result.current.settings).toBe(true);
    expect(result.current.practices).toBe(false);
    expect(result.current.about).toBe(false);
  });

  it('close переключает ключ обратно в false', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('practices'));
    expect(result.current.practices).toBe(true);
    act(() => result.current.close('practices'));
    expect(result.current.practices).toBe(false);
  });

  it('несколько оверлеев могут быть открыты одновременно (разные ключи)', () => {
    const { result } = renderHook(() => useSheets());
    act(() => {
      result.current.open('settings');
      result.current.open('about');
    });
    expect(result.current.settings).toBe(true);
    expect(result.current.about).toBe(true);
    act(() => result.current.close('settings'));
    expect(result.current.settings).toBe(false);
    expect(result.current.about).toBe(true); // close одного не гасит другой
  });
});

describe('useSheets — open/close с payload (доп. поля вроде трекер-таба)', () => {
  it('open с payload проставляет доп. поля вместе с флагом', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker', { trackerTab: 'history' }));
    expect(result.current.tracker).toBe(true);
    expect(result.current.trackerTab).toBe('history');
  });

  it('close с payload тоже применяет payload (напр. сброс trackerNeedId)', () => {
    const { result } = renderHook(() => useSheets());
    act(() =>
      result.current.open('trackerOverlay', { trackerNeedId: 'safety' }),
    );
    expect(result.current.trackerNeedId).toBe('safety');
    act(() => result.current.close('trackerOverlay', { trackerNeedId: null }));
    expect(result.current.trackerOverlay).toBe(false);
    expect(result.current.trackerNeedId).toBeNull();
  });

  it('payload не открывает и не закрывает другие ключи, кроме указанного sheet', () => {
    const { result } = renderHook(() => useSheets());
    act(() =>
      result.current.open('schemaInfo', {
        schemaInitialTab: 'schemas',
        schemaHighlight: 'abandonment',
      }),
    );
    expect(result.current.schemaInfo).toBe(true);
    expect(result.current.schemaInitialTab).toBe('schemas');
    expect(result.current.schemaHighlight).toBe('abandonment');
    expect(result.current.settings).toBe(false);
  });
});

describe('useSheets — стабильность идентичности open/close', () => {
  it('open и close — стабильные ссылки между рендерами (useCallback без deps)', () => {
    const { result, rerender } = renderHook(() => useSheets());
    const openBefore = result.current.open;
    const closeBefore = result.current.close;
    rerender();
    expect(result.current.open).toBe(openBefore);
    expect(result.current.close).toBe(closeBefore);
  });

  it('после реального изменения состояния open/close остаются той же ссылкой', () => {
    const { result } = renderHook(() => useSheets());
    const openBefore = result.current.open;
    act(() => result.current.open('plans'));
    expect(result.current.open).toBe(openBefore);
  });
});

describe('useSheets — независимость от Telegram API (санити)', () => {
  it('работает без window.Telegram — чистый reducer-хук, никаких side-эффектов', () => {
    expect(window.Telegram).toBeUndefined();
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('diaries'));
    expect(result.current.diaries).toBe(true);
  });
});
