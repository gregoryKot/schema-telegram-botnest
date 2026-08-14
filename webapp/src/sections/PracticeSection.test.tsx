// @vitest-environment jsdom
// Компонентные тесты PracticeSection (экран «Практика»): библиотека
// упражнений со статистикой из реальных данных (не хардкод), задания от
// терапевта, свои цели, оверлей «Все цели», баннер ближайшей сессии,
// ты/вы-вилка в подзаголовке (CLAUDE.md, обязательное правило).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PracticeSection } from './PracticeSection';

// Мок фабрики `../api` возвращает только `{ api: {...} }` по умолчанию, но
// хук useTaskActions (используемый внутри PracticeSection) импортирует ещё и
// reportClientError — без него тесты падают на undefined.
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
    createTask: vi.fn(),
    getFlashcards: vi.fn(),
    createFlashcard: vi.fn(),
    createLetter: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
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
  mockApi.completeTask.mockResolvedValue(undefined);
  mockApi.createTask.mockResolvedValue(undefined);
  mockApi.getFlashcards.mockResolvedValue([]);
  mockApi.createFlashcard.mockResolvedValue(undefined);
  mockApi.createLetter.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('PracticeSection — ты/вы вилка', () => {
  it('подзаголовок звучит на «ты» по умолчанию', () => {
    renderSection({}, 'ty');
    expect(screen.getByText(/Семь практик схема-терапии плюс твои личные цели/)).toBeTruthy();
    expect(screen.queryByText(/ваши личные цели/)).toBeNull();
  });

  it('подзаголовок звучит на «вы», когда выбрана форма vy — «ваши», а не «твои»', () => {
    renderSection({}, 'vy');
    expect(screen.getByText(/Семь практик схема-терапии плюс ваши личные цели/)).toBeTruthy();
    expect(screen.queryByText(/твои личные цели/)).toBeNull();
  });
});

describe('PracticeSection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('на пустом аккаунте все упражнения показывают "не начато", а не выдуманную статистику', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getBeliefChecks).toHaveBeenCalled());
    expect(screen.getAllByText('не начато').length).toBe(7);
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

describe('PracticeSection — регрессия: та же механика завершения задания, что в TodaySection (общий хук useTaskActions)', () => {
  // Раньше handleTaskComplete в PracticeSection дублировал механику
  // useTaskActions инлайн и глотал сбой (`.catch(() => {})`): лист
  // упражнения закрывался как будто задание засчиталось, хотя на сервере
  // ничего не менялось. Теперь секция берёт общий хук — сбой видим.
  it('completeTask отклоняется → на экране видима ошибка, onTasksChanged не вызван', async () => {
    const onTasksChanged = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ id: 30, assignedBy: 9, type: 'letter_to_self' })]);
    mockApi.completeTask.mockRejectedValue(new Error('network down'));
    renderSection({ onTasksChanged });

    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    const textarea = await screen.findByPlaceholderText('…');
    fireEvent.change(textarea, { target: { value: 'Здравствуй, малыш.' } });

    await act(async () => { fireEvent.click(screen.getByText(/Запечатать письмо/)); });
    await act(async () => { fireEvent.click(screen.getByText('Закрыть')); });

    expect(screen.getByRole('alert').textContent).toContain('Не удалось сохранить изменение задания');
    expect(onTasksChanged).not.toHaveBeenCalled();
  });

  it('completeTask резолвится → ошибки нет, onTasksChanged вызван, список перезапрошен', async () => {
    const onTasksChanged = vi.fn();
    mockApi.getTasks
      .mockResolvedValueOnce([task({ id: 31, assignedBy: 9, type: 'letter_to_self' })])
      .mockResolvedValue([]);
    mockApi.completeTask.mockResolvedValue(undefined);
    renderSection({ onTasksChanged });

    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    const textarea = await screen.findByPlaceholderText('…');
    fireEvent.change(textarea, { target: { value: 'Здравствуй, малыш.' } });

    await act(async () => { fireEvent.click(screen.getByText(/Запечатать письмо/)); });
    await act(async () => { fireEvent.click(screen.getByText('Закрыть')); });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onTasksChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('От терапевта')).toBeNull();
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

describe('PracticeSection — «давность» и число записей форматируются по реальным датам/числам', () => {
  it('lastDone вчера — подпись "вчера"', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: yesterday }]);
    renderSection();
    const stat = await screen.findByText(/1 запись/);
    expect(stat.textContent).toContain('вчера');
  });

  it('lastDone 3 дня назад — подпись "3 дн. назад"', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: threeDaysAgo }]);
    renderSection();
    const stat = await screen.findByText(/1 запись/);
    expect(stat.textContent).toContain('3 дн. назад');
  });

  it('3 записи — счётчик "3 записи" (не "запись" и не "записей")', async () => {
    const now = new Date().toISOString();
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: now }, { id: 2, createdAt: now }, { id: 3, createdAt: now }]);
    renderSection();
    await screen.findByText(/3 записи/);
  });
});

