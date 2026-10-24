// @vitest-environment jsdom
// Настройки: удаление данных и экспорт (CLAUDE.md — приоритет покрытия
// «настройки: удаление данных, экспорт»). Поведение, не разметка: копирование
// сводки (успех/ошибка буфера обмена), удаление результатов теста только
// когда они есть в localStorage, двухшаговое подтверждение полного удаления
// аккаунта и восстановление после ошибки API (не должно выглядеть как успех).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { ExportOverlay, PrivacyOverlay, DeleteOverlay } from './DataOverlays';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../YSQTestSheet';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';

vi.mock('../../api', () => ({
  api: {
    deleteYsqData: vi.fn(),
    deleteAllUserData: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ExportOverlay', () => {
  it('показывает текст сводки и по клику зовёт onCopy', () => {
    const onCopy = vi.fn();

    render(
      <ExportOverlay
        exportText="Сводка: оценки за неделю"
        exportCopied={false}
        exportFailed={false}
        onCopy={onCopy}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Сводка: оценки за неделю')).toBeTruthy();
    fireEvent.click(screen.getByText('Скопировать'));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('exportCopied=true — кнопка показывает подтверждение', () => {
    render(
      <ExportOverlay
        exportText="x"
        exportCopied={true}
        exportFailed={false}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('✓ Скопировано')).toBeTruthy();
  });

  it('exportFailed=true — виден отказ (был: молча проглочен)', () => {
    render(
      <ExportOverlay
        exportText="x"
        exportCopied={false}
        exportFailed={true}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Не получилось')).toBeTruthy();
  });
});

describe('PrivacyOverlay', () => {
  it('нет сохранённого теста в localStorage — кнопка удаления результатов не показана (пустое состояние)', () => {
    render(<PrivacyOverlay onClose={() => {}} onDeletedYsq={() => {}} />);
    expect(screen.queryByText('Удалить результаты теста')).toBeNull();
  });

  // Решение владельца 2026-10-22: кнопка стирает всё про тест (итог,
  // историю, прогресс — DELETE /api/ysq-data), сначала спрашивает, а
  // localStorage чистит только после ответа сервера (раньше — до запроса,
  // без ожидания ответа и без ошибки на экране).
  function openYsqConfirm(form: AddressForm = 'ty') {
    localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ x: 1 }));
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ step: 2 }));
    const onDeletedYsq = vi.fn();
    render(
      <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
        <PrivacyOverlay onClose={() => {}} onDeletedYsq={onDeletedYsq} />
      </AddressFormContext.Provider>,
    );
    fireEvent.click(screen.getByText('Удалить результаты теста'));
    return onDeletedYsq;
  }

  it('первый тап только спрашивает: видно подтверждение, запроса нет', () => {
    const onDeletedYsq = openYsqConfirm();
    expect(screen.getByText('Удалить все результаты теста?')).toBeTruthy();
    expect(
      screen.getByText(/все прошлые прохождения и незаконченные ответы/),
    ).toBeTruthy();
    expect(mockApi.deleteYsqData).not.toHaveBeenCalled();
    expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
    expect(onDeletedYsq).not.toHaveBeenCalled();
  });

  it('«Удалить всё»: DELETE /api/ysq-data, потом ключи очищены и шторка закрывается', async () => {
    mockApi.deleteYsqData.mockResolvedValue(undefined);
    const onDeletedYsq = openYsqConfirm();

    fireEvent.click(screen.getByText('Удалить всё'));

    await waitFor(() => expect(onDeletedYsq).toHaveBeenCalledTimes(1));
    expect(mockApi.deleteYsqData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull();
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
  });

  it('«Отмена»: запроса нет, ключи на месте, снова видна кнопка', () => {
    const onDeletedYsq = openYsqConfirm();

    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.queryByText('Удалить все результаты теста?')).toBeNull();
    expect(screen.getByText('Удалить результаты теста')).toBeTruthy();
    expect(mockApi.deleteYsqData).not.toHaveBeenCalled();
    expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).not.toBeNull();
    expect(onDeletedYsq).not.toHaveBeenCalled();
  });

  it.each([
    ['ty', 'Не удалось удалить. Попробуй ещё раз'],
    ['vy', 'Не удалось удалить. Попробуйте ещё раз'],
  ] as const)(
    'ошибка сервера (%s): ключи на месте, видна ошибка, шторка не закрывается',
    async (form, text) => {
      mockApi.deleteYsqData.mockRejectedValue(new Error('network down'));
      const onDeletedYsq = openYsqConfirm(form);

      fireEvent.click(screen.getByText('Удалить всё'));

      expect((await screen.findByRole('alert')).textContent).toBe(text);
      expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
      expect(localStorage.getItem(YSQ_PROGRESS_KEY)).not.toBeNull();
      expect(screen.getByText('Удалить все результаты теста?')).toBeTruthy();
      expect(onDeletedYsq).not.toHaveBeenCalled();
    },
  );

  it('есть незавершённый прогресс теста — тоже показывает кнопку удаления', () => {
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ step: 2 }));
    render(<PrivacyOverlay onClose={() => {}} onDeletedYsq={() => {}} />);
    expect(screen.getByText('Удалить результаты теста')).toBeTruthy();
  });
});

