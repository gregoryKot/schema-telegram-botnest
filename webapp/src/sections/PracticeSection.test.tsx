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
import { todayStr } from '../utils/format';
import { forEachTimeZoneAsync } from '../../../shared/src/utils/timeZone.test-helpers';

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
  HereAndNowBlock: ({ extraRows, onSos }: { extraRows?: React.ReactNode; onSos?: () => void }) => (
    <div data-testid="here-and-now-block">{onSos && <button onClick={onSos}>Мне плохо</button>}{extraRows}</div>
  ),
}));

vi.mock('../utils/uiPrefsSync', () => ({ notifyPrefsChanged: vi.fn() }));
import { notifyPrefsChanged } from '../utils/uiPrefsSync';
import { api } from '../api';
import { plainText } from '../test-support/plainText';
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
  mockApi.createLetter.mockResolvedValue({ id: 1, text: '', createdAt: '' });
  mockApi.getPractices.mockRejectedValue(new Error('offline'));
  mockApi.getPlanHistory.mockRejectedValue(new Error('offline'));
});

afterEach(() => {
  cleanup();
});

describe('PracticeSection — ты/вы вилка', () => {
  it('подзаголовок шапки звучит на «ты» и на «вы»', () => {
    renderSection({}, 'ty');
    expect(screen.getByText('Тяжёлый момент? Начни с одного вдоха')).toBeTruthy();
    cleanup();
    renderSection({}, 'vy');
    expect(screen.getByText('Тяжёлый момент? Начните с одного вдоха')).toBeTruthy();
  });

  it('подпись «Карты режимов» в «Каталогах» звучит на «ты»', () => {
    renderSection({}, 'ty');
    expect(screen.getByText(/Найди Уязвимого Ребёнка, Критика, Защитника/)).toBeTruthy();
  });

  it('подпись «Карты режимов» в «Каталогах» звучит на «вы»', () => {
    renderSection({}, 'vy');
    expect(screen.getByText(/Найдите Уязвимого Ребёнка, Критика, Защитника/)).toBeTruthy();
  });
});

describe('PracticeSection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('на пустом аккаунте все упражнения показывают "не начато", а не выдуманную статистику', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getBeliefChecks).toHaveBeenCalled());
    expect(screen.getAllByText('не начато').length).toBe(8);
  });
});

describe('PracticeSection — статистика упражнений из реальных данных', () => {
  it('пройденное упражнение показывает реальное число записей и дату, а не заглушку', async () => {
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: new Date().toISOString() }]);
    renderSection();

    const stat = (await screen.findByText(/1 запись/)).closest('.cp-ex-state')!;
    expect(stat.textContent).toContain('сегодня');
  });
});

describe('PracticeSection — счётчики в «Каталогах»', () => {
  it('число своих действий и планов берётся из данных; без данных — только пояснение', async () => {
    renderSection();
    await screen.findByText('Каталоги');
    expect(screen.getByText('Маленькие действия для пяти потребностей')).toBeTruthy();

    cleanup();
    mockApi.getPractices.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockApi.getPlanHistory.mockResolvedValue([{ id: 1 }]);
    renderSection();
    await screen.findByText('10 действий · Маленькие действия для пяти потребностей');
    expect(screen.getByText('1 план · Планы поддержки и кризисов')).toBeTruthy();
  });
});

describe('PracticeSection — баннер ближайшей сессии', () => {
  it('клиент с сессией сегодня видит "Сегодня встреча"', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'x',
      // Настенное время терапевта без зоны, как в базе: «сегодня» — местный день.
      nextSession: `${todayStr()}T10:00`,
    });
    renderSection();

    await screen.findByText('● Сегодня встреча');
    // Имя без падежа («с Анна» ломалось на любом имени) — формула «Терапевт: имя».
    expect(screen.getByText(/Терапевт: Анна/)).toBeTruthy();
    expect(screen.queryByText(/с Анна/)).toBeNull();
  });

  // РЕГРЕССИЯ (TZ-класс, инцидент 2026-09-17, QA 2026-10-26): isToday
  // сравнивал день `nextSession` с днём UTC. nextSession — настенное время,
  // которое терапевт ввёл по своим часам, поэтому «сегодня» — местный день
  // (isSessionToday). Моменты — там, где местный день расходится с UTC; в
  // каждой зоне — своя загрузка, потому что «сегодня» в зонах разное.
  it('сессия на местный сегодняшний день — «Сегодня встреча» в любой зоне', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (const moment of ['2026-09-18T23:30:00Z', '2026-09-19T00:30:00Z']) {
        await forEachTimeZoneAsync(async (tz) => {
          vi.setSystemTime(new Date(moment));
          mockApi.getTherapyRelation.mockResolvedValue({
            role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'x',
            nextSession: `${todayStr()}T10:00`,
          });
          const { unmount } = renderSection();
          expect(await screen.findByText('● Сегодня встреча'), `${moment} / ${tz}`).toBeTruthy();
          unmount();
        });
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
    expect(screen.queryByText(/Следующая встреча|Сегодня встреча/)).toBeNull();
  });
});

