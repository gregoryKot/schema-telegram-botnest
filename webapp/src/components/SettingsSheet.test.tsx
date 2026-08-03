// @vitest-environment jsdom
// Компонентные тесты SettingsSheet (webapp) — денежный/доверительный путь
// «Данные»: удаление аккаунта (обязательное двойное подтверждение, ошибка
// API не должна молча «удаться») и экспорт данных для терапевта.
// Образец сетапа: SubscribePage.test.tsx (мок '../api'), NoteSheet.test.tsx
// (MemoryRouter — useHistorySheet требует useNavigate/useLocation),
// AuthCallback.test.tsx (подмена window.location для window.location.reload).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsSheet } from './SettingsSheet';

vi.mock('../api', () => ({
  api: {
    getSettings: vi.fn(),
    getPair: vi.fn(),
    getTherapyRelation: vi.fn(),
    getTherapistRequest: vi.fn(),
    getExport: vi.fn(),
    deleteAllUserData: vi.fn(),
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
  reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: reloadSpy },
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
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

    await waitFor(() => expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull());
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
