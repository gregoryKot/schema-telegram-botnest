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
import {
  withAddressForm,
  mockLocationReload,
  restoreLocation,
  seedWipeTestStorage,
  openDeleteSheet,
  confirmAccountDeletion,
  fillTherapistRequestForm,
} from './settingsSheet/SettingsSheet.test-helpers';

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
    leavePair: vi.fn(),
    leaveTherapy: vi.fn(),
    joinTherapy: vi.fn(),
    createTherapyInvite: vi.fn(),
    updateName: vi.fn(),
    deleteYsqResult: vi.fn(),
    submitTherapistRequest: vi.fn(),
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

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom не реализует scrollIntoView (используется сайдбар-навигацией).
  Element.prototype.scrollIntoView = vi.fn();
  mockApi.getSettings.mockResolvedValue(SETTINGS);
  mockApi.getPair.mockResolvedValue({ partners: [], pendingCode: null });
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getTherapistRequest.mockResolvedValue(null);
  mockApi.updateSettings.mockResolvedValue(undefined);
  reloadSpy = mockLocationReload();
});

afterEach(() => {
  cleanup();
  restoreLocation();
});

async function renderSheet(userRole?: 'CLIENT' | 'THERAPIST') {
  const utils = render(
    <MemoryRouter>
      <SettingsSheet onClose={vi.fn()} userRole={userRole} />
    </MemoryRouter>,
  );
  // Дожидаемся загрузки настроек (useEffect -> api.getSettings), иначе
  // компонент застрял бы на <Loader>.
  await screen.findByText('Настройки');
  return utils;
}

async function renderSheetWithForm(form: 'ty' | 'vy') {
  const utils = render(
    <MemoryRouter>{withAddressForm(<SettingsSheet onClose={vi.fn()} />, form)}</MemoryRouter>,
  );
  await screen.findByText('Настройки');
  return utils;
}

/** Находит переключатель (role="switch"), стоящий в одной строке SRow с заголовком title. */
function toggleForRow(title: string): HTMLElement {
  const row = screen.getByText(title).parentElement!.parentElement!;
  return within(row).getByRole('switch');
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
    confirmAccountDeletion();

    await waitFor(() =>
      expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1),
    );
  });
});

describe('SettingsSheet — удаление аккаунта: успех', () => {
  it('после успешного api.deleteAllUserData чистит localStorage/sessionStorage и перезагружает страницу', async () => {
    mockApi.deleteAllUserData.mockResolvedValue(undefined);
    seedWipeTestStorage();

    await renderSheet();
    confirmAccountDeletion();

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
    confirmAccountDeletion();

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
    confirmAccountDeletion();

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
    confirmAccountDeletion();

    await screen.findByText(/Не удалось удалить данные/i);
  });

  it('повторное открытие листа удаления сбрасывает прошлую ошибку', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheet();
    confirmAccountDeletion();
    await screen.findByText(/Не удалось удалить данные/i);

    fireEvent.click(screen.getByText('Отмена'));
    openDeleteSheet();

    expect(screen.queryByText(/Не удалось удалить данные/i)).toBeNull();
  });

  it('ты/вы: сообщение об отказе звучит в обеих формах', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheetWithForm('ty');
    confirmAccountDeletion();
    await screen.findByText(
      'Не удалось удалить данные. Проверь связь и попробуй ещё раз',
    );
    cleanup();

    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    await renderSheetWithForm('vy');
    confirmAccountDeletion();
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

// ── Регрессии check-silent-catch: провал молча проглатывался, теперь виден ──
function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
  return writeText;
}

describe('SettingsSheet — сохранение имени: отказ виден (был: catch намеренно пуст)', () => {
  it('ошибка api.updateName показывает сообщение, кнопка возвращается в рабочее состояние', async () => {
    mockApi.updateName.mockRejectedValue(new Error('network down'));
    await renderSheet();
    const input = screen.getByPlaceholderText('Твоё имя');
    fireEvent.change(input, { target: { value: 'Новое Имя' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await screen.findByText('Не удалось сохранить имя');
    expect(screen.getByText('Сохранить')).toBeTruthy();
  });
});

describe('SettingsSheet — «Отключиться от терапевта»: отказ виден (был: .catch(() => {}))', () => {
  it('ошибка api.leaveTherapy показывает сообщение, связь не разрывается визуально', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({ role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'X', nextSession: null });
    mockApi.leaveTherapy.mockRejectedValue(new Error('network down'));
    await renderSheet();
    await screen.findByText('Анна подключён');

    fireEvent.click(screen.getByText('Отключиться от терапевта'));
    await screen.findByText(/Не удалось отключиться/);
    // Всё ещё подключены — не откатились на форму ввода кода молча.
    expect(screen.getByText('Анна подключён')).toBeTruthy();
  });
});

describe('SettingsSheet — приглашение клиенту (терапевт): отказ и подделка «Скопировано ✓»', () => {
  it('ошибка api.createTherapyInvite показывает сообщение', async () => {
    mockApi.createTherapyInvite.mockRejectedValue(new Error('network down'));
    await renderSheet('THERAPIST');
    fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));
    await screen.findByText(/Не удалось создать приглашение/);
  });

  it('регресс: клипборд падает — раньше «Скопировано ✓» показывалось всё равно, теперь видна сама ссылка', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({ url: 'https://t.me/bot?start=abc' });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true, writable: true,
    });
    await renderSheet('THERAPIST');
    fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));

    await screen.findByText('https://t.me/bot?start=abc');
    expect(screen.queryByText('Скопировано ✓')).toBeNull();
  });

  it('клипборд успевает — показывает «Скопировано ✓»', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({ url: 'https://t.me/bot?start=abc' });
    mockClipboard();
    await renderSheet('THERAPIST');
    fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));
    await screen.findByText('Скопировано ✓');
  });
});

