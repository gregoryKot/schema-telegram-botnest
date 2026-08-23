// @vitest-environment jsdom
// Регресс аудита 2026-08-22 (находка №1): раньше AppShell держал ОДИН общий
// <Suspense> и на разделах, и на всех тяжёлых шторках — пока грузился чанк
// шторки, React прятал под фолбэк весь boundary целиком, то есть и уже
// отрисованный раздел под ней. Тест воспроизводит ровно топологию AppShell:
// «основной контент» смонтирован отдельно от AppOverlays, каждая шторка
// внутри AppOverlays — своя Suspense-граница. Пока чанк SettingsSheet висит
// в pending, контент рядом обязан остаться на месте — не превратиться в
// LazyLoader/пустоту.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { AppOverlays } from './AppOverlays';
import { useOverlays } from './useOverlays';

vi.mock('../../api', () => ({ api: { resignTherapist: vi.fn() } }));

// SettingsSheet — контролируемо-медленный чанк: settingsMock.resolve()
// вызывается вручную из теста, имитируя момент, когда дозагрузка наконец
// пришла. Держатель резолвера — через vi.hoisted: фабрика vi.mock выполняется
// в отдельной изолированной области видимости, обычный `let` снаружи не
// шарит один и тот же биндинг между фабрикой и телом теста (резолвер внутри
// факtори остаётся «немым» для внешнего вызова) — vi.hoisted даёт общий
// объект, который виден и там, и там.
const settingsMock = vi.hoisted(() => {
  let resolve: () => void = () => {};
  const ready = new Promise<{ SettingsSheet: () => JSX.Element }>((res) => {
    resolve = () => res({ SettingsSheet: () => <div data-testid="settings-sheet">Настройки</div> });
  });
  return { resolve: () => resolve(), ready };
});
vi.mock('../SettingsSheet', () => settingsMock.ready);

// Остальные ленивые шторки в этом тесте не участвуют — резолвятся сразу,
// чтобы не шуметь в остальных ветках AppOverlays.
vi.mock('../PracticesScreen', () => ({ PracticesScreen: () => <div data-testid="practices-screen" /> }));
vi.mock('../PlansScreen', () => ({ PlansScreen: () => <div data-testid="plans-screen" /> }));
vi.mock('../SchemaInfoSheet', () => ({ SchemaInfoSheet: () => <div data-testid="schema-info-sheet" /> }));
vi.mock('../exercises/ChildhoodWheelEx', () => ({ ChildhoodWheelEx: () => <div data-testid="childhood-wheel" /> }));
vi.mock('../TherapistPrivacyDisclaimer', () => ({ TherapistPrivacyDisclaimer: () => <div data-testid="therapist-disclaimer" /> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Мини-хозяин: «основной контент» (уже отрисован) + AppOverlays рядом —
 *  та же топология, что в AppShell.tsx (канвас): сёстры, не вложенность. */
function Harness() {
  const ov = useOverlays();
  const [mounted] = useState(true);
  return (
    <MemoryRouter>
      {mounted && <div data-testid="main-content">Уже отрисованный раздел</div>}
      <button onClick={() => ov.setShowSettings(true)}>open-settings</button>
      <AppOverlays
        ov={ov}
        userRole="CLIENT"
        setUserRole={() => {}}
        displayName="Аня"
        setDisplayName={() => {}}
        therapistMode={false}
        switchTherapistMode={() => {}}
        navigate={() => {}}
        ratings={{}}
        setChildhoodRatings={() => {}}
        childhoodWheelPending={false}
        setChildhoodWheelPending={() => {}}
        todayDate="2026-08-23"
      />
    </MemoryRouter>
  );
}

describe('AppOverlays — Suspense-изоляция шторки от контента рядом', () => {
  it('пока грузится чанк SettingsSheet — контент рядом остаётся на месте, шторка появляется только после загрузки', async () => {
    render(<Harness />);
    expect(screen.getByTestId('main-content')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'open-settings' }));

    // Чанк ещё не пришёл — шторки нет, но контент рядом НЕ пропал (старый
    // баг: общий Suspense заменял его на LazyLoader целиком).
    expect(screen.queryByTestId('settings-sheet')).toBeNull();
    expect(screen.getByTestId('main-content')).toBeTruthy();

    settingsMock.resolve();
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeTruthy());
    // Контент рядом пережил догрузку шторки — не был размонтирован.
    expect(screen.getByTestId('main-content')).toBeTruthy();
  });
});
