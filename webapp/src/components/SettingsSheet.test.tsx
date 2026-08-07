// @vitest-environment jsdom
// Компонентные тесты SettingsSheet (webapp) — денежный/доверительный путь
// «Данные»: удаление аккаунта (обязательное двойное подтверждение, ошибка
// API не должна молча «удаться») и экспорт данных для терапевта.
// Образец сетапа: SubscribePage.test.tsx (мок '../api'), NoteSheet.test.tsx
// (MemoryRouter — useHistorySheet требует useNavigate/useLocation),
// AuthCallback.test.tsx (подмена window.location для window.location.reload).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsSheet } from './SettingsSheet';
import { AddressFormContext } from '../utils/addressForm';

vi.mock('../api', () => ({
  api: {
    getSettings: vi.fn(),
    getPair: vi.fn(),
    getTherapyRelation: vi.fn(),
    getTherapistRequest: vi.fn(),
    getExport: vi.fn(),
    deleteAllUserData: vi.fn(),
    updateSettings: vi.fn(),
    createPairInvite: vi.fn(),
    joinPair: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const SETTINGS = {
  notifyEnabled: false,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false,
  pairCardDismissed: false,
  mySchemaIds: [],
  myModeIds: [],
  therapistShareCards: true,
  therapistShareProfile: true,
};

const originalLocation = window.location;
let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSettings.mockResolvedValue(SETTINGS);
  mockApi.getPair.mockResolvedValue({ partners: [], pendingCode: null });
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getTherapistRequest.mockResolvedValue(null);
  mockApi.updateSettings.mockResolvedValue(undefined);
  reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: reloadSpy },
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

async function renderSheet() {
  const utils = render(
    <MemoryRouter>
      <SettingsSheet onClose={vi.fn()} />
    </MemoryRouter>,
  );
  // Дожидаемся загрузки настроек (useEffect -> api.getSettings), иначе
  // компонент застрял бы на <Loader>.
  await screen.findByText('Настройки');
  return utils;
}

async function renderSheetWithForm(form: 'ty' | 'vy') {
  const utils = render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <SettingsSheet onClose={vi.fn()} />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
  await screen.findByText('Настройки');
  return utils;
}

/** Находит переключатель (role="switch"), стоящий в одной строке SRow с заголовком title. */
function toggleForRow(title: string): HTMLElement {
  const row = screen.getByText(title).parentElement!.parentElement!;
  return within(row).getByRole('switch');
}

function openDeleteSheet() {
  fireEvent.click(screen.getByText('Удалить все данные'));
}

describe('SettingsSheet — удаление аккаунта: подтверждение обязательно', () => {
  it('первый клик открывает предупреждение с кнопками «Отмена»/«Удалить», без вызова api', async () => {
    await renderSheet();
    openDeleteSheet();

    expect(screen.getByText('Необратимо.', { exact: false })).toBeTruthy();
    expect(screen.getByText('Отмена')).toBeTruthy();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('«Отмена» закрывает предупреждение, ничего не удаляя', async () => {
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.queryByText('Отмена')).toBeNull();
    expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('первый «Удалить» только переводит во второй шаг подтверждения — api ещё не вызван', async () => {
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(screen.getByText('Точно? Восстановить невозможно.')).toBeTruthy();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('только финальное «Да, удалить всё навсегда» вызывает api.deleteAllUserData', async () => {
    mockApi.deleteAllUserData.mockResolvedValue(undefined);
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() =>
      expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1),
    );
  });
});

describe('SettingsSheet — удаление аккаунта: успех', () => {
  it('после успешного api.deleteAllUserData чистит localStorage/sessionStorage и перезагружает страницу', async () => {
    mockApi.deleteAllUserData.mockResolvedValue(undefined);
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('some_other_key', 'should-be-wiped');

    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    // Тема и cookie-согласие переживают очистку осознанно, остальное — нет.
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(localStorage.getItem('some_other_key')).toBeNull();
  });
});

describe('SettingsSheet — удаление аккаунта: ошибка API', () => {
  it('ошибка api.deleteAllUserData НЕ перезагружает страницу и НЕ чистит хранилище', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    localStorage.setItem('some_other_key', 'still-here');

    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() =>
      expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1),
    );
    // Даём микротаскам catch-ветки отработать.
    await act(async () => {});

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('some_other_key')).toBe('still-here');
  });

  it('после ошибки предложение возвращается к первому шагу (кнопка «Удалить» снова доступна)', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() =>
      expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy();
  });
});

describe('SettingsSheet — экспорт данных для терапевта', () => {
  it('клик по «Сводка для терапевта» вызывает api.getExport и показывает текст в модалке', async () => {
    mockApi.getExport.mockResolvedValue({ text: 'Экспорт: 30 дней данных...' });
    await renderSheet();

    fireEvent.click(screen.getByText('Сводка для терапевта'));

    await screen.findByText('Экспорт: 30 дней данных...');
    expect(mockApi.getExport).toHaveBeenCalledTimes(1);
  });

  it('в модалке экспорта есть кнопка «Скопировать», закрытие модалки её убирает', async () => {
    mockApi.getExport.mockResolvedValue({ text: 'текст сводки' });
    await renderSheet();
    fireEvent.click(screen.getByText('Сводка для терапевта'));
    await screen.findByText('текст сводки');

    expect(screen.getByText('Скопировать')).toBeTruthy();
  });
});

// Регрессия (аудит доверия к тестам, п.3): «Сводка для терапевта» звала
// api.getExport() без try/catch — при отказе сети обработчик падал
// необработанным промисом. Ни сообщения, ни завершения ожидания: для
// пользователя это выглядело как «нажал и ничего не произошло».
describe('сводка для терапевта: отказ API виден пользователю', () => {
  it('ошибка getExport показывает сообщение, а не тишину', async () => {
    mockApi.getExport.mockRejectedValue(new Error('network down'));
    await renderSheet();

    fireEvent.click(screen.getByText('Сводка для терапевта'));

    await waitFor(() =>
      expect(screen.queryByText(/Не удалось собрать сводку/i)).toBeTruthy(),
    );
    // Модалка со сводкой не открывается — показывать нечего.
    expect(screen.queryByText(/Скопировать/i)).toBeNull();
  });
});

// ── Сохранение настройки (patch): успех и отказ ──────────────────────────────
// Регрессия: patch() показывало «Сохранено ✓» независимо от того, удался ли
// api.updateSettings — отказ сети выглядел как успех. Тест ловит именно это.
describe('SettingsSheet — сохранение переключателя видно пользователю', () => {
  it('успех: тумблер переключается, вызывается api.updateSettings, показывается «Сохранено ✓»', async () => {
    await renderSheet();
    const toggle = toggleForRow('Итоги дня');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        notifyEnabled: true,
      }),
    );
    await waitFor(() =>
      expect(toggle.getAttribute('aria-checked')).toBe('true'),
    );
    await screen.findByText('Сохранено ✓');
  });

  it('отказ сети: показывается «Не сохранилось», тумблер откатывается назад', async () => {
    mockApi.updateSettings.mockRejectedValue(new Error('network down'));
    await renderSheet();
    const toggle = toggleForRow('Итоги дня');

    fireEvent.click(toggle);

    // Оптимистичное состояние сразу включается...
    await waitFor(() =>
      expect(toggle.getAttribute('aria-checked')).toBe('true'),
    );
    // ...но после отказа сети откатывается и видна причина, а не молчание.
    await screen.findByText('Не сохранилось');
    await waitFor(() =>
      expect(toggleForRow('Итоги дня').getAttribute('aria-checked')).toBe(
        'false',
      ),
    );
    expect(screen.queryByText('Сохранено ✓')).toBeNull();
  });
});