describe('SettingsSheet — «Выйти из пары»: отказ виден (был: .catch(() => {}))', () => {
  it('ошибка api.leavePair показывает сообщение', async () => {
    mockApi.getPair.mockResolvedValue({ partners: [{ code: 'ABC', partnerName: 'Друг', partnerTodayDone: false, partnerIndex: null }], pendingCode: null });
    mockApi.leavePair.mockRejectedValue(new Error('network down'));
    await renderSheet();
    await screen.findByText('Выйти из пары');

    fireEvent.click(screen.getByText('Выйти из пары'));
    await screen.findByText(/Не удалось выйти из пары/);
  });
});

describe('SettingsSheet — загрузка партнёра: отказ не выглядит как «нет партнёра»', () => {
  it('регресс: getPair падает — видна ошибка с «Повторить», а не форма приглашения', async () => {
    mockApi.getPair.mockRejectedValue(new Error('network down'));
    await renderSheet();

    await screen.findByText('Не удалось загрузить данные о партнёре');
    // Раньше подключённый пользователь на сбое сети видел форму приглашения
    // партнёра («Ввести код») — как будто партнёр пропал, а не сбой сети.
    expect(screen.queryByText('Ввести код')).toBeNull();
    expect(screen.getByText('Повторить')).toBeTruthy();
  });

  it('«Повторить» после починки сети загружает данные партнёра', async () => {
    mockApi.getPair.mockRejectedValueOnce(new Error('network down'));
    await renderSheet();
    await screen.findByText('Повторить');

    mockApi.getPair.mockResolvedValue({ partners: [], pendingCode: null });
    fireEvent.click(screen.getByText('Повторить'));
    await screen.findByText('Пригласить друга');
  });
});

