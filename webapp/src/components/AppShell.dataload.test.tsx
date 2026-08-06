// @vitest-environment jsdom
// AppShell — начальный эффект загрузки данных (роль пользователя, дисклеймер,
// денормализованный mySchemaIds → localStorage). Дочерние секции замоканы
// (AppShell.test-helpers.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { renderAppShell } from './AppShell.test-helpers';
import { api } from '../api';
import { MY_SCHEMA_IDS_KEY, YSQ_PROGRESS_KEY } from '../utils/storageKeys';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

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

describe('AppShell — дисклеймер: зеркалим согласие сайта в бэкенд для мини-аппа', () => {
  it('если disclaimer ещё не accepted — вызывает acceptDisclaimer', async () => {
    mockApi.getDisclaimer.mockResolvedValueOnce({ accepted: false });
    renderAppShell('/today');
    await waitFor(() => expect(mockApi.acceptDisclaimer).toHaveBeenCalledTimes(1));
  });

  it('если уже accepted — acceptDisclaimer НЕ вызывается повторно', async () => {
    mockApi.getDisclaimer.mockResolvedValueOnce({ accepted: true });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(mockApi.acceptDisclaimer).not.toHaveBeenCalled();
  });
});

describe('AppShell — роль пользователя решает, куда попадает на дефолтном лендинге', () => {
  it('CLIENT остаётся на клиентском экране «Сегодня»', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'CLIENT', name: 'Аня', mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(screen.getByText('Аня')).toBeTruthy();
  });

  it('THERAPIST без явного выбора режима на дефолтном лендинге уходит в кабинет', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    expect(localStorage.getItem('therapist_mode')).toBe('1');
  });

  it('THERAPIST, ЯВНО выбравший клиентский режим (therapist_mode=0), остаётся клиентом', async () => {
    localStorage.setItem('therapist_mode', '0');
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    // Уважаем явный выбор — кабинет не открывается поверх воли пользователя.
    expect(screen.queryByTestId('therapist-client-sheet')).toBeNull();
  });

  it('THERAPIST, зашедший НЕ на дефолтный лендинг (/practice), остаётся там, где был', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/practice');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());
  });

  it('CLIENT, случайно оказавшийся на /cabinet, перенаправляется на /today', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'CLIENT', name: null, mySchemaIds: [] });
    renderAppShell('/cabinet');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
  });
});

describe('AppShell — денормализованный mySchemaIds синхронизируется в localStorage (правило №4)', () => {
  it('профиль с mySchemaIds сохраняет их в localStorage под MY_SCHEMA_IDS_KEY', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'CLIENT', name: null, mySchemaIds: ['abandonment', 'mistrust'] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]')).toEqual(['abandonment', 'mistrust']);
  });

  it('пустой mySchemaIds ничего не пишет в localStorage (не затирает реальные данные пустышкой)', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'CLIENT', name: null, mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(localStorage.getItem(MY_SCHEMA_IDS_KEY)).toBeNull();
  });
});

describe('AppShell — init() шлётся один раз за сессию (sessionStorage init_done)', () => {
  it('первый монт вызывает api.init', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(mockApi.init).toHaveBeenCalledTimes(1));
  });

  it('если init_done уже стоит — повторный монт api.init не вызывает', async () => {
    sessionStorage.setItem('init_done', '1');
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(mockApi.init).not.toHaveBeenCalled();
  });
});

describe('AppShell — прогресс YSQ-теста подхватывается из бэкенда (для мини-аппа)', () => {
  it('незавершённый прогресс без результата сохраняется в localStorage', async () => {
    mockApi.getYsqProgress.mockResolvedValueOnce({ answers: [1, 2, 3], page: 3 });
    mockApi.getYsqResult.mockResolvedValueOnce(null);
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    await waitFor(() => expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(YSQ_PROGRESS_KEY)!)).toEqual({ answers: [1, 2, 3], page: 3 });
  });

  it('если результат УЖЕ есть — незавершённый прогресс в localStorage не пишем (тест не актуален)', async () => {
    mockApi.getYsqProgress.mockResolvedValueOnce({ answers: [1, 2, 3], page: 3 });
    mockApi.getYsqResult.mockResolvedValueOnce({ answers: [1, 2, 3, 4], completedAt: '2026-01-01T00:00:00.000Z' });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
  });
});
