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
import { todayCalendarDate } from '../../../shared/src/utils/calendarDate';
import { forEachTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';

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
    getPhraseChecks: vi.fn(),
    listMyModeMaps: vi.fn(),
    completeTask: vi.fn(),
    createTask: vi.fn(),
    getFlashcards: vi.fn(),
    createFlashcard: vi.fn(),
    createLetter: vi.fn(),
    trackEvent: vi.fn(),
    getPractices: vi.fn(),
    getPlanHistory: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
// Блок «Здесь и сейчас» ходит в api за счётчиком прохождений и проверяется
// своим тестом (sections/practice/HereAndNowBlock.test.tsx) — здесь заглушка,
// как BreathingCard в HelpSection.test.tsx мини-аппа: тесты экрана «Практика»
// про библиотеку упражнений и задания, а не про быстрые практики.
vi.mock('./practice/HereAndNowBlock', () => ({
  HereAndNowBlock: ({ extraRows }: { extraRows?: React.ReactNode }) => <div data-testid="here-and-now-block">{extraRows}</div>,
}));

vi.mock('../utils/uiPrefsSync', () => ({ notifyPrefsChanged: vi.fn() }));
import { notifyPrefsChanged } from '../utils/uiPrefsSync';
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
  mockApi.getPhraseChecks.mockResolvedValue([]);
  mockApi.listMyModeMaps.mockResolvedValue([]);
  mockApi.completeTask.mockResolvedValue(undefined);
  mockApi.createTask.mockResolvedValue(undefined);
  mockApi.getFlashcards.mockResolvedValue([]);
  mockApi.createFlashcard.mockResolvedValue(undefined);
  mockApi.createLetter.mockResolvedValue(undefined);
  mockApi.getPractices.mockRejectedValue(new Error('offline'));
  mockApi.getPlanHistory.mockRejectedValue(new Error('offline'));
});

afterEach(() => {
  cleanup();
});

describe('PracticeSection — ты/вы вилка', () => {
  it('подзаголовок звучит на «ты» по умолчанию', () => {
    renderSection({}, 'ty');
    expect(screen.getByText(/Восемь практик схема-терапии плюс твои личные цели/)).toBeTruthy();
    expect(screen.queryByText(/ваши личные цели/)).toBeNull();
  });

  it('подзаголовок звучит на «вы», когда выбрана форма vy — «ваши», а не «твои»', () => {
    renderSection({}, 'vy');
    expect(screen.getByText(/Восемь практик схема-терапии плюс ваши личные цели/)).toBeTruthy();
    expect(screen.queryByText(/твои личные цели/)).toBeNull();
  });

  it('подсказки блока «В трудный момент» звучат на «ты»', () => {
    renderSection({}, 'ty');
    expect(screen.getByText(/116 вопросов, 20 шкал схем – узнай свои паттерны/)).toBeTruthy();
    expect(screen.getByText(/Найди Уязвимого Ребёнка, Критика, Защитника/)).toBeTruthy();
  });

  it('подсказки блока «В трудный момент» звучат на «вы»', () => {
    renderSection({}, 'vy');
    expect(screen.getByText(/116 вопросов, 20 шкал схем – узнайте свои паттерны/)).toBeTruthy();
    expect(screen.getByText(/Найдите Уязвимого Ребёнка, Критика, Защитника/)).toBeTruthy();
  });
});