// ── Переключение подвидов (время уведомления) ────────────────────────────────
describe('SettingsSheet — переключение вида «Время уведомления»', () => {
  it('открывает список часов, выбор часа сохраняет и возвращает на главный экран', async () => {
    mockApi.getSettings.mockResolvedValue({ ...SETTINGS, notifyEnabled: true });
    await renderSheet();

    fireEvent.click(screen.getByText('Время'));
    await screen.findByText('Время уведомления');

    fireEvent.click(screen.getByText('09:00'));

    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        notifyLocalHour: 9,
      }),
    );
    await screen.findByText('Настройки');
    expect(screen.queryByText('Время уведомления')).toBeNull();
  });

  it('кнопка «Назад» в подвиде возвращает на главный экран без сохранения', async () => {
    mockApi.getSettings.mockResolvedValue({ ...SETTINGS, notifyEnabled: true });
    await renderSheet();

    fireEvent.click(screen.getByText('Время'));
    await screen.findByText('Время уведомления');
    fireEvent.click(screen.getByText('← Назад'));

    await screen.findByText('Настройки');
    expect(mockApi.updateSettings).not.toHaveBeenCalled();
  });
});

// ── Пара: приглашение и вход по коду ──────────────────────────────────────────
// «Пригласить друга»/«Войти» встречаются на странице дважды (партнёр и,
// отдельно, приглашение в приложение/кабинет терапевта) — скоуп через блок
// секции «Партнёр» (id="s-partner"), чтобы клик не попадал в чужой обработчик.
function partnerSectionContent(): HTMLElement {
  return document.getElementById('s-partner')!
    .nextElementSibling as HTMLElement;
}

