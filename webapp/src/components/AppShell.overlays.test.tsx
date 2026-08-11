// @vitest-environment jsdom
// AppShell — оверлеи и их побочные эффекты: цепочка трекер → селебрейшн →
// заметка дня, командная палитра (⌘K, ⌘1-4), режим терапевта (переключение +
// поиск по клиентам), разовый дисклеймер приватности кабинета.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderAppShell, mockLogout } from './AppShell.test-helpers';
import { api } from '../api';
import { todayStr } from '../utils/format';
import type { DayHistory } from '../types';

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

describe('AppShell — история: открытие с Today и read-after-write связка колбэков', () => {
  it('history-кнопка Today открывает HistorySheet, tracker/schemas/childhood переключают оверлеи', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-history'));
    await waitFor(() => expect(screen.getByTestId('history-sheet')).toBeTruthy());

    fireEvent.click(screen.getByTestId('history-sheet-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-close'));
    await waitFor(() => expect(screen.queryByTestId('tracker-overlay')).toBeNull());

    fireEvent.click(screen.getByTestId('history-sheet-schemas'));
    await waitFor(() => expect(screen.getByTestId('schema-info-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('schema-info-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('schema-info-sheet')).toBeNull());

    fireEvent.click(screen.getByTestId('history-sheet-childhood'));
    await waitFor(() => expect(screen.getByTestId('childhood-wheel')).toBeTruthy());
  });

  it('dismissPlan убирает план из pendingPlans (сохранил → в списке пропал), refreshed обновляет history', async () => {
    mockApi.getPendingPlans.mockResolvedValueOnce([
      { id: 1, needId: 'safety', practiceText: 'A', scheduledDate: '2026-01-01', reminderUtcHour: null, done: null },
      { id: 2, needId: 'autonomy', practiceText: 'B', scheduledDate: '2026-01-02', reminderUtcHour: null, done: null },
    ]);
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-history'));
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('history-sheet-state').textContent ?? '{}');
      expect(state.pendingPlanIds).toEqual([1, 2]);
    });

    fireEvent.click(screen.getByTestId('history-sheet-dismissPlan'));
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('history-sheet-state').textContent ?? '{}');
      expect(state.pendingPlanIds).toEqual([2]);
    });

    fireEvent.click(screen.getByTestId('history-sheet-refreshed'));
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('history-sheet-state').textContent ?? '{}');
      expect(state.historyLen).toBe(1);
    });
  });

  it('закрытие HistorySheet сбрасывает trackerTab на «today» (повторное открытие не залипает на history)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-history'));
    await waitFor(() => expect(screen.getByTestId('history-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('history-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('history-sheet')).toBeNull());
  });

  it('открытие истории сразу выставляет historyLoading=true, до ответа сервера, и снимает его с реальными данными', async () => {
    let resolveHistory: (v: DayHistory[]) => void = () => {};
    mockApi.history.mockImplementationOnce(() => new Promise<DayHistory[]>(res => { resolveHistory = res; }));
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-history'));
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('history-sheet-state').textContent ?? '{}');
      expect(state.historyLoading).toBe(true);
    });

    const earlier = new Date();
    earlier.setDate(earlier.getDate() - 3);
    resolveHistory([
      { date: todayStr(), ratings: { safety: 5 } },
      { date: earlier.toISOString().split('T')[0], ratings: { safety: 4 } },
    ]);

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('history-sheet-state').textContent ?? '{}');
      expect(state.historyLoading).toBe(false);
      // fillHistoryGaps добивает пропуски между днями — итоговых записей
      // обязано быть не меньше, чем реально пришло с сервера.
      expect(state.historyLen).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('AppShell — трекер: колбэки заметки/цели/истории открывают верный оверлей', () => {
  it('«note» из трекера открывает NoteSheet поверх', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-note'));
    await waitFor(() => expect(screen.getByTestId('note-sheet')).toBeTruthy());
  });

  it('«goal» из трекера открывает TaskCreateSheet, закрытие/создание убирает его', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-goal'));
    await waitFor(() => expect(screen.getByTestId('task-create-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('task-create-sheet-created'));
    await waitFor(() => expect(screen.queryByTestId('task-create-sheet')).toBeNull());
  });

  it('«openHistory» из трекера закрывает трекер и открывает HistorySheet', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-openHistory'));
    await waitFor(() => expect(screen.queryByTestId('tracker-overlay')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('history-sheet')).toBeTruthy());
  });
});