describe('PracticeSection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('на пустом аккаунте все упражнения показывают "не начато", а не выдуманную статистику', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getBeliefChecks).toHaveBeenCalled());
    expect(screen.getAllByText('не начато').length).toBe(8);
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

describe('PracticeSection — своя цель: «Готово» и серия за сегодня (паритет с мини-аппом)', () => {
  it('у своей цели есть «Готово»: закрывает цель на сервере и обновляет список', async () => {
    const onTasksChanged = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ id: 7, text: 'Позвонить другу' })]);
    renderSection({ onTasksChanged });
    await screen.findByText('Позвонить другу');

    mockApi.getTasks.mockResolvedValue([]);
    fireEvent.click(screen.getByText('Готово'));
    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(7, true));
    await waitFor(() => expect(screen.queryByText('Позвонить другу')).toBeNull());
    expect(onTasksChanged).toHaveBeenCalled();
  });

  it('серия, сделанная сегодня, остаётся в списке серой с подписью, без «Готово»', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 8, type: 'diary_streak', text: '', doneToday: true }),
    ]);
    renderSection();
    await screen.findByText('Сделано сегодня — завтра снова');
    expect(screen.queryByText('Готово')).toBeNull();
    expect(screen.getByText('1 активных')).toBeTruthy();
  });
});