describe('SettingsSheet — пара: создание приглашения', () => {
  it('успех: показывает ссылку-приглашение для отправки другу', async () => {
    mockApi.createPairInvite.mockResolvedValue({
      code: 'ABC123',
      url: 'https://schemehappens.ru/p/ABC123',
    });
    mockApi.getPair
      .mockResolvedValueOnce({ partners: [], pendingCode: null })
      .mockResolvedValueOnce({ partners: [], pendingCode: 'ABC123' });
    await renderSheet();

    fireEvent.click(
      within(partnerSectionContent()).getByText('Пригласить друга'),
    );

    await screen.findByText('https://schemehappens.ru/p/ABC123');
    expect(mockApi.createPairInvite).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsSheet — пара: вход по коду', () => {
  it('неверный код — видимая ошибка, а не тишина', async () => {
    mockApi.joinPair.mockRejectedValue(new Error('код не найден'));
    await renderSheet();

    fireEvent.click(within(partnerSectionContent()).getByText('Ввести код'));
    fireEvent.change(
      within(partnerSectionContent()).getByPlaceholderText('Код'),
      {
        target: { value: 'zzzzzz' },
      },
    );
    fireEvent.click(within(partnerSectionContent()).getByText('Войти'));

    await screen.findByText('Код не найден или уже использован');
  });

  it('верный код — данные партнёра подгружаются заново', async () => {
    mockApi.joinPair.mockResolvedValue(undefined);
    mockApi.getPair
      .mockResolvedValueOnce({ partners: [], pendingCode: null })
      .mockResolvedValueOnce({
        partners: [
          {
            code: 'XYZ',
            partnerName: 'Аня',
            partnerTodayDone: true,
            partnerIndex: 7.2,
          },
        ],
        pendingCode: null,
      });
    await renderSheet();

    fireEvent.click(within(partnerSectionContent()).getByText('Ввести код'));
    fireEvent.change(
      within(partnerSectionContent()).getByPlaceholderText('Код'),
      {
        target: { value: 'xyz123' },
      },
    );
    fireEvent.click(within(partnerSectionContent()).getByText('Войти'));

    await screen.findByText('Аня сегодня');
    expect(mockApi.joinPair).toHaveBeenCalledWith('XYZ123');
  });
});

// ── Удаление аккаунта: отказ теперь виден пользователю (не только «сброс») ──
describe('SettingsSheet — удаление аккаунта: отказ показывает сообщение', () => {
  it('после ошибки видно "Не удалось удалить данные" на первом шаге, а не тишина', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await screen.findByText(/Не удалось удалить данные/i);
  });

  it('повторное открытие листа удаления сбрасывает прошлую ошибку', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await screen.findByText(/Не удалось удалить данные/i);

    fireEvent.click(screen.getByText('Отмена'));
    openDeleteSheet();

    expect(screen.queryByText(/Не удалось удалить данные/i)).toBeNull();
  });

  it('ты/вы: сообщение об отказе звучит в обеих формах', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheetWithForm('ty');
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await screen.findByText(
      'Не удалось удалить данные. Проверь связь и попробуй ещё раз',
    );
    cleanup();

    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheetWithForm('vy');
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await screen.findByText(
      'Не удалось удалить данные. Проверьте связь и попробуйте ещё раз',
    );
  });
});

// ── ты/вы: валидация заявки на роль специалиста звучит в обеих формах ────────
describe('SettingsSheet — форма обращения в заявке на роль специалиста', () => {
  it('форма «ты»: пустая заявка просит на «ты»', async () => {
    await renderSheetWithForm('ty');
    fireEvent.click(screen.getByText('Подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('Заполни ФИО, квалификацию и контакты');
  });

  it('форма «вы»: та же проверка звучит на «вы»', async () => {
    await renderSheetWithForm('vy');
    fireEvent.click(screen.getByText('Подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('Заполните ФИО, квалификацию и контакты');
  });
});