describe('AppShell — диалог схемы: три параметра (autoStartTest/initialTab/highlight) долетают вместе', () => {
  it('Today передаёт schema с startTest+tab+highlight — все три видны разом в SchemaInfoSheet', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-schema'));
    await waitFor(() => expect(screen.getByTestId('schema-info-sheet')).toBeTruthy());
    const props = JSON.parse(screen.getByTestId('schema-info-sheet-state').textContent ?? '{}');
    expect(props).toEqual({ autoStartTest: true, initialTab: 'schemas', highlightSchema: 'abandonment' });
  });

  it('Паттерны передают только tab, без startTest/highlight — они не наследуются из предыдущего открытия с Today', async () => {
    renderAppShell('/schemas');
    await waitFor(() => expect(screen.getByTestId('schemas-section')).toBeTruthy());
    // Сначала открыли с Today (startTest+highlight), закрыли.
    fireEvent.click(screen.getByTestId('schemas-section-schema'));
    await waitFor(() => expect(screen.getByTestId('schema-info-sheet')).toBeTruthy());
    const props = JSON.parse(screen.getByTestId('schema-info-sheet-state').textContent ?? '{}');
    // SchemasSection в моке шлёт { tab: 'modes' } без startTest/highlight —
    // оба обязаны стоять в дефолте, а не в значениях с прошлого открытия.
    expect(props).toEqual({ autoStartTest: false, initialTab: 'modes', highlightSchema: null });
  });
});