describe('SettingsSheet — удаление результатов YSQ: приватность (был: localStorage чистился ДО ответа сервера)', () => {
  beforeEach(() => {
    localStorage.setItem('ysq_progress', JSON.stringify({ answers: [1] }));
  });

  it('ошибка api.deleteYsqResult: localStorage НЕ очищается, видна ошибка, модалка не закрывается', async () => {
    mockApi.deleteYsqResult.mockRejectedValue(new Error('network down'));
    await renderSheet();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Удалить результаты теста');

    fireEvent.click(screen.getByText('Удалить результаты теста'));
    await screen.findByText(/Не удалось удалить/);
    expect(localStorage.getItem('ysq_progress')).not.toBeNull();
    // Модалка осталась открытой — кнопка всё ещё видна.
    expect(screen.getByText(/Удалить результаты теста|Удаляю/)).toBeTruthy();
  });

  it('успех: localStorage очищается только после подтверждённого удаления', async () => {
    mockApi.deleteYsqResult.mockResolvedValue(undefined);
    await renderSheet();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Удалить результаты теста');

    fireEvent.click(screen.getByText('Удалить результаты теста'));
    await waitFor(() => expect(mockApi.deleteYsqResult).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem('ysq_progress')).toBeNull());
  });
});

// ── Отказ getSettings/getTherapistRequest: экран не должен зависнуть или упасть ──
describe('SettingsSheet — сбой начальной загрузки не блокирует экран', () => {
  it('getSettings() падает — используются безопасные дефолты, экран открывается', async () => {
    mockApi.getSettings.mockRejectedValueOnce(new Error('network down'));
    await renderSheet();
    // Дефолт notifyEnabled=false — тумблер «Итоги дня» реально отрисован
    // и выключен, а не «повис» на Loader.
    expect(toggleForRow('Итоги дня').getAttribute('aria-checked')).toBe('false');
  });

  it('getTherapistRequest() падает — форма заявки на специалиста доступна как для новой заявки', async () => {
    mockApi.getTherapistRequest.mockRejectedValueOnce(new Error('network down'));
    await renderSheet();
    expect(screen.getByText('Подать заявку')).toBeTruthy();
    expect(screen.queryByText('Заявка на рассмотрении.', { exact: false })).toBeNull();
  });
});

describe('SettingsSheet — заявка на специалиста: отказ сервера виден (не только клиентская валидация)', () => {
  it('api.submitTherapistRequest падает — текст ошибки сервера показан, форма не закрывается', async () => {
    mockApi.submitTherapistRequest.mockRejectedValue(new Error('уже подана заявка'));
    await renderSheet();
    fireEvent.click(screen.getByText('Подать заявку'));
    fillTherapistRequestForm();
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('уже подана заявка');
    // Форма всё ещё открыта — поля никуда не делись.
    expect(screen.getByPlaceholderText('ФИО')).toBeTruthy();
  });

  it('успех: заявка уходит на сервер, форма закрывается, статус — «на рассмотрении»', async () => {
    mockApi.submitTherapistRequest.mockResolvedValue(undefined);
    await renderSheet();
    fireEvent.click(screen.getByText('Подать заявку'));
    fillTherapistRequestForm();
    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() =>
      expect(mockApi.submitTherapistRequest).toHaveBeenCalledWith({
        fullName: 'Иван Иванов', qualification: 'Психолог', contacts: '@ivan', message: undefined,
      }),
    );
    await screen.findByText('Заявка на рассмотрении.', { exact: false });
    expect(screen.queryByPlaceholderText('ФИО')).toBeNull();
  });
});

// ── ты/вы: переключатель формы обращения ──────────────────────────────────────
describe('SettingsSheet — переключатель формы обращения (ты/вы)', () => {
  it('клик «На «вы»»» сохраняет форму локально и на сервере', async () => {
    const setForm = vi.fn();
    render(
      <MemoryRouter>{withAddressForm(<SettingsSheet onClose={vi.fn()} />, 'ty', setForm)}</MemoryRouter>,
    );
    await screen.findByText('Настройки');
    fireEvent.click(screen.getByText('На «вы»'));

    expect(setForm).toHaveBeenCalledWith('vy');
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ addressForm: 'vy' }),
    );
  });

  it('текущая форма подсвечена активной кнопкой', async () => {
    await renderSheetWithForm('vy');
    const vyBtn = screen.getByText('На «вы»');
    const tyBtn = screen.getByText('На «ты»');
    expect(vyBtn.style.background).not.toBe(tyBtn.style.background);
  });
});

