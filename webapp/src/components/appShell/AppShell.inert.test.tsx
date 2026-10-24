// @vitest-environment jsdom
// AppShell — `inert` на контейнере секций (AppSections), пока открыт
// оверлей-сиблинг (аудит 2026-09): постоянный контент фона (напр. блок
// «Помощь рядом» внутри PracticeSection) оставался доступным табу и
// скринридеру сквозь открытый поверх него оверлей (каталог практик).
// Через реальный AppShell, а не мок AppSections — тест стоит на шве между
// AppShell (считает anyOverlayOpen) и AppSections (навешивает атрибут),
// а не проверяет только одну из сторон порознь (CLAUDE.md: «тесты стояли по
// обе стороны шва, но не на шве»).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderAppShell } from '../AppShell.test-helpers';

beforeEach(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error тестовый полифилл jsdom
  global.ResizeObserver = ResizeObserverStub;
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AppShell — inert на контейнере секций под открытым оверлеем', () => {
  it('оверлей закрыт → контейнер секций НЕ inert', async () => {
    renderAppShell('/today');
    const todaySection = await screen.findByTestId('today-section');
    expect(todaySection.closest('[inert]')).toBeNull();
  });

  it('открыт трекер (TrackerOverlay) → фон (today-section) получает inert-предка, сам оверлей — нет', async () => {
    renderAppShell('/today');
    await screen.findByTestId('today-section');
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    const trackerOverlay = await screen.findByTestId('tracker-overlay');

    expect(screen.getByTestId('today-section').closest('[inert]')).not.toBeNull();
    // Оверлей рендерится вне помеченного контейнера — не должен сам стать inert.
    expect(trackerOverlay.closest('[inert]')).toBeNull();
  });

  it('закрытие оверлея снимает inert с контейнера секций', async () => {
    renderAppShell('/today');
    await screen.findByTestId('today-section');
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await screen.findByTestId('tracker-overlay');
    expect(screen.getByTestId('today-section').closest('[inert]')).not.toBeNull();

    fireEvent.click(screen.getByTestId('tracker-overlay-close'));
    await waitFor(() => expect(screen.queryByTestId('tracker-overlay')).toBeNull());
    expect(screen.getByTestId('today-section').closest('[inert]')).toBeNull();
  });

  it('открыт SettingsSheet (внутри AppOverlays) → контейнер секций тоже inert, сам SettingsSheet — нет', async () => {
    renderAppShell('/today');
    await screen.findByTestId('today-section');
    fireEvent.click(screen.getByTestId('today-section-advanced'));
    const settingsSheet = await screen.findByTestId('settings-sheet');

    expect(screen.getByTestId('today-section').closest('[inert]')).not.toBeNull();
    expect(settingsSheet.closest('[inert]')).toBeNull();
  });
});