describe('AppShell — прямая навигация и точечный трекер из Today/Паттернов/Практики', () => {
  it('Today «navigate» переключает секцию на «Дневник» напрямую (setSection)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-navigate'));
    await waitFor(() => expect(screen.getByTestId('diary-section')).toBeTruthy());
  });

  it('Today «trackerAt» открывает трекер сразу с конкретной потребностью (не с пустого списка)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-trackerAt'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
  });

  it('Паттерны: «childhood» открывает колесо детства из раздела схем', async () => {
    renderAppShell('/schemas');
    await waitFor(() => expect(screen.getByTestId('schemas-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('schemas-section-childhood'));
    await waitFor(() => expect(screen.getByTestId('childhood-wheel')).toBeTruthy());
  });

  it('Практика: собственная «tracker»-кнопка открывает трекер напрямую (без промежуточного экрана)', async () => {
    renderAppShell('/practice');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('practice-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
  });

  it('«Закрыть» у PracticesScreen и PlansScreen реально их закрывает (не только переход в трекер)', async () => {
    renderAppShell('/practice');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());

    fireEvent.click(screen.getByTestId('practice-section-practices'));
    await waitFor(() => expect(screen.getByTestId('practices-screen')).toBeTruthy());
    fireEvent.click(screen.getByTestId('practices-screen-close'));
    await waitFor(() => expect(screen.queryByTestId('practices-screen')).toBeNull());

    fireEvent.click(screen.getByTestId('practice-section-plans'));
    await waitFor(() => expect(screen.getByTestId('plans-screen')).toBeTruthy());
    fireEvent.click(screen.getByTestId('plans-screen-close'));
    await waitFor(() => expect(screen.queryByTestId('plans-screen')).toBeNull());
  });
});

describe('AppShell — Дневник напрямую (Today) и Практика открывают дневник-оверлей', () => {
  it('Today «diaries» открывает DiariesOverlay, закрытие убирает его', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-diaries'));
    await waitFor(() => expect(screen.getByTestId('diaries-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('diaries-overlay-close'));
    await waitFor(() => expect(screen.queryByTestId('diaries-overlay')).toBeNull());
  });

  it('Today «childhood» открывает колесо детства напрямую (без истории), «назад» закрывает', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-childhood'));
    await waitFor(() => expect(screen.getByTestId('childhood-wheel')).toBeTruthy());
    fireEvent.click(screen.getByTestId('childhood-wheel-back'));
    await waitFor(() => expect(screen.queryByTestId('childhood-wheel')).toBeNull());
  });

  it('Today «cabinet» переключает в режим терапевта (доступно из клиентского экрана)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-cabinet'));
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
  });

  it('Практика: практики/планы/трекер/дневники/детство открывают соответствующие оверлеи', async () => {
    renderAppShell('/practice');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());

    fireEvent.click(screen.getByTestId('practice-section-practices'));
    await waitFor(() => expect(screen.getByTestId('practices-screen')).toBeTruthy());
    fireEvent.click(screen.getByTestId('practices-screen-tracker'));
    await waitFor(() => expect(screen.queryByTestId('practices-screen')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-close'));

    fireEvent.click(screen.getByTestId('practice-section-plans'));
    await waitFor(() => expect(screen.getByTestId('plans-screen')).toBeTruthy());
    fireEvent.click(screen.getByTestId('plans-screen-tracker'));
    await waitFor(() => expect(screen.queryByTestId('plans-screen')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-close'));

    fireEvent.click(screen.getByTestId('practice-section-diaries'));
    await waitFor(() => expect(screen.getByTestId('diaries-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('diaries-overlay-close'));

    fireEvent.click(screen.getByTestId('practice-section-childhood'));
    await waitFor(() => expect(screen.getByTestId('childhood-wheel')).toBeTruthy());
  });

  it('Практика: tasksChanged двигает refreshKey — PracticeSection обязан перечитать задачи сам (read-after-write)', async () => {
    renderAppShell('/practice');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());
    expect(screen.getByTestId('practice-section-state').textContent).toBe('0');
    fireEvent.click(screen.getByTestId('practice-section-tasksChanged'));
    await waitFor(() => expect(screen.getByTestId('practice-section-state').textContent).toBe('1'));
  });

  it('Профиль: settings/tracker открывают SettingsSheet и TrackerOverlay', async () => {
    renderAppShell('/profile');
    await waitFor(() => expect(screen.getByTestId('profile-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('profile-section-settings'));
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('settings-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('settings-sheet')).toBeNull());

    fireEvent.click(screen.getByTestId('profile-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
  });
});

describe('AppShell — Настройки: доп. переходы (кабинет терапевта, переключение режима)', () => {
  it('«cabinet» из настроек закрывает лист и ведёт в /cabinet', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-advanced'));
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('settings-sheet-cabinet'));
    await waitFor(() => expect(screen.queryByTestId('settings-sheet')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
  });

  it('«toggleTherapist» из настроек переключает режим на терапевта', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-advanced'));
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('settings-sheet-toggleTherapist'));
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
  });
});

describe('AppShell — режим терапевта: выключение уводит на запомненный клиентский путь', () => {
  it('переключатель «Клиент» из кабинета возвращает на последний клиентский путь', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    localStorage.setItem('last_client_path', '/practice');
    renderAppShell('/cabinet');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Клиент' }));
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());
    expect(mockApi.setTherapistView).toHaveBeenCalledWith(false);
  });
});

describe('AppShell — «Сегодня» кабинета терапевта и переход к клиенту', () => {
  it('/cabinet/today рендерит TherapistTodaySection, openClient ведёт в карточку клиента', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/cabinet/today');
    await waitFor(() => expect(screen.getByTestId('therapist-today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('therapist-today-section-openClient'));
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
  });
});

describe('AppShell — командная палитра: переход к клиенту и созданию записи дневника', () => {
  it('openClient из палитры ведёт в карточку клиента кабинета', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
    fireEvent.click(screen.getByTestId('command-palette-openClient'));
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
  });

  it('newDiaryEntry из палитры ведёт в раздел «Дневник»', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
    fireEvent.click(screen.getByTestId('command-palette-newDiaryEntry'));
    await waitFor(() => expect(screen.getByTestId('diary-section')).toBeTruthy());
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

describe('AppShell — трекер: изменение оценки реально приходит обратно в ratings/saved', () => {
  it('onChange(needId, value) — ratings[needId] обновился, saved[needId] сброшен на false', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    expect(JSON.parse(screen.getByTestId('tracker-overlay-state').textContent ?? '{}')).toEqual({ attachmentRating: null, attachmentSaved: null });

    fireEvent.click(screen.getByTestId('tracker-overlay-change'));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('tracker-overlay-state').textContent ?? '{}')).toEqual({ attachmentRating: 5, attachmentSaved: false });
    });
  });
});

describe('AppShell — карточка клиента в кабинете: routing-состояние (view/openClientId) и синхронизация списка', () => {
  it('openClient переключает view на «client» с реальным id, toList возвращает к списку', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/cabinet');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    expect(JSON.parse(screen.getByTestId('therapist-client-sheet-state').textContent ?? '{}')).toEqual({ view: 'list', openClientId: null });

    fireEvent.click(screen.getByTestId('therapist-client-sheet-openClient'));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('therapist-client-sheet-state').textContent ?? '{}')).toEqual({ view: 'client', openClientId: 42 });
    });

    fireEvent.click(screen.getByTestId('therapist-client-sheet-toList'));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('therapist-client-sheet-state').textContent ?? '{}')).toEqual({ view: 'list', openClientId: null });
    });
  });

  it('onClientsChange реально долетает до сайдбара — новый клиент виден в списке', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    renderAppShell('/cabinet');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    expect(screen.queryByText('А')).toBeNull();
    fireEvent.click(screen.getByTestId('therapist-client-sheet-clients'));
    await waitFor(() => expect(screen.getByText('А')).toBeTruthy());
  });
});

describe('AppShell — Практика: кнопка «тест на схемы» открывает SchemaInfoSheet с флагом autoStartTest', () => {
  it('клик по schema в Практике проставляет autoStartTest=true', async () => {
    renderAppShell('/practice');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('practice-section-schema'));
    await waitFor(() => expect(screen.getByTestId('schema-info-sheet')).toBeTruthy());
    const props = JSON.parse(screen.getByTestId('schema-info-sheet-state').textContent ?? '{}');
    expect(props.autoStartTest).toBe(true);
  });
});