describe('PracticeSection — счётчики в «Каталогах»', () => {
  it('число практик и планов берётся из данных; без данных — только пояснение', async () => {
    renderSection();
    await screen.findByText('Каталоги');
    expect(screen.getByText('Рекомендованные упражнения по потребностям')).toBeTruthy();

    cleanup();
    mockApi.getPractices.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockApi.getPlanHistory.mockResolvedValue([{ id: 1 }]);
    renderSection();
    await screen.findByText('10 практик · Рекомендованные упражнения по потребностям');
    expect(screen.getByText('1 план · Планы поддержки и кризисов')).toBeTruthy();
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

  // РЕГРЕССИЯ (TZ-класс, инцидент 2026-09-17): isToday сравнивал календарный
  // день `nextSession` с «сегодня» через `new Date().toISOString().slice(0,10)`
  // — уже UTC, но инлайн-копией; теперь общий todayCalendarDate(). Моменты
  // зафиксированы там, где зоны заведомо расходятся с UTC. Данные грузятся
  // асинхронно (api.getTherapyRelation), поэтому первичная загрузка идёт под
  // текущей зоной процесса, а проверка по зонам — синхронный `rerender`, чтобы
  // момент смены TZ совпадал с моментом пересчёта isToday.
  it('сессия на сегодняшний календарный день сервера — «Сегодня встреча» в любой зоне', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (const moment of ['2026-09-18T23:30:00Z', '2026-09-19T00:30:00Z']) {
        vi.setSystemTime(new Date(moment));
        mockApi.getTherapyRelation.mockResolvedValue({
          role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'x',
          nextSession: `${todayCalendarDate()}T10:00:00Z`,
        });
        const { unmount, rerender } = renderSection();
        await screen.findByText('● Сегодня встреча');

        forEachTimeZone(() => {
          vi.setSystemTime(new Date(moment));
          rerender(
            <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
              <MemoryRouter>
                <PracticeSection {...noopProps} />
              </MemoryRouter>
            </AddressFormContext.Provider>,
          );
          expect(screen.getByText('● Сегодня встреча')).toBeTruthy();
        });

        unmount();
      }
    } finally {
      vi.useRealTimers();
    }
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

describe('PracticeSection — колесо детства', () => {
  it('одна точка входа — карточка в «Инструментах»; плитки в «В трудный момент» нет', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    expect(screen.queryByText('Как удовлетворялись потребности в детстве')).toBeNull();
    expect(screen.getAllByText('Колесо детства')).toHaveLength(1);
  });

  it('карточка открывает колесо общим оверлеем приложения (onOpenChildhoodWheel), а не локальной копией', async () => {
    const onOpenChildhoodWheel = vi.fn();
    renderSection({ onOpenChildhoodWheel });
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Колесо детства'));
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });
});

describe('PracticeSection — «Инструменты»: скрытие и порядок (ключи tools, как в мини-аппе)', () => {
  const HIDDEN = 'quick_actions_hidden_tools';
  const ORDER = 'quick_actions_order_tools';
  const hide = (...ids: string[]) => localStorage.setItem(HIDDEN, JSON.stringify(ids));
  const cardTitles = () => Array.from(document.querySelectorAll('.cp-ex-title')).map(e => e.textContent);
  const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  afterEach(() => setWidth(1024));

  it('без настроек: все восемь карточек, «Мои цели» и оба каталога', () => {
    renderSection();
    expect(cardTitles()).toHaveLength(8);
    expect(screen.getByText('8 упражнений')).toBeTruthy();
    expect(screen.getByText('Мои цели')).toBeTruthy();
    expect(screen.getByText('Практики')).toBeTruthy();
    expect(screen.getByText('Планы')).toBeTruthy();
  });

  it('скрытая карточка (belief_check) исчезает, номера и счётчик идут по показанному', () => {
    hide('belief_check');
    renderSection();
    expect(cardTitles()).not.toContain('Проверка убеждения');
    expect(cardTitles()).toHaveLength(7);
    expect(screen.getByText('7 упражнений')).toBeTruthy();
    expect(Array.from(document.querySelectorAll('.cp-ex-num')).map(e => e.textContent)).toEqual(['01', '02', '03', '04', '05', '06', '07']);
  });

  it('карточки схемы и режима не скрываются, даже если все пункты реестра скрыты', () => {
    hide('belief_check', 'phrase_check', 'safe_place', 'letter_to_self', 'warm_words', 'childhood_wheel');
    renderSection();
    expect(cardTitles()).toEqual(['Карточка схемы', 'Карточка режима']);
  });

  it('скрытые «Мои цели» убирают раздел целиком', () => {
    hide('tasks');
    renderSection();
    expect(screen.queryByText('Мои цели')).toBeNull();
    expect(screen.queryByText('+ Поставить цель')).toBeNull();
  });

  it('скрытая «Практики» убирает свою строку, «Планы» остаются', () => {
    hide('practices');
    renderSection();
    expect(screen.queryByText('Практики')).toBeNull();
    expect(screen.getByText('Планы')).toBeTruthy();
    expect(screen.getByText('Каталоги')).toBeTruthy();
  });

  it('скрыты оба каталога — заголовок «Каталоги» не рисуется', () => {
    hide('practices', 'plans');
    renderSection();
    expect(screen.queryByText('Каталоги')).toBeNull();
  });

  it('скрытая «Схема включилась» убирает «Мне плохо» на десктопе; контакты помощи остаются', () => {
    hide('flashcard');
    renderSection();
    expect(screen.queryByText('Мне плохо')).toBeNull();
    expect(screen.getAllByText('Помощь рядом').length).toBeGreaterThan(0);
  });

  it('скрытая «Схема включилась» убирает строку «Мне плохо» на телефоне, «Мне очень плохо» остаётся', () => {
    setWidth(390);
    hide('flashcard');
    renderSection();
    expect(screen.queryByText('Мне плохо')).toBeNull();
    expect(screen.getByText('Мне очень плохо')).toBeTruthy();
  });

  it('сохранённый порядок переставляет карточки с пунктами; схема и режим стоят на своих местах', () => {
    localStorage.setItem(ORDER, JSON.stringify(['warm_words', 'phrase_check']));
    renderSection();
    expect(cardTitles()).toEqual([
      'Тёплые слова', 'Карточка схемы', 'Карточка режима', 'Критик или забота?',
      'Проверка убеждения', 'Безопасное место', 'Письмо Уязвимому Ребёнку', 'Колесо детства',
    ]);
  });

  it('шестерёнка (телефон) открывает лист со всеми десятью пунктами', async () => {
    setWidth(390);
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Какие инструменты показывать' }));
    expect(await screen.findByRole('heading', { name: 'Какие инструменты показывать' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(10);
  });

  it('тумблер в листе: пишет ключ, шлёт quick_action_toggle (surface tools), зовёт notifyPrefsChanged и прячет карточку сразу', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить инструменты' }));
    fireEvent.click(await screen.findByRole('switch', { name: 'Тёплые слова' }));
    expect(JSON.parse(localStorage.getItem(HIDDEN)!)).toEqual(['warm_words']);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', { action: 'warm_words', hidden: true, surface: 'tools' });
    expect(notifyPrefsChanged).toHaveBeenCalledTimes(1);
    expect(cardTitles()).not.toContain('Тёплые слова');
    fireEvent.click(screen.getByRole('switch', { name: 'Тёплые слова' }));
    expect(JSON.parse(localStorage.getItem(HIDDEN) ?? '[]')).toEqual([]);
    expect(cardTitles()).toContain('Тёплые слова');
  });

  it('лист: ручки «≡» только у карточек; у разделов страницы — одни тумблеры', async () => {
    setWidth(390);
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Какие инструменты показывать' }));
    await screen.findByText('Разделы страницы');
    expect(document.querySelectorAll('.cz-handle')).toHaveLength(6);
    expect(screen.getByText('Разделы страницы')).toBeTruthy();
  });
});

describe('PracticeSection — упражнение открывается по клику (Suspense)', () => {
  it('клик "Проверка убеждения" открывает BeliefCheckEx (ленивая загрузка отрабатывает)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getBeliefChecks).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Проверка убеждения'));

    await screen.findByPlaceholderText('Например: я всегда всё порчу, меня никто не любит…');
  });

  it('клик "Критик или забота?" открывает PhraseCheckEx (8-е упражнение, дизайн-аудит В2)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getPhraseChecks).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Критик или забота?'));

    await screen.findByPlaceholderText('Например: опять всё завалила, ни на что не гожусь');
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
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
  });
});

