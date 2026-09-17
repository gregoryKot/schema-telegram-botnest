// @vitest-environment jsdom
// DataSection (webapp) — конфиденциальность (удаление результатов YSQ) и
// полное удаление аккаунта. Вынесено из SettingsSheet.test.tsx вместе с
// компонентом (правило №10) — сценарии те же: двойное подтверждение,
// отказ сервера не должен выглядеть как успех, YSQ-приватность.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { DataSection } from './DataSection';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../../utils/storageKeys';
import {
  withAddressForm,
  mockLocationReload,
  restoreLocation,
  seedWipeTestStorage,
  openDeleteSheet,
  confirmAccountDeletion,
} from './SettingsSheet.test-helpers';

vi.mock('../../api', () => ({
  api: {
    deleteYsqResult: vi.fn(),
    deleteAllUserData: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../../apiClient', () => ({ authedFetch: vi.fn() }));
import { authedFetch } from '../../apiClient';
const mockAuthedFetch = authedFetch as unknown as ReturnType<typeof vi.fn>;

function exportResponse(over: Partial<Response> = {}): Response {
  return {
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.json"',
    }),
    blob: () => Promise.resolve(new Blob(['{}'])),
    ...over,
  } as Response;
}

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  reloadSpy = mockLocationReload();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  restoreLocation();
  vi.unstubAllGlobals();
});

function renderWithForm(form: 'ty' | 'vy' = 'ty') {
  return render(withAddressForm(<DataSection />, form));
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
    openDeleteSheet();

    expect(screen.getByText('Необратимо.', { exact: false })).toBeTruthy();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('«Отмена» закрывает предупреждение, ничего не удаляя', () => {
    renderWithForm();
    openDeleteSheet();
    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.queryByText('Отмена')).toBeNull();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });

  it('первый «Удалить» только переводит во второй шаг — api ещё не вызван', () => {
    renderWithForm();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(screen.getByText('Точно? Восстановить невозможно.')).toBeTruthy();
    expect(mockApi.deleteAllUserData).not.toHaveBeenCalled();
  });
});

describe('DataSection — удаление аккаунта: успех', () => {
  it('чистит localStorage/sessionStorage (кроме темы/cookie-согласия) и перезагружает страницу', async () => {
    mockApi.deleteAllUserData.mockResolvedValue(undefined);
    seedWipeTestStorage();

    renderWithForm();
    confirmAccountDeletion();

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
    confirmAccountDeletion();

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
    confirmAccountDeletion();
    await screen.findByText('Не удалось удалить данные. Проверь связь и попробуй ещё раз');
    cleanup();

    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    renderWithForm('vy');
    confirmAccountDeletion();
    await screen.findByText('Не удалось удалить данные. Проверьте связь и попробуйте ещё раз');
  });

  it('повторное открытие листа удаления сбрасывает прошлую ошибку', async () => {
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));
    renderWithForm();
    confirmAccountDeletion();
    await screen.findByText(/Не удалось удалить данные/i);

    fireEvent.click(screen.getByText('Отмена'));
    openDeleteSheet();

    expect(screen.queryByText(/Не удалось удалить данные/i)).toBeNull();
  });
});

// Право на переносимость данных (PR #480 — бэкенд; кнопка — эта задача).
// Общая логика — shared/src/account/useDataExport.ts (правило №3), здесь
// проверяется только интеграция: клик доходит до authedFetch, а каждый исход
// (успех/отказ/вебвью без download) виден пользователю в нужной форме.
describe('DataSection — скачать мои данные', () => {
  it('клик уходит в authedFetch с авторизацией, а не в обычный <a href>', async () => {
    mockAuthedFetch.mockResolvedValue(exportResponse());
    renderWithForm();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    await waitFor(() =>
      expect(mockAuthedFetch).toHaveBeenCalledWith('/api/account/export'),
    );
    await waitFor(() =>
      expect(screen.getByText('Скачать мои данные')).toBeTruthy(),
    );
  });

  it('пока файл готовится — кнопка сама меняет текст, не спиннер экрана', async () => {
    let resolve!: (r: Response) => void;
    mockAuthedFetch.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    renderWithForm();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    await screen.findByText('Собираю…');
    resolve(exportResponse());
    await waitFor(() => expect(screen.getByText('Скачать мои данные')).toBeTruthy());
  });

  it('запрос упал — видно сообщение об ошибке, не тишина', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('network down'));
    renderWithForm();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    await screen.findByText(/Не удалось скачать файл/);
  });

  it('ты/вы: сообщение об ошибке скачивания звучит в обеих формах', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('network down'));
    renderWithForm('ty');
    fireEvent.click(screen.getByText('Скачать мои данные'));
    await screen.findByText('Не удалось скачать файл. Проверь связь и попробуй ещё раз');
    cleanup();

    mockAuthedFetch.mockRejectedValue(new Error('network down'));
    renderWithForm('vy');
    fireEvent.click(screen.getByText('Скачать мои данные'));
    await screen.findByText('Не удалось скачать файл. Проверьте связь и попробуйте ещё раз');
  });

  it('после успешного скачивания видно, чего ждать, — а не молчаливый возврат кнопки', async () => {
    mockAuthedFetch.mockResolvedValue(exportResponse());
    renderWithForm();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    // Вебвью умеет проглотить скачивание без единой ошибки. Если бы кнопка
    // просто вернулась в исходный вид, человек прочитал бы это как «ничего
    // не произошло» и не узнал бы, что делать дальше (правило №14).
    await screen.findByText(/Файл ушёл в загрузки/);
  });

  it('вебвью без download у <a> — явная подсказка открыть сайт, а не молчание', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
    delete (HTMLAnchorElement.prototype as unknown as Record<string, unknown>).download;
    try {
      renderWithForm();
      fireEvent.click(screen.getByText('Скачать мои данные'));
      await screen.findByText(/Тут скачать не получится/);
      expect(mockAuthedFetch).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(HTMLAnchorElement.prototype, 'download', descriptor);
    }
  });

  it('ты/вы: подсказка про вебвью звучит в обеих формах', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
    delete (HTMLAnchorElement.prototype as unknown as Record<string, unknown>).download;
    try {
      renderWithForm('ty');
      fireEvent.click(screen.getByText('Скачать мои данные'));
      await screen.findByText('Тут скачать не получится — открой schemehappens.ru в браузере и попробуй там');
      cleanup();

      renderWithForm('vy');
      fireEvent.click(screen.getByText('Скачать мои данные'));
      await screen.findByText('Тут скачать не получится — откройте schemehappens.ru в браузере и попробуйте там');
    } finally {
      if (descriptor) Object.defineProperty(HTMLAnchorElement.prototype, 'download', descriptor);
    }
  });

  it('ты/вы: пояснение рядом с кнопкой звучит в обеих формах', () => {
    renderWithForm('ty');
    expect(screen.getByText(/Скачай, если хочешь сохранить копию себе/)).toBeTruthy();
    cleanup();

    renderWithForm('vy');
    expect(screen.getByText(/Скачайте, если хотите сохранить копию себе/)).toBeTruthy();
  });
});

describe('DataSection — закрытие модалки фоном сбрасывает подтверждение', () => {
  it('клик по фону во время второго шага закрывает модалку целиком', async () => {
    renderWithForm();
    openDeleteSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await screen.findByText('Точно? Восстановить невозможно.');

    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull());
    expect(screen.queryByText('Необратимо.', { exact: false })).toBeNull();
  });
});
