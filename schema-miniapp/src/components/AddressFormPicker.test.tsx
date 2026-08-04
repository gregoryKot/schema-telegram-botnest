// @vitest-environment jsdom
// AddressFormPicker — выбор обращения при первом входе (0% покрытия).
// Проверяем: выбор «ты»/«вы» шлёт setForm + api.updateSettings + onDone(form),
// «Позже» пропускает без записи в настройки, и что сбой api.updateSettings
// НЕ блокирует вход (onDone всё равно вызывается — комментарий в коде это
// обещает явно, регрессия была бы «застрял на экране выбора при офлайне»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { AddressFormPicker } from './AddressFormPicker';
import { api } from '../api';

vi.mock('../api', () => ({ api: { updateSettings: vi.fn() } }));

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
    expect(setForm).toHaveBeenCalledWith('ty');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('ty'));
    expect(api.updateSettings).toHaveBeenCalledWith({ addressForm: 'ty' });
  });

  it("«На «вы»» — setForm('vy'), сохраняет в настройки, зовёт onDone('vy')", async () => {
    vi.mocked(api.updateSettings).mockResolvedValue(undefined);
    const setForm = vi.fn();
    const onDone = vi.fn();
    renderPicker(onDone, setForm);
    fireEvent.click(screen.getByText('На «вы»'));
    expect(setForm).toHaveBeenCalledWith('vy');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('vy'));
    expect(api.updateSettings).toHaveBeenCalledWith({ addressForm: 'vy' });
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

  it('api.updateSettings падает (офлайн) — вход всё равно не блокируется', async () => {
    vi.mocked(api.updateSettings).mockRejectedValue(new Error('network'));
    const onDone = vi.fn();
    renderPicker(onDone);
    fireEvent.click(screen.getByText('На «ты»'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('ty'));
  });
});
