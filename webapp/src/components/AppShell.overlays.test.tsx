// @vitest-environment jsdom
// AppShell — оверлеи и их побочные эффекты: цепочка трекер → селебрейшн →
// заметка дня, командная палитра (⌘K, ⌘1-4), режим терапевта (переключение +
// поиск по клиентам), разовый дисклеймер приватности кабинета.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderAppShell } from './AppShell.test-helpers';
import { api } from '../api';

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

describe('AppShell — трекер: сохранение со стриком запускает селебрейшн, а не молчит', () => {
  it('onSaved(needId, streak>0) → показывает Celebration с реальным стриком', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());

    fireEvent.click(screen.getByTestId('tracker-overlay-saveWithStreak'));
    // Стрик = 3 (см. AppShell.test-helpers.tsx) — testid содержит реальное
    // значение, а не захардкоженное «вчерашнее».
    await waitFor(() => expect(screen.getByTestId('celebration-streak-3')).toBeTruthy());

    // Закрытие Celebration ведёт дальше к заметке дня (see handleDone chain).
    fireEvent.click(screen.getByTestId('celebration-streak-3-done'));
    await waitFor(() => expect(screen.getByTestId('note-sheet')).toBeTruthy());
  });

  it('onSaved(needId, streak=0) → сразу заметка дня, без Celebration', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());

    fireEvent.click(screen.getByTestId('tracker-overlay-saveNoStreak'));
    await waitFor(() => expect(screen.getByTestId('note-sheet')).toBeTruthy());
    expect(screen.queryByTestId(/celebration-streak/)).toBeNull();
  });

  it('закрытие трекера без сохранения не открывает ни Celebration, ни заметку', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-close'));
    await waitFor(() => expect(screen.queryByTestId('tracker-overlay')).toBeNull());
    expect(screen.queryByTestId('note-sheet')).toBeNull();
  });
});

describe('AppShell — командная палитра', () => {
  it('⌘K открывает палитру', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
  });

  it('⌘2 переключает секцию на «Дневник» (быстрый доступ без палитры)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: '2', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('diary-section')).toBeTruthy());
  });

  it('палитра «Закрыть» реально закрывается', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
    fireEvent.click(screen.getByTestId('command-palette-close'));
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());
  });
});

describe('AppShell — режим терапевта: переключение и поиск по клиентам', () => {
  it('переключатель «Терапевт» в сайдбаре ведёт в кабинет', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    localStorage.setItem('therapist_mode', '0'); // старт клиентом, чтобы проверить именно клик по переключателю
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Терапевт' }));
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    expect(mockApi.setTherapistView).toHaveBeenCalledWith(true);
  });

  it('поиск по клиентам (>4 клиентов) фильтрует список по имени', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    mockApi.getTherapyClients.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        telegramId: i + 1, name: `Клиент ${i + 1}`, clientAlias: null, streak: 0, lastActiveDate: null,
        todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01', therapyStartDate: null,
        nextSession: null, meetingDays: [], schemaIds: [],
      })),
    );
    renderAppShell('/cabinet');
    await waitFor(() => expect(screen.getByPlaceholderText('Поиск клиента…')).toBeTruthy());
    expect(screen.getByText('Клиент 3')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Поиск клиента…'), { target: { value: 'Клиент 3' } });
    expect(screen.queryByText('Клиент 1')).toBeNull();
    expect(screen.getByText('Клиент 3')).toBeTruthy();
  });
});

describe('AppShell — разовый дисклеймер приватности кабинета', () => {
  it('первый вход терапевта в кабинет показывает дисклеймер один раз', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('therapist-disclaimer')).toBeTruthy());
    fireEvent.click(screen.getByTestId('therapist-disclaimer-done'));
    await waitFor(() => expect(screen.queryByTestId('therapist-disclaimer')).toBeNull());
    expect(localStorage.getItem('therapist_privacy_disclaimer_seen')).toBe('1');
  });

  it('если флаг уже стоит — дисклеймер повторно не показывается', async () => {
    localStorage.setItem('therapist_privacy_disclaimer_seen', '1');
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    expect(screen.queryByTestId('therapist-disclaimer')).toBeNull();
  });
});

describe('AppShell — настройки: выход из роли терапевта возвращает в клиентский режим', () => {
  it('resignTherapist() переводит в CLIENT и уводит на /today', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('settings-sheet-resign'));

    await waitFor(() => expect(mockApi.resignTherapist).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(localStorage.getItem('therapist_mode')).toBe('0');
  });
});
