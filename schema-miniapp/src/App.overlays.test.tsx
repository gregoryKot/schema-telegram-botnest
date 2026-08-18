// @vitest-environment jsdom
// App.tsx — состояние оверлеев/шитов и режим терапевта: переключение
// (persist только для THERAPIST), выход из роли, refresh-key после закрытия
// оверлея, история потребностей грузится при открытии вкладки «история»,
// кнопка «Назад» браузера (web-хост без своей backButton) закрывает открытый
// оверлей вместо ухода со страницы. Дочерние секции/оверлеи — заглушки
// (App.test-helpers.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderApp, mockUseUserFlags } from './test-support/App.test-helpers';
import { defaultFlags, mockProfile } from './test-support/App.test-fixtures';
import { api } from './api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const THERAPIST_PROFILE = mockProfile({ role: 'THERAPIST', name: 'Др. Кто' });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockUseUserFlags.mockReturnValue(defaultFlags());
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('App — открытие/закрытие оверлея из sheets-реестра отражается в обоих детях', () => {
  it('open-tracker выставляет sheets.trackerOverlay=true в AppOverlays', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-sections-open-tracker'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.trackerOverlay).toBe(
        'true',
      ),
    );
  });

  it('close-tracker-overlay закрывает его обратно', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-sections-open-tracker'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.trackerOverlay).toBe(
        'true',
      ),
    );
    fireEvent.click(screen.getByTestId('app-overlays-close-tracker-overlay'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.trackerOverlay).toBe(
        'false',
      ),
    );
  });
});

describe('App — открытие истории трекера подгружает реальную историю с бэкенда', () => {
  it('open-tracker-history вызывает api.history и передаёт результат в TrackerHistoryOverlay', async () => {
    mockApi.history.mockResolvedValueOnce([
      { date: '2026-01-01', ratings: { attachment: 5 } },
    ]);
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-sections-open-tracker-history'));
    await waitFor(() => expect(mockApi.history).toHaveBeenCalledWith(30));
    await waitFor(() =>
      expect(
        Number(
          screen.getByTestId('tracker-history-overlay').dataset.historyCount,
        ),
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getByTestId('tracker-history-overlay').dataset.historyLoading,
    ).toBe('false');
  });
});

describe('App — переключение режима терапевта: persist только для роли THERAPIST', () => {
  it('CLIENT переключает therapistMode локально, но api.setTherapistView НЕ вызывает (сервер отверг бы 403)', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-overlays-toggle-therapist'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.therapistMode).toBe(
        'true',
      ),
    );
    expect(mockApi.setTherapistView).not.toHaveBeenCalled();
  });

  it('THERAPIST переключает режим и запрос persist уходит на сервер', async () => {
    mockApi.getProfile.mockResolvedValueOnce(THERAPIST_PROFILE);
    localStorage.setItem('therapist_mode', '0');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.userRole).toBe(
        'THERAPIST',
      ),
    );
    fireEvent.click(screen.getByTestId('app-overlays-toggle-therapist'));
    await waitFor(() =>
      expect(mockApi.setTherapistView).toHaveBeenCalledWith(true),
    );
    // localStorage пишется отдельным эффектом, а не в обработчике клика:
    // синхронная проверка успевает раньше записи и роняет тест под нагрузкой
    // CI (реальное падение 2026-08 — «expected '0' to be '1'»).
    await waitFor(() =>
      expect(localStorage.getItem('therapist_mode')).toBe('1'),
    );
  });
});

describe('App — выход из роли терапевта (resignTherapist) возвращает в клиентский режим', () => {
  it('resign-therapist переводит роль в CLIENT, выключает therapistMode и сбрасывает cabinetView', async () => {
    // Флаг на сервере тоже «терапевт», иначе реконсиляция (App.tsx, эффект
    // ниже modeReconciledRef) перезапишет therapistMode обратно в false сразу
    // после того, как роль и флаги подгрузятся — до нашего клика.
    localStorage.setItem('therapist_mode', '1');
    mockUseUserFlags.mockReturnValue(defaultFlags({ therapistMode: true }));
    mockApi.getProfile.mockResolvedValueOnce(THERAPIST_PROFILE);
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId('therapist-client-sheet-view-client'));
    await waitFor(() =>
      expect(screen.getByTestId('therapist-client-sheet').dataset.view).toBe(
        'client',
      ),
    );

    fireEvent.click(screen.getByTestId('app-overlays-resign-therapist'));
    await waitFor(() =>
      expect(mockApi.resignTherapist).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.userRole).toBe(
        'CLIENT',
      ),
    );
    expect(screen.queryByTestId('therapist-client-sheet')).toBeNull();
    await waitFor(() =>
      expect(localStorage.getItem('therapist_mode')).toBe('0'),
    );
  });
});

describe('App — refresh-key секции «Профиль» растёт после закрытия оверлея (данные не застревают старыми)', () => {
  it('открыли и закрыли настройки, находясь на «Профиль» → profileRefreshKey увеличивается', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-overlays-set-section-profile'));
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe(
        'profile',
      ),
    );
    const before = Number(
      screen.getByTestId('app-sections').dataset.profileRefreshKey,
    );

    fireEvent.click(screen.getByTestId('app-sections-open-settings'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.settings).toBe('true'),
    );
    fireEvent.click(screen.getByTestId('app-overlays-close-settings'));

    await waitFor(() =>
      expect(
        Number(screen.getByTestId('app-sections').dataset.profileRefreshKey),
      ).toBe(before + 1),
    );
  });
});

describe('App — кнопка «Назад» браузера закрывает открытый оверлей, не уводит из приложения (web-хост)', () => {
  it('открыли трекер → «Назад» браузера закрывает его', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-sections-open-tracker'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.trackerOverlay).toBe(
        'true',
      ),
    );

    window.history.back();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.trackerOverlay).toBe(
        'false',
      ),
    );
  });
});

describe('App — новая запись дневника, инициированная из секции, доходит до AppOverlays', () => {
  it('new-diary-entry из секции устанавливает newDiaryEntry=schema', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-sections-new-diary-entry'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.newDiaryEntry).toBe(
        'schema',
      ),
    );
  });
});