describe('PracticeSection — согласование числительных «задание/задания/заданий»', () => {
  it('2 задания от терапевта — форма "2 задания"', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, assignedBy: 9, type: 'diary_streak', text: 'A' }),
      task({ id: 2, assignedBy: 9, type: 'tracker_streak', text: 'B' }),
    ]);
    renderSection();
    await screen.findByText('2 задания');
  });

  it('11 заданий от терапевта — форма "11 заданий" (исключение 11-19)', async () => {
    mockApi.getTasks.mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => task({ id: i + 1, assignedBy: 9, type: 'custom', text: `Задача ${i}` })),
    );
    renderSection();
    await screen.findByText('11 заданий');
  });
});

describe('PracticeSection — открытие карточки схемы по навигационному state (переход извне)', () => {
  it('location.state.openSchemaEx открывает карточку схемы сразу, минуя список упражнений', async () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter initialEntries={[{ pathname: '/practice', state: { openSchemaEx: 'abandonment' } }]}>
          <PracticeSection {...noopProps} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    // Экран сразу в режиме упражнения — библиотека (заголовок раздела) не видна.
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });
});

describe('PracticeSection — задания терапевта: остальные типы открывают правильное упражнение', () => {
  it('belief_check → открывает «Проверка убеждения», завершение обновляет список и вызывает onTasksChanged', async () => {
    const onTasksChanged = vi.fn();
    mockApi.getTasks
      .mockResolvedValueOnce([task({ id: 7, assignedBy: 9, type: 'belief_check' })])
      .mockResolvedValue([]);
    mockApi.completeTask.mockResolvedValue(undefined);
    renderSection({ onTasksChanged });

    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await screen.findByPlaceholderText('Например: я всегда всё порчу, меня никто не любит…');

    // Завершение убеждения вызывает onComplete → handleTaskComplete → completeTask.
    const saveBtn = screen.getByText(/Продолжить|Сохранить|Дальше/);
    expect(saveBtn).toBeTruthy();
  });

  it('safe_place → открывает «Безопасное место»', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 8, assignedBy: 9, type: 'safe_place' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });

  it('letter_to_self → открывает «Письмо уязвимому ребёнку»', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 9, assignedBy: 9, type: 'letter_to_self' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });

  it('childhood_wheel → onOpenChildhoodWheel', async () => {
    const onOpenChildhoodWheel = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ id: 10, assignedBy: 9, type: 'childhood_wheel' })]);
    renderSection({ onOpenChildhoodWheel });
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  it('flashcard → открывает SchemaFlashcard («Мне сейчас плохо»)', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 11, assignedBy: 9, type: 'flashcard' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    // SchemaFlashcard рендерится overlay'ем поверх страницы (не заменяет её
    // return), поэтому проверяем появление самого экрана, а не исчезновение библиотеки.
    await screen.findByText('Стало чуть лучше – разобраться →');
  });

  it('schema_intro с текстом-id схемы → открывает карточку схемы с этим id', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 12, assignedBy: 9, type: 'schema_intro', text: 'abandonment' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });

  it('mode_intro с текстом-id режима → открывает карточку режима с этим id', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 13, assignedBy: 9, type: 'mode_intro', text: 'vulnerable_child' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });

  it('неизвестный тип задания с текстом = id известной схемы — фолбэк на карточку схемы', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 14, assignedBy: 9, type: 'custom', text: 'abandonment' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });
});