// Хвост 5.6/волны 4: после снятия теста в блоке «В трудный момент» осталась одна «Карта
// режимов», а «Здесь и сейчас» повторяло переход к героям вверху. b14: раздел-сирота снят,
// «Карта режимов» — строкой в «Каталогах»; верхнего ряда, повторявшего героя дыхания, нет.
describe('PracticeSection — раздела «В трудный момент» и верхнего ряда нет', () => {
  it('«Карта режимов» — строка «Каталогов» со знаком; «В трудный момент» не рисуется', async () => {
    renderSection();
    expect(screen.queryByText('В трудный момент')).toBeNull();
    const block = screen.getByRole('heading', { name: 'Каталоги' }).closest('section')!;
    const row = within(block).getByText('Карта режимов').closest('[role="button"]')!;
    expect(row.querySelector('.pp-row-art svg')).not.toBeNull();
    // Плитки верхнего ряда «Помощь рядом» нет; та же надпись у самой кризисной карточки (b12) — законна.
    const tiles = screen.queryAllByText('Помощь рядом', { selector: '.ds-label' })
      .filter((el) => !el.closest('[data-crisis-card]'));
    expect(tiles).toEqual([]);
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
  const cardTitles = () => Array.from(document.querySelectorAll('.cp-ex-title')).map(e => e.textContent?.replace(/\u00a0/g, ' '));
  const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  afterEach(() => setWidth(1024));

  it('без настроек: все восемь карточек, строка заданий и оба каталога', () => {
    renderSection();
    expect(cardTitles()).toHaveLength(8);
    expect(screen.getByText('8 упражнений')).toBeTruthy();
    expect(screen.getByText('Задания и цели')).toBeTruthy();
    expect(screen.getByText('Что питает')).toBeTruthy();
    expect(screen.getByText('Планы')).toBeTruthy();
  });

  it('скрытая карточка (belief_check) исчезает, счётчик идёт по показанному; номеров 01–08 нет', () => {
    hide('belief_check');
    renderSection();
    expect(cardTitles()).not.toContain('Проверка убеждения');
    expect(cardTitles()).toHaveLength(7);
    expect(screen.getByText('7 упражнений')).toBeTruthy();
    expect(document.querySelector('.cp-ex-num')).toBeNull();
  });

  it('карточки схемы и режима не скрываются, даже если все пункты реестра скрыты', () => {
    hide('belief_check', 'phrase_check', 'safe_place', 'letter_to_self', 'warm_words', 'childhood_wheel');
    renderSection();
    expect(cardTitles()).toEqual(['Карточка схемы', 'Карточка режима']);
  });

  it('скрытые «Мои цели» убирают строку заданий, если от терапевта ничего нет', async () => {
    hide('tasks');
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    expect(screen.queryByText('Задания и цели')).toBeNull();
  });

  it('скрытая «Что питает» убирает свою строку, «Планы» остаются', () => {
    hide('practices');
    renderSection();
    expect(screen.queryByText('Что питает')).toBeNull();
    expect(screen.getByText('Планы')).toBeTruthy();
    expect(screen.getByText('Каталоги')).toBeTruthy();
  });

  it('скрыты оба каталога — в «Каталогах» остаётся «Карта режимов» (её пункта в «Инструментах» нет)', () => {
    hide('practices', 'plans');
    renderSection();
    const block = screen.getByRole('heading', { name: 'Каталоги' }).closest('section')!;
    expect(within(block).getAllByRole('button').map(b => b.textContent)).toEqual([expect.stringContaining('Карта режимов')]);
  });

  it('скрытая «Мне плохо» в «Инструментах» убирает карточку на десктопе; контакты помощи остаются', () => {
    hide('flashcard');
    renderSection();
    expect(screen.queryByText('Мне плохо')).toBeNull();
    expect(screen.getAllByText('Помощь рядом').length).toBeGreaterThan(0);
  });

  // Ревью g4 r3: сердце квадрата «Мне плохо» стояло вплотную над сердцем «Помощи рядом».
  it('«Помощь рядом» под квадратом «Мне плохо» — без своего сердца; квадрат скрыт — сердце у блока', () => {
    renderSection();
    expect(screen.getByText('Мне плохо')).toBeTruthy();
    expect(document.querySelector('[data-crisis-card] svg')).toBeNull();
    cleanup();
    hide('flashcard');
    renderSection();
    expect(document.querySelector('[data-crisis-card] svg')).not.toBeNull();
  });

  it('скрытая «Мне плохо» в «Инструментах» убирает строку на телефоне, «Мне очень плохо» остаётся', () => {
    setWidth(390);
    hide('flashcard');
    renderSection();
    expect(screen.queryByText('Мне плохо')).toBeNull();
    expect(screen.getByText('Мне очень плохо')).toBeTruthy();
  });

  it('без сохранённого порядка — порядок библиотеки (в нём соседи бенто разной бумаги)', () => {
    renderSection();
    expect(cardTitles()).toEqual([
      'Проверка убеждения', 'Карточка схемы', 'Карточка режима', 'Письмо себе в детстве',
      'Безопасное место', 'Колесо детства', 'Тёплые слова', 'Критик или забота?',
    ]);
  });

  it('сохранённый порядок переставляет карточки с пунктами; схема и режим стоят на своих местах', () => {
    localStorage.setItem(ORDER, JSON.stringify(['warm_words', 'phrase_check']));
    renderSection();
    expect(cardTitles()).toEqual([
      'Тёплые слова', 'Карточка схемы', 'Карточка режима', 'Критик или забота?',
      'Проверка убеждения', 'Письмо себе в детстве', 'Безопасное место', 'Колесо детства',
    ]);
  });

  it('«Настроить инструменты» (телефон) открывает лист со всеми десятью пунктами', async () => {
    setWidth(390);
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить инструменты' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Настроить инструменты' }));
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

// «N дней назад» — местным календарём, в полдень: сутки ≠ 24 ч на переходе часов.
const noonDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

describe('PracticeSection — «давность» и число записей форматируются по реальным датам/числам', () => {
  it('lastDone вчера — подпись "вчера"', async () => {
    const yesterday = noonDaysAgo(1);
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: yesterday }]);
    renderSection();
    const stat = (await screen.findByText(/1 запись/)).closest('.cp-ex-state')!;
    expect(stat.textContent).toContain('вчера');
  });

  it('lastDone 3 дня назад — подпись "3 дн. назад"', async () => {
    const threeDaysAgo = noonDaysAgo(3);
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: threeDaysAgo }]);
    renderSection();
    const stat = (await screen.findByText(/1 запись/)).closest('.cp-ex-state')!;
    expect(stat.textContent).toContain('3 дн. назад');
  });

  it('3 записи — счётчик "3 записи" (не "запись" и не "записей")', async () => {
    const now = new Date().toISOString();
    mockApi.getBeliefChecks.mockResolvedValue([{ id: 1, createdAt: now }, { id: 2, createdAt: now }, { id: 3, createdAt: now }]);
    renderSection();
    await screen.findByText(/3 записи/);
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

describe('PracticeSection — кризисный вход и каталоги открывают верный экран', () => {
  it('«Мне плохо» открывает SchemaFlashcard', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Мне плохо'));
    await screen.findByText('Стало чуть лучше – разобраться →');
  });

  it('тест на 116 вопросов на странице не предлагается: в трудную минуту он не помогает (FIX_PLAN 4.10)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    expect(screen.queryByText('Тест на схемы')).toBeNull();
    expect(screen.queryByText(/116 вопросов/)).toBeNull();
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
  const relation = (nextSession: string | null, meetingDays?: number[]) => ({
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
    expect(screen.queryByText(/Следующая встреча|Сегодня встреча/)).toBeNull();
  });

  it('даты нет, только дни встреч → ближайшая суббота без сдвига дня', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(relation(null, [SAT]));
    renderSection();
    await screen.findByText(/Следующая встреча: сб,? 31 окт/i);
  });

  it('будущая дата — как была', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(relation('2026-11-04T10:00', [SAT]));
    renderSection();
    await screen.findByText(/Следующая встреча: \S+ 4 нояб?/);
  });
});


describe('PracticeSection — строка «Задания и цели» ведёт в узел заданий', () => {
  it('подпись считает задания терапевта и свои цели; тап открывает узел «Задания»', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, assignedBy: 9, type: 'diary_streak', text: 'A' }),
      task({ id: 2, assignedBy: null, text: 'Моя цель' }),
    ]);
    renderSection();
    await screen.findByText('1 от терапевта · 1 цель');
    fireEvent.click(screen.getByText('Задания и цели'));
    await screen.findByText('Моя цель');
  });

  it('скрытые «Мои цели», но есть задание терапевта — строка остаётся', async () => {
    localStorage.setItem('quick_actions_hidden_tools', JSON.stringify(['tasks']));
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 9, type: 'diary_streak', text: 'A' })]);
    renderSection();
    await screen.findByText('1 от терапевта');
  });
});
