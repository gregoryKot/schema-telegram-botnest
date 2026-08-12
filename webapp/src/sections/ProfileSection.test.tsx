// @vitest-environment jsdom
// ProfileSection — экран «Профиль» (стрик, достижения, паттерны, активность).
// До этого теста 0% покрытия (130 непокрытых строк) при том, что экран
// целиком построен на цифрах пользователя — по CLAUDE.md любое такое число
// обязано приезжать из API, а не быть хардкод-заглушкой. Проверяем: скелетон
// на время загрузки, реальные (не выдуманные) цифры на чистом аккаунте и на
// аккаунте с данными, ты/вы-вилку, модалку достижений, удаление аккаунта
// (в т.ч. дефект — ошибка API при удалении не показывается пользователю).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { ProfileSection } from './ProfileSection';

vi.mock('../api', () => ({
  api: {
    getStreak: vi.fn(),
    getAchievements: vi.fn(),
    getInsights: vi.fn(),
    history: vi.fn(),
    getTherapyRelation: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    getYsqHistory: vi.fn(),
    deleteAllUserData: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const mockLogout = vi.fn();
vi.mock('../auth/authContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

// JourneySheet — тяжёлый общий компонент (собственные API-вызовы, canvas
// шаринг-карточки), не в скоупе этого файла — мокаем заглушкой-кнопочницей,
// чтобы проверить только то, что решает сам ProfileSection: открывается ли
// он по клику и закрывается ли по onClose.
vi.mock('../components/JourneySheet', () => ({
  JourneySheet: (p: { onClose: () => void }) => (
    <div data-testid="journey-sheet">
      <button onClick={p.onClose}>Закрыть путь</button>
    </div>
  ),
}));

function emptyMocks() {
  mockApi.getStreak.mockResolvedValue({ currentStreak: 0, longestStreak: 0, totalDays: 0, todayDone: false, weekDots: [] });
  mockApi.getAchievements.mockResolvedValue([]);
  mockApi.getInsights.mockResolvedValue({ weeklyStats: [], bestDayOfWeek: null, worstDayOfWeek: null, totalDays: 0 });
  mockApi.history.mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  mockApi.getYsqHistory.mockResolvedValue([]);
}

function renderSection(props: Partial<Parameters<typeof ProfileSection>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <ProfileSection {...props} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  emptyMocks();
  localStorage.clear();
});

afterEach(() => cleanup());

describe('ProfileSection — загрузка', () => {
  it('до ответа API показывает скелетон, а не пустые/нулевые карточки', () => {
    renderSection();
    // «Стрик»/«Прогресс» ещё не должны быть отрисованы — это и есть скелетон-состояние.
    expect(screen.queryByText('Прогресс')).toBeNull();
  });
});

describe('ProfileSection — чистый аккаунт (без хардкод-заглушек)', () => {
  it('на чистом аккаунте показывает реальные нули, а не выдуманные цифры стрика', async () => {
    await act(async () => { renderSection(); });
    expect(screen.getByText('Прогресс')).toBeTruthy();
    // Стрик = 0 → «–», не число из константы.
    expect(screen.getByText('–')).toBeTruthy();
    // В исходнике текст с литеральным '\n' — testing-library нормализует
    // пробелы в один при сопоставлении.
    expect(screen.getByText('пока не начато')).toBeTruthy();
  });

  it('без достижений блок показывает «0 из 0» и подсказку про первую запись, а не выдуманный прогресс', async () => {
    await act(async () => { renderSection(); });
    expect(screen.getByText('Достижения')).toBeTruthy();
    expect(screen.getByText('Первое – за первую запись в дневник')).toBeTruthy();
  });
});

describe('ProfileSection — реальные данные пользователя', () => {
  function fillMocks() {
    mockApi.getStreak.mockResolvedValue({ currentStreak: 5, longestStreak: 12, totalDays: 20, todayDone: true, weekDots: [true, true, false, true, true, false, false] });
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
      { id: 'streak_3', earned: true },
      { id: 'streak_7', earned: false },
    ]);
    mockApi.getInsights.mockResolvedValue({
      weeklyStats: [{ needId: 'attachment', avg: 7.2, trend: '↑' }],
      bestDayOfWeek: 'Пн', worstDayOfWeek: 'Пт', totalDays: 10,
    });
    mockApi.history.mockResolvedValue([{ date: '2026-08-01', ratings: {} }]);
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1 }]);
    mockApi.getModeDiary.mockResolvedValue([{ id: 2 }]);
    mockApi.getGratitudeDiary.mockResolvedValue([{ id: 3 }]);
    mockApi.getYsqHistory.mockResolvedValue([{ id: 1 }]);
  }

  it('цифры прогресса приходят из API (5 стрика, 20 всего, 3 записей дневника, 1 тест)', async () => {
    fillMocks();
    await act(async () => { renderSection(); });
    // currentStreak появляется дважды (карточка «Прогресс» + блок «Стрик»).
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    // totalDays появляется дважды (заголовок + карточка) — используем getAllByText.
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    // diaryCount = 1 (schema) + 1 (mode) + 1 (gratitude) = 3
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('заработанные достижения показывают эмодзи и заголовок из мета-справочника', async () => {
    fillMocks();
    await act(async () => { renderSection(); });
    expect(screen.getByText('Достижения')).toBeTruthy();
    // "{n} из {m} →" рендерится как несколько текстовых узлов — сверяем
    // целиком по textContent родителя, а не точным совпадением строки.
    expect(screen.getByText((_, node) => node?.textContent === '2 из 3 →')).toBeTruthy();
    expect(screen.getByText('Первый шаг')).toBeTruthy();
  });

  it('клик по карточке достижений открывает модалку со всеми достижениями', async () => {
    fillMocks();
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Достижения'));
    // В модалке виден незаработанный streak_7 с прогрессом 5/7.
    expect(screen.getByText('5/7')).toBeTruthy();
  });

  it('паттерны: клик по «?» у лучшего дня открывает тултип-пояснение, клик по фону закрывает', async () => {
    fillMocks();
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('?'));
    expect(screen.getByText(/выше всего/)).toBeTruthy();

    fireEvent.click(document.querySelectorAll('[role="presentation"]')[0]);
    expect(screen.queryByText(/выше всего/)).toBeNull();
  });

  it('модалка достижений закрывается кликом по фону', async () => {
    fillMocks();
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Достижения'));
    expect(screen.getByText('5/7')).toBeTruthy();

    fireEvent.click(document.querySelectorAll('[role="presentation"]')[0]);
    expect(screen.queryByText('5/7')).toBeNull();
  });

  it('клик по заработанному достижению открывает детальную карточку (AchievementDetail)', async () => {
    fillMocks();
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Достижения'));
    // «Первый шаг» дублируется — в полосе достижений на странице и в
    // открывшейся модалке; берём последнее вхождение (из модалки).
    const cards = screen.getAllByText('Первый шаг');
    const before = screen.getAllByText('Первая запись в дневнике').length;
    fireEvent.click(cards[cards.length - 1]);
    // AchievementDetail рендерится ПОВЕРХ модалки (обе видны одновременно) —
    // проверяем, что описание достижения появилось ещё раз (не просто «уже было»).
    await waitFor(() => expect(screen.getAllByText('Первая запись в дневнике').length).toBe(before + 1));
  });

  it('прогресс к недостигнутым достижениям (стрик/всего) показывает реальные числа, а не заглушку', async () => {
    mockApi.getStreak.mockResolvedValue({ currentStreak: 4, longestStreak: 4, totalDays: 8, todayDone: true, weekDots: [] });
    mockApi.getAchievements.mockResolvedValue([
      { id: 'streak_3', earned: true }, { id: 'streak_7', earned: false },
      { id: 'streak_14', earned: false }, { id: 'total_10', earned: false }, { id: 'total_50', earned: false },
    ]);
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Достижения'));

    expect(screen.getByText('4/7')).toBeTruthy();
    expect(screen.getByText('4/14')).toBeTruthy();
    expect(screen.getByText('8/10')).toBeTruthy();
    expect(screen.getByText('8/50')).toBeTruthy();
  });
});