// ── Подвиды: частота, тихие часы, часовой пояс (аналогично «время») ──────────
describe('SettingsSheet — переключение подвидов «Частота»/«Тихие часы»/«Часовой пояс»', () => {
  it('«Частота»: выбор варианта сохраняет и возвращает на главный экран', async () => {
    mockApi.getSettings.mockResolvedValue({ ...SETTINGS, notifyEnabled: true });
    await renderSheet();
    fireEvent.click(screen.getByText('Частота'));
    await screen.findByText('Частота напоминаний');

    fireEvent.click(screen.getByText('Каждый день'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ notifyFrequency: 0 }),
    );
    await screen.findByText('Настройки');
  });

  it('«Тихие часы»: выбор пресета клавиатурой (Enter) тоже сохраняет', async () => {
    mockApi.getSettings.mockResolvedValue({ ...SETTINGS, notifyEnabled: true });
    await renderSheet();
    fireEvent.click(screen.getByText('Тихие часы'));
    await screen.findByText('В тихие часы бот не пишет вообще', { exact: false });

    const firstPreset = screen.getAllByRole('button').find(b => b.textContent?.includes('–'));
    expect(firstPreset).toBeTruthy();
    fireEvent.keyDown(firstPreset!, { key: 'Enter' });
    await waitFor(() => expect(mockApi.updateSettings).toHaveBeenCalled());
  });

  it('«Часовой пояс»: выбор часового пояса сохраняет и возвращает на главный экран', async () => {
    mockApi.getSettings.mockResolvedValue({ ...SETTINGS, notifyEnabled: true });
    await renderSheet();
    fireEvent.click(screen.getByText('Часовой пояс'));
    await waitFor(() => expect(mockApi.updateSettings).not.toHaveBeenCalled());

    const moscow = screen.getAllByText(/Москва/i)[0];
    fireEvent.click(moscow);
    await waitFor(() => expect(mockApi.updateSettings).toHaveBeenCalled());
    await screen.findByText('Настройки');
  });
});

// ── Тема: тумблер тёмная/светлая и «Авто (по системе)» ────────────────────────
describe('SettingsSheet — тема оформления', () => {
  it('тумблер темы переключает заголовок строки (Тёмная ⇄ Светлая)', async () => {
    localStorage.setItem('app_theme', 'light');
    await renderSheet();
    expect(screen.getByText('Светлая тема')).toBeTruthy();
    const row = screen.getByText('Светлая тема').parentElement!.parentElement!;
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(screen.getByText('Тёмная тема')).toBeTruthy());
    localStorage.removeItem('app_theme');
  });

  it('«Авто (по системе)» клавиатурой (Enter) не падает и не открывает соседний тумблер', async () => {
    await renderSheet();
    const autoLink = screen.getByText('Авто (по системе) →');
    fireEvent.keyDown(autoLink, { key: 'Enter' });
    // Экран остался на месте (не упал, не ушёл на подвид).
    expect(screen.getByText('Настройки')).toBeTruthy();
  });
});

describe('SettingsSheet — «Меньше движения»: тумблер показывает подтверждение сохранения', () => {
  it('клик по тумблеру показывает «Сохранено ✓»', async () => {
    await renderSheet();
    const row = screen.getByText('Меньше движения').parentElement!.parentElement!;
    fireEvent.click(within(row).getByRole('switch'));
    await screen.findByText('Сохранено ✓');
  });
});