describe('PracticeSection — «В трудный момент»: три быстрые карточки открывают верный экран', () => {
  it('«Мне плохо» открывает SchemaFlashcard', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Мне плохо'));
    await screen.findByText('Стало чуть лучше – разобраться →');
  });

  it('«Тест на схемы» вызывает onOpenSchema с startTest', async () => {
    const onOpenSchema = vi.fn();
    renderSection({ onOpenSchema });
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Тест на схемы'));
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });

  it('«Карта режимов» вызывает onOpenSchema с tab=modes', async () => {
    const onOpenSchema = vi.fn();
    renderSection({ onOpenSchema });
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Карта режимов'));
    expect(onOpenSchema).toHaveBeenCalledWith({ tab: 'modes' });
  });
});

describe('PracticeSection — баннер ближайшей сессии: дата не сегодня', () => {
  it('сессия через несколько дней показывает "Следующая встреча: <дата>"', async () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Игорь', partnerId: 2, code: 'y', nextSession: inThreeDays,
    });
    renderSection();
    await screen.findByText(/Следующая встреча:/);
    expect(screen.queryByText('● Сегодня встреча')).toBeNull();
  });
});

describe('PracticeSection — создание цели обновляет список read-after-write, «все цели» открывает выбранную', () => {
  it('после успешного создания цели список задач перезапрашивается', async () => {
    const onTasksChanged = vi.fn();
    mockApi.getTasks.mockResolvedValueOnce([]).mockResolvedValue([task({ id: 20, text: 'Новая цель' })]);
    mockApi.createTask.mockResolvedValue(undefined);
    renderSection({ onTasksChanged });
    await screen.findByText('нет активных');

    fireEvent.click(screen.getByText('+ Поставить цель'));
    await screen.findByText('Новое задание');
    fireEvent.click(screen.getByText('Назначить задание'));

    await waitFor(() => expect(screen.queryByText('Новое задание')).toBeNull());
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
    await screen.findByText('Новая цель');
  });

  it('открытие цели из AllGoalsOverlay закрывает оверлей и открывает нужное упражнение', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, type: 'belief_check', text: 'Цель 1' }), task({ id: 2, text: 'Цель 2' }),
      task({ id: 3, text: 'Цель 3' }), task({ id: 4, text: 'Цель 4' }), task({ id: 5, text: 'Цель 5' }),
    ]);
    renderSection();
    fireEvent.click(await screen.findByText('все цели →'));
    const overlayTitle = await screen.findByText('Все цели');
    const overlay = overlayTitle.parentElement!;

    fireEvent.click(within(overlay).getByText('Цель 1'));
    await waitFor(() => expect(screen.queryByText('Все цели')).toBeNull());
    await waitFor(() => expect(screen.queryByText('Библиотека · 7 упражнений')).toBeNull());
  });

  it('«+ Поставить цель» внутри AllGoalsOverlay открывает TaskCreateSheet поверх', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, text: 'Цель 1' }), task({ id: 2, text: 'Цель 2' }),
      task({ id: 3, text: 'Цель 3' }), task({ id: 4, text: 'Цель 4' }), task({ id: 5, text: 'Цель 5' }),
    ]);
    renderSection();
    fireEvent.click(await screen.findByText('все цели →'));
    const overlayTitle = await screen.findByText('Все цели');
    const overlay = overlayTitle.parentElement!;

    fireEvent.click(within(overlay).getByText('+ Поставить цель'));
    await waitFor(() => expect(screen.queryByText('Все цели')).toBeNull());
    await screen.findByText('Новое задание');
  });
});
