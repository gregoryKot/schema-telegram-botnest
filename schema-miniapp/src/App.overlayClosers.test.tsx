// @vitest-environment jsdom
// App.tsx отдаёт «Истории потребностей» closers.tracker из реестра закрытия
// (hooks/overlayClosers) — тот же, что вызывает «Назад» хоста. Раньше лист
// закрывался собственным sheets.close(...) внутри компонента: правка реестра
// не доезжала до крестика (ревью PR #696). Здесь — шов App → компонент:
// тап по «крестику» (в заглушке это onClose из пропов) обязан пройти реестр.
// Потребление onClose самим компонентом — TrackerHistoryOverlay.navigation.test.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderApp, mockUseUserFlags } from './test-support/App.test-helpers';
import { defaultFlags } from './test-support/App.test-fixtures';
import { api } from './api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockUseUserFlags.mockReturnValue(defaultFlags());
  window.history.pushState({}, '', '/');
});
afterEach(cleanup);

const overlay = () => screen.getByTestId('tracker-history-overlay');

describe('App — крестик «Истории потребностей» идёт через реестр закрытия', () => {
  it('закрывает лист и сбрасывает вкладку: повторное открытие перечитывает историю', async () => {
    mockApi.history.mockResolvedValue([]);
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId('app-sections-open-tracker-history'));
    await waitFor(() => expect(overlay().dataset.tracker).toBe('true'));
    await waitFor(() => expect(mockApi.history).toHaveBeenCalledTimes(1));

    fireEvent.click(overlay());
    await waitFor(() => expect(overlay().dataset.tracker).toBe('false'));

    // closers.tracker возвращает trackerTab в 'today' — вкладка «история»
    // при следующем открытии снова меняет значение и перечитывает данные.
    // Закрытие мимо реестра оставило бы 'history' и показало бы старую историю.
    fireEvent.click(screen.getByTestId('app-sections-open-tracker-history'));
    await waitFor(() => expect(mockApi.history).toHaveBeenCalledTimes(2));
  });
});
