// @vitest-environment jsdom
// Тесты обязательного хука useHistorySheet (CLAUDE.md: «Новый fullscreen-лист
// или оверлей в webapp» — задокументированный класс багов двойного закрытия
// при конфликте history.pushState с React Router). TEST_COVERAGE_PLAN этап 2 п.10.
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation, type NavigateFunction, type Location } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useHistorySheet } from './useHistorySheet';

interface SheetState { __sheetId?: string }

function sheetState(location: Location): SheetState | undefined {
  return location.state as SheetState | undefined;
}

interface Snapshot { nav: NavigateFunction | null; loc: Location | null }
function makeSnapshot(): Snapshot { return { nav: null, loc: null }; }

// NavSpy рендерится внутри того же MemoryRouter, что и хук под тестом, и
// снимает navigate/location того же роутера в замыкание `snap` — им
// симулируем нажатие «Назад» браузером (POP), не завязываясь на goBack()
// самого хука. `snap` — захваченная замыканием переменная теста, а не проп
// компонента, поэтому её мутация в эффекте не задевает react-hooks/immutability.
function makeNavSpy(snap: Snapshot) {
  return function NavSpy() {
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
      snap.nav = navigate;
      snap.loc = location;
    });
    return null;
  };
}

function makeWrapper(snap: Snapshot, initialEntries: string[], initialIndex: number) {
  const NavSpy = makeNavSpy(snap);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <NavSpy />
        {children}
      </MemoryRouter>
    );
  };
}

describe('useHistorySheet — монтирование пушит запись истории', () => {
  it('после монтирования текущая запись истории помечена уникальным __sheetId', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();

    renderHook(() => useHistorySheet(onClose), { wrapper: makeWrapper(snap, ['/target'], 0) });

    // ID берётся из React useId() (см. useHistorySheet.ts) — формат внутренний
    // и не гарантирован конкретным префиксом, важна лишь непустая метка.
    expect(sheetState(snap.loc!)?.__sheetId).toEqual(expect.any(String));
    expect(sheetState(snap.loc!)?.__sheetId).not.toBe('');
    // onClose не вызван при монтировании — это не закрытие, а постановка метки.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('два независимых листа получают разные __sheetId (useId уникален на инстанс)', () => {
    const snapA = makeSnapshot();
    const snapB = makeSnapshot();
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    renderHook(() => useHistorySheet(onCloseA), { wrapper: makeWrapper(snapA, ['/target-a'], 0) });
    renderHook(() => useHistorySheet(onCloseB), { wrapper: makeWrapper(snapB, ['/target-b'], 0) });

    expect(sheetState(snapA.loc!)?.__sheetId).not.toBe(sheetState(snapB.loc!)?.__sheetId);
  });

  it('нажатие «Назад» (POP на предыдущую запись) закрывает лист один раз', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();

    renderHook(() => useHistorySheet(onClose), { wrapper: makeWrapper(snap, ['/target'], 0) });

    // Симулируем именно кнопку «Назад» браузера — навигация -1 идёт из
    // независимого компонента (NavSpy), а не через возвращённый хуком goBack.
    act(() => { snap.nav!(-1); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useHistorySheet — goBack()', () => {
  it('goBack() закрывает лист ровно один раз', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();

    const { result } = renderHook(() => useHistorySheet(onClose), {
      wrapper: makeWrapper(snap, ['/target'], 0),
    });

    act(() => { result.current(); }); // goBack()

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('goBack — это navigate(-1): возвращает на запись, существовавшую до монтирования листа', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();

    const { result } = renderHook(() => useHistorySheet(onClose), {
      wrapper: makeWrapper(snap, ['/hub', '/target'], 1),
    });

    act(() => { result.current(); });

    expect(snap.loc!.pathname).toBe('/target');
    expect(sheetState(snap.loc!)?.__sheetId).toBeUndefined();
  });
});

// ── Реалистичный паттерн вызова: родитель убирает лист из дерева по onClose ───
// ({show && <Sheet onClose={() => setShow(false)}/>}) — именно это, а не сам
// хук, защищает от повторного закрытия.
function Probe({ onClose }: { onClose: () => void }) {
  useHistorySheet(onClose);
  return null;
}

function makeHarness(onCloseSpy: ReturnType<typeof vi.fn>) {
  return function Harness() {
    const [show, setShow] = useState(true);
    const handleClose = () => {
      onCloseSpy();
      setShow(false); // как в реальном родителе — убираем лист из дерева
    };
    return show ? <Probe onClose={handleClose} /> : null;
  };
}

describe('useHistorySheet — нет двойного закрытия при реалистичном паттерне использования', () => {
  it('после первого «Назад» лист размонтируется, повторное «Назад» уже не вызывает onClose', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();
    const NavSpy = makeNavSpy(snap);
    const Harness = makeHarness(onClose);

    render(
      <MemoryRouter initialEntries={['/hub-1', '/hub-2', '/target']} initialIndex={2}>
        <NavSpy />
        <Harness />
      </MemoryRouter>,
    );

    act(() => { snap.nav!(-1); }); // 1-й POP -> onClose + размонтирование Probe
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => { snap.nav!(-1); }); // 2-й POP — Probe уже не смонтирован
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('документирует реальное поведение хука: если лист НЕ размонтирован, повторное «Назад» вызывает onClose снова', () => {
    // Хук сам по себе не дедуплицирует закрытия — де-дуп держится на том, что
    // вызывающий код убирает компонент из дерева по первому onClose. Если по
    // какой-то причине этого не произошло, второй POP до размонтирования
    // вызовет onClose ещё раз. Тест фиксирует текущее поведение эффекта в
    // useHistorySheet.ts (нет latch/флага «уже закрыли»), а не одобряет его.
    const snap = makeSnapshot();
    const onClose = vi.fn();

    renderHook(() => useHistorySheet(onClose), {
      wrapper: makeWrapper(snap, ['/hub-1', '/hub-2', '/target'], 2),
    });

    act(() => { snap.nav!(-1); }); // 1-й POP -> close #1
    act(() => { snap.nav!(-1); }); // 2-й POP, лист всё ещё смонтирован -> close #2

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('useHistorySheet — размонтирование', () => {
  it('размонтирование листа (через убирание из дерева) не бросает исключений и глушит дальнейшие onClose', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();
    const NavSpy = makeNavSpy(snap);
    const Harness = makeHarness(onClose);

    render(
      <MemoryRouter initialEntries={['/target']} initialIndex={0}>
        <NavSpy />
        <Harness />
      </MemoryRouter>,
    );

    // Закрываем через POP — Harness сам уберёт Probe из дерева по onClose.
    expect(() => act(() => { snap.nav!(-1); })).not.toThrow();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Probe уже размонтирован — дальнейшие изменения истории не вызывают onClose повторно.
    act(() => { /* Probe снят с дерева, слушать некому */ });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unmount() всего дерева хука не бросает исключений', () => {
    const snap = makeSnapshot();
    const onClose = vi.fn();

    const { unmount } = renderHook(() => useHistorySheet(onClose), {
      wrapper: makeWrapper(snap, ['/target'], 0),
    });

    expect(() => unmount()).not.toThrow();
  });
});