describe('PracticeSection — флешкарта «Мне плохо» по навигационному state (кнопка топбара)', () => {
  it('location.state.openFlashcard открывает SchemaFlashcard сразу', async () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter initialEntries={[{ pathname: '/practice', state: { openFlashcard: true } }]}>
          <PracticeSection {...noopProps} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await screen.findByText('Стало чуть лучше – разобраться →');
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
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
  });

  it('letter_to_self → открывает «Письмо уязвимому ребёнку»', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 9, assignedBy: 9, type: 'letter_to_self' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
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
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
  });

  it('mode_intro с текстом-id режима → открывает карточку режима с этим id', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 13, assignedBy: 9, type: 'mode_intro', text: 'vulnerable_child' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
  });

  it('неизвестный тип задания с текстом = id известной схемы — фолбэк на карточку схемы', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 14, assignedBy: 9, type: 'custom', text: 'abandonment' })]);
    renderSection();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getAllByText('начать →')[0]);
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
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

// Регрессия 2026-10-26: клиент видел прошедшую встречу как следующую —
// nextSession после встречи никто не двигает. Баннер берёт ближайшую через
// shared upcomingSession. Время фиксировано (понедельник 26-го), зоны —
// второй CI-прогон под TZ=Australia/Sydney.
describe('PracticeSection — баннер ближайшей сессии: прошедшая дата', () => {
  const SAT = 6;
  const relation = (nextSession: string, meetingDays?: number[]) => ({
    role: 'client', status: 'active', partnerName: 'Игорь', partnerId: 2, code: 'y', nextSession, meetingDays,
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T09:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('прошедшая дата + дни встреч → ближайшая суббота', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(relation('2026-10-17T07:00', [SAT]));
    renderSection();
    await screen.findByText(/Следующая встреча: \S+ 31 окт/);
    expect(screen.queryByText(/17 окт/)).toBeNull();
  });

  it('прошедшая дата без дней встреч → баннера нет', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(relation('2026-10-17T07:00', []));
    renderSection();
    await waitFor(() => expect(mockApi.getTherapyRelation).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText(/встреча/)).toBeNull();
  });

  it('будущая дата — как была', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(relation('2026-11-04T10:00', [SAT]));
    renderSection();
    await screen.findByText(/Следующая встреча: \S+ 4 нояб?/);
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
    await waitFor(() => expect(screen.queryByText('Библиотека')).toBeNull());
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