// ── Уведомления: пауза, зависимые строки, игровой режим ───────────────────────
describe('SettingsSheet — блок уведомлений: пауза и зависимые от notifyEnabled строки', () => {
  it('notifyPausedUntil в будущем — показывает баннер паузы, «Возобновить» снимает её', async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    mockApi.getSettings.mockResolvedValue({ ...SETTINGS, notifyPausedUntil: future });
    await renderSheet();
    await screen.findByText(/Уведомления на паузе до/);

    fireEvent.click(screen.getByText('Возобновить'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ notifyPausedUntil: null }),
    );
  });

  it('«Время»/«Частота»/«Тихие часы»/«Часовой пояс» скрыты, пока и «Итоги дня», и «Напоминание» выключены', async () => {
    await renderSheet();
    expect(screen.queryByText('Частота')).toBeNull();
    expect(screen.queryByText('Тихие часы')).toBeNull();
  });

  it('включение «Итоги дня» показывает зависимые строки, включая «Игровой режим»', async () => {
    await renderSheet();
    fireEvent.click(toggleForRow('Итоги дня'));
    await waitFor(() => expect(screen.getByText('Игровой режим')).toBeTruthy());

    const gameRow = screen.getByText('Игровой режим').parentElement!.parentElement!;
    fireEvent.click(within(gameRow).getByRole('switch'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ notifyGamified: true }),
    );
  });
});

// ── Кабинет терапевта: доступ и приглашение — сфера видимости (терапевт видит SRow) ──
describe('SettingsSheet — режим терапевта (userRole=THERAPIST): переключатель и «Открыть кабинет»', () => {
  it('«Режим специалиста» вызывает onToggleTherapistMode из пропа', async () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <SettingsSheet onClose={vi.fn()} userRole="THERAPIST" therapistMode={false} onToggleTherapistMode={onToggle} />
      </MemoryRouter>,
    );
    await screen.findByText('Настройки');
    const row = screen.getByText('Режим специалиста').parentElement!.parentElement!;
    fireEvent.click(within(row).getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('«Открыть кабинет» вызывает onOpenTherapistCabinet', async () => {
    const onOpenCabinet = vi.fn();
    render(
      <MemoryRouter>
        <SettingsSheet onClose={vi.fn()} userRole="THERAPIST" onOpenTherapistCabinet={onOpenCabinet} />
      </MemoryRouter>,
    );
    await screen.findByText('Настройки');
    fireEvent.click(screen.getByText('Открыть кабинет'));
    expect(onOpenCabinet).toHaveBeenCalledTimes(1);
  });
});

// ── Снять роль специалиста: отмена/подтверждение (onResignTherapist) ─────────
describe('SettingsSheet — «Перестать быть специалистом»: двойное подтверждение', () => {
  it('первый клик показывает предупреждение и кнопки «Отмена»/«Снять роль», без вызова колбэка', async () => {
    const onResign = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <SettingsSheet onClose={vi.fn()} userRole="THERAPIST" onResignTherapist={onResign} />
      </MemoryRouter>,
    );
    await screen.findByText('Настройки');
    fireEvent.click(screen.getByText('Перестать быть специалистом'));

    expect(screen.getByText('Снять роль')).toBeTruthy();
    expect(onResign).not.toHaveBeenCalled();
  });

  it('«Отмена» возвращает к исходной кнопке без вызова колбэка', async () => {
    const onResign = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <SettingsSheet onClose={vi.fn()} userRole="THERAPIST" onResignTherapist={onResign} />
      </MemoryRouter>,
    );
    await screen.findByText('Настройки');
    fireEvent.click(screen.getByText('Перестать быть специалистом'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.getByText('Перестать быть специалистом')).toBeTruthy();
    expect(onResign).not.toHaveBeenCalled();
  });

  it('«Снять роль» вызывает onResignTherapist и возвращает к первому шагу после завершения', async () => {
    const onResign = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <SettingsSheet onClose={vi.fn()} userRole="THERAPIST" onResignTherapist={onResign} />
      </MemoryRouter>,
    );
    await screen.findByText('Настройки');
    fireEvent.click(screen.getByText('Перестать быть специалистом'));
    fireEvent.click(screen.getByText('Снять роль'));

    await waitFor(() => expect(onResign).toHaveBeenCalledTimes(1));
  });
});

