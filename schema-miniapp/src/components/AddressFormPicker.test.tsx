// @vitest-environment jsdom
// AddressFormPicker — выбор обращения при первом входе.
//
// Инцидент: провал api.updateSettings уходил только в console.error, а лист
// всё равно закрывался как успешный (onDone(form)) — человек видел выбранную
// форму применённой, а сервер её не узнавал; на следующей сессии addressForm
// снова null. Тесты «сохранение отказало» ниже — регрессия именно этого
// сценария (правило CLAUDE.md «Обращение ты/вы»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  act,
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { AddressFormPicker } from './AddressFormPicker';
import { api, reportClientError } from '../api';

vi.mock('../api', () => ({
  api: { updateSettings: vi.fn() },
  reportClientError: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPicker(
  onDone: (f: 'ty' | 'vy' | null) => void,
  setForm = vi.fn(),
) {
  return render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm }}>
      <AddressFormPicker onDone={onDone} />
    </AddressFormContext.Provider>,
  );
}

describe('AddressFormPicker — выбор формы', () => {
  it("«На «ты»» — setForm('ty'), сохраняет в настройки, зовёт onDone('ty')", async () => {
    vi.mocked(api.updateSettings).mockResolvedValue(undefined);
    const setForm = vi.fn();
    const onDone = vi.fn();
    renderPicker(onDone, setForm);
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(setForm).toHaveBeenCalledWith('ty');
    expect(onDone).toHaveBeenCalledWith('ty');
    expect(api.updateSettings).toHaveBeenCalledWith({ addressForm: 'ty' });
  });

  it("«На «вы»» — setForm('vy'), сохраняет в настройки, зовёт onDone('vy')", async () => {
    vi.mocked(api.updateSettings).mockResolvedValue(undefined);
    const setForm = vi.fn();
    const onDone = vi.fn();
    renderPicker(onDone, setForm);
    fireEvent.click(screen.getByText('На «вы»'));
    await act(async () => {});
    expect(setForm).toHaveBeenCalledWith('vy');
    expect(onDone).toHaveBeenCalledWith('vy');
    expect(api.updateSettings).toHaveBeenCalledWith({ addressForm: 'vy' });
  });

  it('успех с первого раза — onDone вызван, строки ошибки не было (ложная тревога хуже молчания)', async () => {
    vi.mocked(api.updateSettings).mockResolvedValue(undefined);
    const onDone = vi.fn();
    renderPicker(onDone);
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(onDone).toHaveBeenCalledWith('ty');
    expect(screen.queryByText(/Не удалось сохранить выбор/)).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('«Позже» — не трогает setForm/api, зовёт onDone(null)', () => {
    const setForm = vi.fn();
    const onDone = vi.fn();
    renderPicker(onDone, setForm);
    fireEvent.click(screen.getByText('Позже'));
    expect(setForm).not.toHaveBeenCalled();
    expect(api.updateSettings).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(null);
  });

  it('api.updateSettings падает — лист НЕ закрывается (onDone не вызван), видна строка ошибки, отчёт ушёл в reportClientError', async () => {
    vi.mocked(api.updateSettings).mockRejectedValue(new Error('network'));
    const setForm = vi.fn();
    const onDone = vi.fn();
    renderPicker(onDone, setForm);
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});

    expect(setForm).toHaveBeenCalledWith('ty'); // интерфейс уже переключился — это честно
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText(/Не удалось сохранить выбор/)).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith({
      message: 'address form save failed',
      section: 'addressForm',
    });
  });

  it('повторный клик после отказа, updateSettings теперь успешен — onDone вызывается', async () => {
    vi.mocked(api.updateSettings)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const onDone = vi.fn();
    renderPicker(onDone);
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(screen.getByText(/Не удалось сохранить выбор/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(api.updateSettings).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith('ty');
  });

  it('«Позже» после отказа — мягкий выход всё равно зовёт onDone(null)', async () => {
    vi.mocked(api.updateSettings).mockRejectedValue(new Error('network'));
    const onDone = vi.fn();
    renderPicker(onDone);
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(screen.getByText(/Не удалось сохранить выбор/)).toBeTruthy();

    fireEvent.click(screen.getByText('Позже'));
    expect(onDone).toHaveBeenCalledWith(null);
  });
});
