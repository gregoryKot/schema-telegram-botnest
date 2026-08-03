// @vitest-environment jsdom
// Компонентные тесты PracticeSection (экран «Практика»): библиотека
// упражнений со статистикой из реальных данных (не хардкод), задания от
// терапевта, свои цели, оверлей «Все цели», баннер ближайшей сессии,
// ты/вы-вилка в подзаголовке (CLAUDE.md, обязательное правило).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PracticeSection } from './PracticeSection';

vi.mock('../api', () => ({
  api: {
    getTasks: vi.fn(),
    getTaskHistory: vi.fn(),
    getTherapyRelation: vi.fn(),
    getBeliefChecks: vi.fn(),
    getSchemaNotes: vi.fn(),
    getModeNotes: vi.fn(),
    getLetters: vi.fn(),
    getSafePlace: vi.fn(),
    getChildhoodRatings: vi.fn(),
    listMyModeMaps: vi.fn(),
    completeTask: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const noopProps = {
  onOpenChildhoodWheel: vi.fn(),
  onOpenPractices: vi.fn(),
  onOpenPlans: vi.fn(),
  onOpenTracker: vi.fn(),
  onOpenDiaries: vi.fn(),
  onOpenSchema: vi.fn(),
};

function task(overrides: Partial<{ id: number; assignedBy: number | null; type: string; text: string; dueDate: string | null; done: boolean | null; doneToday: boolean }> = {}) {
  return {
    id: 1, userId: 1, assignedBy: null, type: 'custom', text: 'Задание',
    targetDays: null, needId: null, dueDate: null, done: null,
    completedAt: null, createdAt: '2026-08-01T00:00:00Z', doneToday: false,
    ...overrides,
  };
}

function renderSection(props: Partial<typeof noopProps & { refreshKey?: number; onTasksChanged?: () => void }> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <PracticeSection {...noopProps} {...props} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getTasks.mockResolvedValue([]);
  mockApi.getTaskHistory.mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getBeliefChecks.mockResolvedValue([]);
  mockApi.getSchemaNotes.mockResolvedValue([]);
  mockApi.getModeNotes.mockResolvedValue([]);
  mockApi.getLetters.mockResolvedValue([]);
  mockApi.getSafePlace.mockResolvedValue(null);
  mockApi.getChildhoodRatings.mockResolvedValue({});
  mockApi.listMyModeMaps.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('PracticeSection — ты/вы вилка', () => {
  it('подзаголовок звучит на «ты» по умолчанию', () => {
    renderSection({}, 'ty');
    expect(screen.getByText(/Шесть практик схема-терапии плюс твои личные цели/)).toBeTruthy();
    expect(screen.queryByText(/ваши личные цели/)).toBeNull();
  });

  it('подзаголовок звучит на «вы», когда выбрана форма vy — «ваши», а не «твои»', () => {
    renderSection({}, 'vy');
    expect(screen.getByText(/Шесть практик схема-терапии плюс ваши личные цели/)).toBeTruthy();
    expect(screen.queryByText(/твои личные цели/)).toBeNull();
  });
});

describe('PracticeSection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('на пустом аккаунте все упражнения показывают "не начато", а не выдуманную статистику', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getBeliefChecks).toHaveBeenCalled());
    expect(screen.getAllByText('не начато').length).toBe(6);
  });

  it('без активных целей показывает пустое состояние, а не "0 активных" молча', async () => {
    renderSection();
    await screen.findByText('нет активных');
    expect(screen.getByText('Поставь цель и иди к ней маленькими шагами.')).toBeTruthy();
  });

  it('ошибка getTasks/getTaskHistory не роняет экран — секция "От терапевта" просто не показывается', async () => {
    mockApi.getTasks.mockRejectedValue(new Error('network down'));
    mockApi.getTaskHistory.mockRejectedValue(new Error('network down'));
    renderSection();

    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    expect(screen.queryByText('От терапевта')).toBeNull();
  });
});

describe('PracticeSection — статистика упражнений из реальных данных', () => {
  it('пройденное упражнение показывает реальное число записей и дату, а не заглушку', async () => {
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: new Date().toISOString() }]);
    renderSection();

    const stat = await screen.findByText(/1 запись/);
    expect(stat.textContent).toContain('сегодня');
  });
});