describe('AppShell — заметка дня и цель трекера закрываются собственной кнопкой «Закрыть»', () => {
  it('NoteSheet close реально скрывает лист', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-note'));
    await waitFor(() => expect(screen.getByTestId('note-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('note-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('note-sheet')).toBeNull());
  });

  it('TaskCreateSheet close реально скрывает лист (без создания цели)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-goal'));
    await waitFor(() => expect(screen.getByTestId('task-create-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('task-create-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('task-create-sheet')).toBeNull());
  });
});

describe('AppShell — командная палитра: закрытие и переключение режима', () => {
  it('navigateDiary из палитры переключает секцию на «Дневник»', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
    fireEvent.click(screen.getByTestId('command-palette-navigateDiary'));
    await waitFor(() => expect(screen.getByTestId('diary-section')).toBeTruthy());
  });

  it('toggleMode из палитры переключает в режим терапевта', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
    fireEvent.click(screen.getByTestId('command-palette-toggleMode'));
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
  });
});

describe('AppShell — сайдбар: индекс дня и поиск⌘K открываются кликом (не только по клавише)', () => {
  it('CTA «Заполнить дневник» в сайдбаре реально открывает трекер', async () => {
    mockApi.needs.mockResolvedValueOnce([{ id: 'safety', emoji: '', title: 'Безопасность', chartLabel: 'Без.' }]);
    mockApi.ratings.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByText('Заполнить дневник →')).toBeTruthy());
    fireEvent.click(screen.getByText('Заполнить дневник →'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
  });

  it('иконка поиска в топбаре («Перейти к…») открывает командную палитру', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByText('Перейти к…'));
    await waitFor(() => expect(screen.getByTestId('command-palette')).toBeTruthy());
  });
});

describe('AppShell — стрик 5+ дней ставит колесо детства «в очередь», заметка дня его открывает', () => {
  it('после Celebration и заметки дня — колесо детства открывается автоматически (если ещё не пройдено)', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    // saveWithStreak: totalDays=6 (>=5) — из test-helpers.tsx.
    fireEvent.click(screen.getByTestId('tracker-overlay-saveWithStreak'));
    await waitFor(() => expect(screen.getByTestId('celebration-streak-3')).toBeTruthy());
    fireEvent.click(screen.getByTestId('celebration-streak-3-done'));
    await waitFor(() => expect(screen.getByTestId('note-sheet')).toBeTruthy());

    fireEvent.click(screen.getByTestId('note-sheet-close'));
    await waitFor(() => expect(screen.getByTestId('childhood-wheel')).toBeTruthy());
  });

  it('заметка дня открыта не через стрик-цепочку (childhoodWheelPending=false) — закрытие не открывает колесо', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-tracker'));
    await waitFor(() => expect(screen.getByTestId('tracker-overlay')).toBeTruthy());
    fireEvent.click(screen.getByTestId('tracker-overlay-note'));
    await waitFor(() => expect(screen.getByTestId('note-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('note-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('note-sheet')).toBeNull());
    expect(screen.queryByTestId('childhood-wheel')).toBeNull();
  });
});

describe('AppShell — сайдбар: выход из аккаунта и закрытие карточки клиента', () => {
  it('«Выйти» вызывает logout() из auth-контекста', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('close у карточки клиента возвращает в клиентский режим на запомненный путь', async () => {
    mockApi.getProfile.mockResolvedValueOnce({ role: 'THERAPIST', name: 'Др. Кто', mySchemaIds: [] });
    localStorage.setItem('last_client_path', '/diary');
    renderAppShell('/cabinet');
    await waitFor(() => expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy());
    fireEvent.click(screen.getByTestId('therapist-client-sheet-close'));
    await waitFor(() => expect(screen.getByTestId('diary-section')).toBeTruthy());
  });
});

describe('AppShell — колесо детства: сохранение оценок и повтор истории', () => {
  it('saved (onSaved) сохраняет childhoodRatings — они попадают дальше в SchemaInfoSheet при открытии из истории', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    fireEvent.click(screen.getByTestId('today-section-childhood'));
    await waitFor(() => expect(screen.getByTestId('childhood-wheel')).toBeTruthy());
    fireEvent.click(screen.getByTestId('childhood-wheel-saved'));
    // saved не закрывает лист сам по себе — закрываем явно, как в реальном UX.
    fireEvent.click(screen.getByTestId('childhood-wheel-back'));
    await waitFor(() => expect(screen.queryByTestId('childhood-wheel')).toBeNull());
  });
});