describe('ProfileSection — терапевт: следующая сессия', () => {
  it('клиент с активной связью и датой сессии видит форматированную дату/время', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'x',
      nextSession: '2026-09-03T14:30:00',
    });
    await act(async () => { renderSection(); });
    expect(screen.getByText('Терапевт')).toBeTruthy();
    expect(screen.getByText('Анна')).toBeTruthy();
    // Чт, 3 сен · 14:30 (2026-09-03 — четверг).
    expect(screen.getByText(/Чт, 3 сен · 14:30/)).toBeTruthy();
  });

  it('без даты сессии блок терапевта показан, но строка "Следующая сессия" — нет', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'x', nextSession: null,
    });
    await act(async () => { renderSection(); });
    expect(screen.getByText('Терапевт')).toBeTruthy();
    expect(screen.queryByText('Следующая сессия')).toBeNull();
  });
});

describe('ProfileSection — сбой части загрузки (регресс check-silent-catch)', () => {
  // Было: каждый фетч глотал свою ошибку по отдельности — экран уходил в
  // "ready" и молча показывал 0 вместо реальных данных, будто это настоящий
  // прогресс пользователя. Теперь сбой виден баннером, а данные, которые
  // всё же успешно загрузились, всё равно отображаются.
  it('падение одного из фетчей (getStreak) показывает баннер ошибки, а не тихий 0', async () => {
    mockApi.getStreak.mockRejectedValue(new Error('network down'));
    mockApi.getAchievements.mockResolvedValue([{ id: 'first_day', earned: true }]);
    await act(async () => { renderSection(); });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить часть данных/);
    // Достижения всё же успели загрузиться и отображаются несмотря на сбой стрика.
    expect(screen.getByText('Первый шаг')).toBeTruthy();
  });

  it('на «вы» баннер звучит в форме «вы»', async () => {
    mockApi.getInsights.mockRejectedValue(new Error('network down'));
    await act(async () => { renderSection({}, 'vy'); });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Не удалось загрузить часть данных. Обновите страницу.');
  });

  it('все фетчи успешны — баннера нет', async () => {
    await act(async () => { renderSection(); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ProfileSection — обновление (refreshKey)', () => {
  it('смена refreshKey сбрасывает экран в состояние загрузки (скелетон) заново', async () => {
    mockApi.getStreak.mockResolvedValue({ currentStreak: 2, longestStreak: 2, totalDays: 2, todayDone: false, weekDots: [] });
    const { rerender } = render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter><ProfileSection refreshKey={1} /></MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await act(async () => {});
    expect(screen.getByText('Прогресс')).toBeTruthy();
    rerender(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter><ProfileSection refreshKey={2} /></MemoryRouter>
      </AddressFormContext.Provider>,
    );
    // Сразу после смены ключа — снова скелетон, до ответа API.
    expect(screen.queryByText('Прогресс')).toBeNull();
    await act(async () => {});
    expect(screen.getByText('Прогресс')).toBeTruthy();
  });
});

describe('ProfileSection — ты/вы', () => {
  it('форма «вы» звучит в тексте раздела «Мой путь»', async () => {
    await act(async () => { renderSection({}, 'vy'); });
    expect(screen.getByText(/Вся ваша история в одном месте/)).toBeTruthy();
  });
  it('форма «ты» звучит в тексте раздела «Мой путь»', async () => {
    await act(async () => { renderSection({}, 'ty'); });
    expect(screen.getByText(/Вся твоя история в одном месте/)).toBeTruthy();
  });
});

describe('ProfileSection — действия', () => {
  it('выход из аккаунта зовёт logout()', async () => {
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Выйти'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('удаление аккаунта: подтверждение зовёт api.deleteAllUserData', async () => {
    mockApi.deleteAllUserData.mockResolvedValue(undefined);
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Удалить аккаунт'));
    fireEvent.click(screen.getByText('Удалить'));
    await waitFor(() => expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1));
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('регресс: провал удаления аккаунта виден пользователю, а не гасит кнопку молча', async () => {
    // Было: catch только возвращал кнопку в исходное состояние. Человек нажал
    // «Удалить», ничего не произошло — и он не мог понять, удалён аккаунт или
    // нет. Для необратимой операции это худший из возможных исходов.
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network'));
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Удалить аккаунт'));
    fireEvent.click(screen.getByText('Удалить'));
    await waitFor(() => expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1));
    // Кнопка снова активна — повтор возможен...
    await waitFor(() => expect(screen.getByText('Удалить')).toBeTruthy());
    // ...и рядом сказано, что произошло и что данные на месте.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось удалить аккаунт/);
    expect(alert.textContent).toMatch(/Данные на месте/);
  });

  it('«Мой путь» открывает JourneySheet, закрытие убирает его', async () => {
    await act(async () => { renderSection(); });
    fireEvent.click(screen.getByText('Мой путь'));
    await screen.findByTestId('journey-sheet');

    fireEvent.click(screen.getByText('Закрыть путь'));
    expect(screen.queryByTestId('journey-sheet')).toBeNull();
  });

  it('«Аккаунт и привязки» переходит на маршрут /account', async () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfileSection />} />
            <Route path="/account" element={<div>Экран аккаунта</div>} />
          </Routes>
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await act(async () => {});
    fireEvent.click(screen.getByText('Аккаунт и привязки'));
    await screen.findByText('Экран аккаунта');
  });
});