describe('DeleteOverlay', () => {
  const originalLocation = window.location;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function renderOverlay(deleteConfirm: boolean) {
    const setDeleteConfirm = vi.fn();
    const setDeleting = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeleteOverlay
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        deleting={false}
        setDeleting={setDeleting}
        onBackdropClose={() => {}}
        onCancel={onCancel}
      />,
    );
    return { setDeleteConfirm, setDeleting, onCancel };
  }

  it('первый шаг: «Удалить» переводит на подтверждение, «Отмена» вызывает onCancel', () => {
    const { setDeleteConfirm, onCancel } = renderOverlay(false);
    expect(screen.queryByText('Точно? Восстановить невозможно.')).toBeNull();

    fireEvent.click(screen.getByText('Удалить'));
    expect(setDeleteConfirm).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('Отмена'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('подтверждение: удаляет данные на сервере, чистит хранилище, сохраняет тему, перезагружает', async () => {
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('some_other_key', 'still-here');
    mockApi.deleteAllUserData.mockResolvedValue(undefined);

    renderOverlay(true);
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(mockApi.deleteAllUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('some_other_key')).toBeNull();
  });

  it('ошибка API — НЕ перезагружает и НЕ чистит хранилище (провал не должен выглядеть успехом)', async () => {
    localStorage.setItem('some_other_key', 'still-here');
    mockApi.deleteAllUserData.mockRejectedValue(new Error('network down'));

    const { setDeleting, setDeleteConfirm } = renderOverlay(true);
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() => expect(setDeleting).toHaveBeenCalledWith(false));
    expect(setDeleteConfirm).toHaveBeenCalledWith(false);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('some_other_key')).toBe('still-here');
  });

  // B-13 (аудит 2026-10): при включённом 2FA сервер отвечает 403 totp_required —
  // оверлей просит код и повторяет удаление уже с ним (парно с webapp, правило №3).
  it('2FA: 403 totp_required → поле кода, повтор с кодом, затем перезагрузка', async () => {
    const err = Object.assign(new Error('Нужен код'), {
      status: 403,
      reason: 'totp_required',
    });
    mockApi.deleteAllUserData
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(undefined);

    const { setDeleteConfirm } = renderOverlay(true);
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    const input = await screen.findByLabelText(/двухфакторная/);
    // Нужен код — не сбой: шаг подтверждения не сбрасывается.
    expect(setDeleteConfirm).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Да, удалить всё навсегда'));

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(mockApi.deleteAllUserData).toHaveBeenLastCalledWith('123456');
  });
});