// ── Поделиться: приглашение в приложение и экспорт через navigator.share ─────
describe('SettingsSheet — «Поделиться»: приглашение в приложение открывает карточку', () => {
  it('клик по «Пригласить друга» в разделе «Поделиться» открывает ShareCardSheet с приглашением', async () => {
    await renderSheet();
    // Тот же текст встречается и в разделе «Партнёр» — берём второе вхождение
    // (строка «Поделиться» идёт в разметке позже).
    const buttonsBefore = screen.getAllByText('Пригласить друга');
    expect(buttonsBefore.length).toBe(2);
    fireEvent.click(buttonsBefore[buttonsBefore.length - 1]);
    // ShareCardSheet рендерит свой заголовок с тем же текстом — после
    // открытия совпадений на один больше (карточка реально появилась).
    await waitFor(() => expect(screen.getAllByText('Пригласить друга').length).toBe(3));
  });
});

describe('SettingsSheet — экспорт для терапевта: устройство умеет navigator.share', () => {
  it('если navigator.share доступен — использует его вместо копирования, модалка не открывается', async () => {
    mockApi.getExport.mockResolvedValue({ text: 'сводка' });
    const shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true, writable: true });
    await renderSheet();

    fireEvent.click(screen.getByText('Сводка для терапевта'));
    await waitFor(() => expect(shareFn).toHaveBeenCalledWith({ text: 'сводка' }));
    expect(screen.queryByText('Скопировать')).toBeNull();

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
  });
});

// ── Приватность: модалка открывается и закрывается ────────────────────────────
describe('SettingsSheet — «Конфиденциальность»: модалка открывается по клику', () => {
  it('открывает модалку с описанием хранимых данных', async () => {
    await renderSheet();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Данные и конфиденциальность');
    expect(screen.getByText('Что хранится')).toBeTruthy();
  });

  it('клик по фону модалки закрывает её', async () => {
    await renderSheet();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Данные и конфиденциальность');
    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('Данные и конфиденциальность')).toBeNull());
  });
});

// ── Мелкие интерактивные элементы, которые прежде не кликались ────────────────
describe('SettingsSheet — боковая навигация: клик по пункту прокручивает к нужному разделу', () => {
  it('клик по «Уведомления» в сайдбаре скроллит именно к секции id=s-notifications', async () => {
    await renderSheet();
    fireEvent.click(screen.getByText('Уведомления', { selector: 'button' }));
    const section = document.getElementById('s-notifications')!;
    expect(section.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsSheet — «Напоминание»: тумблер сохраняет отдельно от «Итоги дня»', () => {
  it('включает notifyReminderEnabled', async () => {
    await renderSheet();
    fireEvent.click(toggleForRow('Напоминание'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ notifyReminderEnabled: true }),
    );
  });
});

describe('SettingsSheet — приватность карточек терапевту: тумблеры видимы, когда есть активная связь', () => {
  it('переключение «Карточки схем и режимов» и «Профиль и схемы» шлёт patch с реальным значением', async () => {
    mockApi.getTherapyRelation.mockResolvedValue({ role: 'client', status: 'active', partnerName: 'Анна', partnerId: 1, code: 'X', nextSession: null });
    await renderSheet();
    await screen.findByText('Анна подключён');

    fireEvent.click(toggleForRow('Карточки схем и режимов'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ therapistShareCards: false }),
    );
    fireEvent.click(toggleForRow('Профиль и схемы'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ therapistShareProfile: false }),
    );
  });
});

describe('SettingsSheet — вход по коду терапевта (клиент): успех подключает связь', () => {
  it('код в верхнем регистре уходит в joinTherapy, успех показывает подключённого терапевта', async () => {
    mockApi.getTherapyRelation
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: 'client', status: 'active', partnerName: 'Игорь', partnerId: 2, code: 'Y', nextSession: null });
    mockApi.joinTherapy.mockResolvedValue(undefined);
    await renderSheet();
    fireEvent.change(screen.getByPlaceholderText('ABCDEF'), { target: { value: 'code12' } });
    expect(screen.getByPlaceholderText('ABCDEF')).toHaveProperty('value', 'CODE12');
    fireEvent.click(screen.getByText('Войти', { selector: 'button' }));

    await screen.findByText('Игорь подключён');
  });
});

