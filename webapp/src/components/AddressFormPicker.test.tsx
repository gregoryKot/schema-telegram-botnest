// @vitest-environment jsdom
// AddressFormPicker — выбор «ты/вы» при первом входе (0% покрытия).
// Показывается только если settings.addressForm ещё null и ещё не
// спрашивали в этой сессии (sessionStorage) — денормализованный гейт видимости.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AddressFormPicker } from './AddressFormPicker';
import { AddressFormContext } from '../utils/addressForm';

const getSettings = vi.fn();
const updateSettings = vi.fn();
vi.mock('../api', () => ({
  api: {
    getSettings: (...a: unknown[]) => getSettings(...a),
    updateSettings: (...a: unknown[]) => updateSettings(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  updateSettings.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function renderPicker(setForm = vi.fn()) {
  return render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm }}>
      <AddressFormPicker />
    </AddressFormContext.Provider>,
  );
}

describe('AddressFormPicker — видимость', () => {
  it('addressForm уже выбран (не null) — пикер не показывается', async () => {
    getSettings.mockResolvedValue({ addressForm: 'ty' });
    renderPicker();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
  });

  it('addressForm ещё null — показывает выбор', async () => {
    getSettings.mockResolvedValue({ addressForm: null });
    renderPicker();
    expect(await screen.findByText('Как удобнее общаться?')).toBeTruthy();
  });

  it('уже спрашивали в этой сессии — не запрашивает настройки повторно', () => {
    sessionStorage.setItem('addr_form_asked', '1');
    renderPicker();
    expect(getSettings).not.toHaveBeenCalled();
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
  });
});

describe('AddressFormPicker — выбор', () => {
  beforeEach(() => {
    getSettings.mockResolvedValue({ addressForm: null });
  });

  it('«На «ты»» сохраняет выбор, применяет его сразу и закрывает пикер', async () => {
    const setForm = vi.fn();
    renderPicker(setForm);
    fireEvent.click(await screen.findByText('На «ты»'));
    expect(setForm).toHaveBeenCalledWith('ty');
    expect(updateSettings).toHaveBeenCalledWith({ addressForm: 'ty' });
    await waitFor(() => expect(screen.queryByText('Как удобнее общаться?')).toBeNull());
    expect(sessionStorage.getItem('addr_form_asked')).toBe('1');
  });

  it('«На «вы»» сохраняет выбор «вы»', async () => {
    const setForm = vi.fn();
    renderPicker(setForm);
    fireEvent.click(await screen.findByText('На «вы»'));
    expect(setForm).toHaveBeenCalledWith('vy');
  });

  it('провал сохранения на бэкенде не блокирует закрытие пикера', async () => {
    updateSettings.mockRejectedValue(new Error('network'));
    renderPicker();
    fireEvent.click(await screen.findByText('На «ты»'));
    await waitFor(() => expect(screen.queryByText('Как удобнее общаться?')).toBeNull());
  });

  it('«Позже» закрывает без сохранения формы и без сброса setForm', async () => {
    const setForm = vi.fn();
    renderPicker(setForm);
    fireEvent.click(await screen.findByText('Позже'));
    expect(setForm).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
    expect(sessionStorage.getItem('addr_form_asked')).toBe('1');
  });
});