describe('PracticeSection — задания от терапевта', () => {
  it('показывает задания от терапевта отдельным блоком со счётчиком', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, assignedBy: 99, type: 'diary_streak', text: 'дневник' }),
    ]);
    renderSection();

    await screen.findByText('От терапевта');
    expect(screen.getByText('1 задание')).toBeTruthy();
  });

  it('клик на задание "diary_streak" от терапевта открывает дневники (onOpenDiaries)', async () => {
    const onOpenDiaries = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 99, type: 'diary_streak' })]);
    renderSection({ onOpenDiaries });

    // "начать →" встречается и у блока терапевта, и у карточек «В трудный
    // момент» — блок терапевта рендерится первым в DOM.
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    expect(onOpenDiaries).toHaveBeenCalled();
  });

  it('клик на задание "tracker_streak" открывает трекер (onOpenTracker)', async () => {
    const onOpenTracker = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 99, type: 'tracker_streak' })]);
    renderSection({ onOpenTracker });

    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    expect(onOpenTracker).toHaveBeenCalled();
  });
});

describe('PracticeSection — мои цели', () => {
  it('показывает свои цели (assignedBy=null) отдельно от "нет активных"', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 2, assignedBy: null, type: 'custom', text: 'Моя цель' })]);
    renderSection();

    await screen.findByText('Моя цель');
    expect(screen.getByText('1 активных')).toBeTruthy();
  });

  it('клик "+ Поставить цель" открывает TaskCreateSheet', async () => {
    renderSection();
    await screen.findByText('нет активных');

    fireEvent.click(screen.getByText('+ Поставить цель'));
    await screen.findByText('Новое задание');
  });

  it('"все цели →" открывает AllGoalsOverlay со списком целей и историей', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, text: 'Цель 1' }), task({ id: 2, text: 'Цель 2' }),
      task({ id: 3, text: 'Цель 3' }), task({ id: 4, text: 'Цель 4' }), task({ id: 5, text: 'Цель 5' }),
    ]);
    mockApi.getTaskHistory.mockResolvedValue([task({ id: 6, text: 'Готовая цель', done: true })]);
    renderSection();

    const link = await screen.findByText('все цели →');
    fireEvent.click(link);

    await screen.findByText('Все цели');
    expect(screen.getByText('Цель 5')).toBeTruthy();
    expect(screen.getByText('Готовая цель')).toBeTruthy();
    expect(screen.getByText('готово')).toBeTruthy();
  });
});

describe('PracticeSection — баннер ближайшей сессии', () => {
  it('клиент с сессией сегодня видит "Сегодня встреча"', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'x',
      nextSession: new Date().toISOString(),
    });
    renderSection();

    await screen.findByText('● Сегодня встреча');
    expect(screen.getByText(/с Анна/)).toBeTruthy();
  });

  it('терапевт (role=therapist) не видит баннер сессии клиента', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'therapist', status: 'active', partnerName: null, partnerId: null, code: 'x', nextSession: null,
    });
    renderSection();

    await waitFor(() => expect(mockApi.getTherapyRelation).toHaveBeenCalled());
    expect(screen.queryByText(/встреча/)).toBeNull();
  });
});

describe('PracticeSection — колесо детства (localStorage)', () => {
  it('без пройденного колеса детства кнопка "начать →"', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    // «Колесо детства» встречается и в библиотеке упражнений, и в карточках
    // «В трудный момент» — берём карточку из второго блока (с описанием
    // "Как удовлетворялись потребности").
    const card = screen.getByText('Как удовлетворялись потребности в детстве').parentElement!;
    expect(card.textContent).toContain('начать →');
  });

  it('с пройденным колесом (localStorage-флаг) кнопка "открыть →"', async () => {
    localStorage.setItem('childhood_wheel_done', '1');
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    const card = screen.getByText('Как удовлетворялись потребности в детстве').parentElement!;
    expect(card.textContent).toContain('открыть →');
  });
});

describe('PracticeSection — упражнение открывается по клику (Suspense)', () => {
  it('клик "Проверка убеждения" открывает BeliefCheckEx (ленивая загрузка отрабатывает)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getBeliefChecks).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Проверка убеждения'));

    await screen.findByPlaceholderText('Например: я всегда всё порчу, меня никто не любит…');
  });
});