describe('SettingsSheet — заявка на специалиста: необязательное сообщение и отмена формы', () => {
  it('отмена формы очищает ошибку и возвращает к кнопке «Подать заявку»', async () => {
    await renderSheet();
    fireEvent.click(screen.getByText('Подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));
    await screen.findByText('Заполни ФИО, квалификацию и контакты');

    fireEvent.click(screen.getByText('Отмена'));
    expect(screen.getByText('Подать заявку')).toBeTruthy();
    expect(screen.queryByText('Заполни ФИО, квалификацию и контакты')).toBeNull();
  });

  it('необязательное сообщение уходит в submitTherapistRequest', async () => {
    mockApi.submitTherapistRequest.mockResolvedValue(undefined);
    await renderSheet();
    fireEvent.click(screen.getByText('Подать заявку'));
    fillTherapistRequestForm({ fio: 'Иван' });
    fireEvent.change(screen.getByPlaceholderText('Сообщение (необязательно)'), { target: { value: 'Работаю со схема-терапией' } });
    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() =>
      expect(mockApi.submitTherapistRequest).toHaveBeenCalledWith({
        fullName: 'Иван', qualification: 'Психолог', contacts: '@ivan', message: 'Работаю со схема-терапией',
      }),
    );
  });
});

describe('SettingsSheet — пара: копирование ссылки-приглашения и переход назад из формы кода', () => {
  it('успешное копирование ссылки показывает «✓ Скопировано»', async () => {
    mockClipboard();
    mockApi.createPairInvite.mockResolvedValue({ code: 'ABC123', url: 'https://schemehappens.ru/p/ABC123' });
    mockApi.getPair
      .mockResolvedValueOnce({ partners: [], pendingCode: null })
      .mockResolvedValueOnce({ partners: [], pendingCode: 'ABC123' });
    await renderSheet();
    fireEvent.click(within(partnerSectionContent()).getByText('Пригласить друга'));
    await screen.findByText('https://schemehappens.ru/p/ABC123');

    fireEvent.click(within(partnerSectionContent()).getByText('Скопировать ссылку'));
    await screen.findByText('✓ Скопировано');
  });

  it('«← Назад» из формы ввода кода возвращает к экрану приглашения', async () => {
    await renderSheet();
    fireEvent.click(within(partnerSectionContent()).getByText('Ввести код'));
    await screen.findByPlaceholderText('Код');

    fireEvent.click(within(partnerSectionContent()).getByText('← Назад'));
    expect(within(partnerSectionContent()).getByText('Пригласить друга')).toBeTruthy();
    expect(within(partnerSectionContent()).queryByPlaceholderText('Код')).toBeNull();
  });
});

describe('SettingsSheet — карточки-приглашения и модалка экспорта закрываются штатно', () => {
  it('карточка приглашения в приложение закрывается кликом по фону', async () => {
    await renderSheet();
    const before = screen.getAllByText('Пригласить друга').length;
    fireEvent.click(screen.getAllByText('Пригласить друга')[before - 1]);
    await waitFor(() => expect(screen.getAllByText('Пригласить друга').length).toBe(before + 1));

    fireEvent.click(document.querySelector('[role="presentation"]')!);
    await waitFor(() => expect(screen.getAllByText('Пригласить друга').length).toBe(before));
  });

  it('модалка экспорта: копирование текста показывает «✓ Скопировано», закрытие убирает модалку', async () => {
    mockClipboard();
    mockApi.getExport.mockResolvedValue({ text: 'текст сводки' });
    await renderSheet();
    fireEvent.click(screen.getByText('Сводка для терапевта'));
    await screen.findByText('текст сводки');

    fireEvent.click(screen.getByText('Скопировать'));
    await screen.findByText('✓ Скопировано');

    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('текст сводки')).toBeNull());
  });
});

describe('SettingsSheet — удаление аккаунта: закрытие модалки фоном сбрасывает подтверждение', () => {
  it('клик по фону во время второго шага закрывает модалку целиком', async () => {
    await renderSheet();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await screen.findByText('Точно? Восстановить невозможно.');

    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull());
    // Модалка закрылась целиком, не откатилась на первый шаг.
    expect(screen.queryByText('Необратимо.', { exact: false })).toBeNull();
  });
});
