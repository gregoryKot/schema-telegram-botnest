// @vitest-environment jsdom
// DataSection (webapp) — конфиденциальность (удаление результатов YSQ) и
// полное удаление аккаунта. Вынесено из SettingsSheet.test.tsx вместе с
// компонентом (правило №10) — сценарии те же: двойное подтверждение,
// отказ сервера не должен выглядеть как успех, YSQ-приватность.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { DataSection } from './DataSection';
import { AddressFormContext } from '../../utils/addressForm';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../../utils/storageKeys';

vi.mock('../../api', () => ({
  api: {
    deleteYsqResult: vi.fn(),
    deleteAllUserData: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const originalLocation = window.location;
let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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

function renderWithForm(form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <DataSection />
    </AddressFormContext.Provider>,
  );
}

describe('DataSection — конфиденциальность: модалка', () => {
  it('открывается по клику, закрывается кликом по фону', async () => {
    renderWithForm();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Данные и конфиденциальность');

    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('Данные и конфиденциальность')).toBeNull());
  });

  it('нет сохранённого теста — кнопка удаления результатов не показана', () => {
    renderWithForm();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    expect(screen.queryByText('Удалить результаты теста')).toBeNull();
  });
});

describe('DataSection — удаление результатов YSQ', () => {
  beforeEach(() => {
    localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ answers: [1] }));
  });

  it('успех: localStorage очищается только после подтверждённого удаления', async () => {
    mockApi.deleteYsqResult.mockResolvedValue(undefined);
    renderWithForm();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Удалить результаты теста');

    fireEvent.click(screen.getByText('Удалить результаты теста'));
    await waitFor(() => expect(mockApi.deleteYsqResult).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull());
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
  });

  it('ошибка API: localStorage НЕ очищается, видна ошибка, модалка не закрывается', async () => {
    mockApi.deleteYsqResult.mockRejectedValue(new Error('network down'));
    renderWithForm();
    fireEvent.click(screen.getByText('Конфиденциальность'));
    await screen.findByText('Удалить результаты теста');

    fireEvent.click(screen.getByText('Удалить результаты теста'));
    await screen.findByText(/Не удалось удалить/);
    expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
    expect(screen.getByText(/Удалить результаты теста|Удаляю/)).toBeTruthy();
  });
});

describe('DataSection — удаление аккаунта: подтверждение обязательно', () => {
  it('первый клик открывает предупреждение, api ещё не вызван', () => {
    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));

    expect(screen.getByText('Необратимо.', { exact: false })).toBeTruthy();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('«Отмена» закрывает предупреждение, ничего не удаляя', () => {
    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.queryByText('Отмена')).toBeNull();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('первый «Удалить» только переводит во второй шаг — api ещё не вызван', () => {
    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(screen.getByText('Точно? Восстановить невозможно.')).toBeTruthy();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });
});

describe('DataSection — удаление аккаунта: успех', () => {
  it('чистит localStorage/sessionStorage (кроме темы/cookie-согласия) и перезагружает страницу', async () => {
    mockApi.deleteAllUserData.mockResolvedValue(undefined);
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('some_other_key', 'should-be-wiped');

    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(localStorage.getItem('some_other_key')).toBeNull();
  });
});

describe('DataSection — удаление аккаунта: отказ сервера', () => {
  it('НЕ перезагружает страницу и НЕ чистит хранилище, отказ виден пользователю', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    localStorage.setItem('some_other_key', 'still-here');

    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await screen.findByText(/Не удалось удалить данные/i);
    await act(async () => {});

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('some_other_key')).toBe('still-here');
    // Откатилось к первому шагу — кнопка «Удалить» снова доступна.
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy();
  });

  it('ты/вы: сообщение об отказе звучит в обеих формах', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    renderWithForm('ty');
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await screen.findByText('Не удалось удалить данные. Проверь связь и попробуй ещё раз');
    cleanup();

    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    renderWithForm('vy');
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await screen.findByText('Не удалось удалить данные. Проверьте связь и попробуйте ещё раз');
  });

  it('повторное открытие листа удаления сбрасывает прошлую ошибку', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
    await screen.findByText(/Не удалось удалить данные/i);

    fireEvent.click(screen.getByText('Отмена'));
    fireEvent.click(screen.getByText('Удалить все данные'));

    expect(screen.queryByText(/Не удалось удалить данные/i)).toBeNull();
  });
});

describe('DataSection — закрытие модалки фоном сбрасывает подтверждение', () => {
  it('клик по фону во время второго шага закрывает модалку целиком', async () => {
    renderWithForm();
    fireEvent.click(screen.getByText('Удалить все данные'));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await screen.findByText('Точно? Восстановить невозможно.');

    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull());
    expect(screen.queryByText('Необратимо.', { exact: false })).toBeNull();
  });
});
