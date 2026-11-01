// @vitest-environment jsdom
// AppShell — нижняя панель терапевта на телефоне (#902): «Профиль» открывает лист
// настроек (там переключатель режима и вход на /account), а не уводит на /account.
// Звено AppShell → MobileNav → лист: пропсы MobileNav и SettingsSheet проверены
// по отдельности, здесь — что AppShell их действительно соединил.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import { renderAppShell } from './AppShell.test-helpers';
import { api } from '../api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mobileNav = () => document.querySelector('.mobile-nav') as HTMLElement;

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

describe('AppShell — режим терапевта: «Профиль» в нижней панели', () => {
  it('открывает лист настроек, ссылки на /account в панели нет', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/cabinet');
    await waitFor(() => expect(within(mobileNav()).getByText('Клиенты')).toBeTruthy());
    expect(screen.queryByTestId('settings-sheet')).toBeNull();
    expect(mobileNav().querySelector('a[href="/account"]')).toBeNull();

    fireEvent.click(within(mobileNav()).getByText('Профиль'));
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeTruthy());
  });
});
