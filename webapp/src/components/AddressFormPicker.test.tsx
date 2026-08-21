// @vitest-environment jsdom
// AddressFormPicker — выбор «ты/вы» при первом входе. Показывается только
// если settings.addressForm ещё null и ещё не спрашивали в этой сессии
// (sessionStorage) — денормализованный гейт видимости.
//
// Инцидент: провал api.updateSettings глушился (пустой catch) и диалог
// закрывался как успешный — человек видел выбранную форму применённой, а
// сервер её не узнавал; на следующей сессии addressForm снова null.
// Тесты «сохранение отказало» ниже — регрессия именно этого сценария.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormPicker } from './AddressFormPicker';
import { AddressFormContext } from '../utils/addressForm';

const getSettings = vi.fn();
const updateSettings = vi.fn();
const reportClientError = vi.fn();
vi.mock('../api', () => ({
  api: {
    getSettings: (...a: unknown[]) => getSettings(...a),
    updateSettings: (...a: unknown[]) => updateSettings(...a),
  },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
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
    <MemoryRouter initialEntries={['/today']}>
      <AddressFormContext.Provider value={{ form: 'ty', setForm }}>
        <AddressFormPicker />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

describe('AddressFormPicker — видимость', () => {
  it('addressForm уже выбран (не null) — пикер не показывается', async () => {
    getSettings.mockResolvedValue({ addressForm: 'ty' });
    renderPicker();
    await act(async () => {});
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
  });

  it('addressForm ещё null — показывает выбор', async () => {
    getSettings.mockResolvedValue({ addressForm: null });
    renderPicker();
    await act(async () => {});
    expect(screen.queryByText('Как удобнее общаться?')).toBeTruthy();
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
    await act(async () => {});
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(setForm).toHaveBeenCalledWith('ty');
    expect(updateSettings).toHaveBeenCalledWith({ addressForm: 'ty' });
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
    expect(sessionStorage.getItem('addr_form_asked')).toBe('1');
  });

  it('«На «вы»» сохраняет выбор «вы»', async () => {
    const setForm = vi.fn();
    renderPicker(setForm);
    await act(async () => {});
    fireEvent.click(screen.getByText('На «вы»'));
    await act(async () => {});
    expect(setForm).toHaveBeenCalledWith('vy');
    expect(updateSettings).toHaveBeenCalledWith({ addressForm: 'vy' });
  });

  it('успех с первого раза — диалога нет и строки ошибки не было (ложная тревога хуже молчания)', async () => {
    const setForm = vi.fn();
    renderPicker(setForm);
    await act(async () => {});
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
    expect(screen.queryByText(/Не удалось сохранить выбор/)).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('провал сохранения — диалог НЕ закрывается, видна строка ошибки, отчёт ушёл в reportClientError', async () => {
    updateSettings.mockRejectedValue(new Error('network'));
    const setForm = vi.fn();
    renderPicker(setForm);
    await act(async () => {});
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});

    expect(setForm).toHaveBeenCalledWith('ty'); // интерфейс уже переключился — это честно
    expect(screen.queryByText('Как удобнее общаться?')).toBeTruthy();
    expect(screen.getByText(/Не удалось сохранить выбор/)).toBeTruthy();
    expect(sessionStorage.getItem('addr_form_asked')).toBeNull();
    expect(reportClientError).toHaveBeenCalledWith({
      message: 'address form save failed',
      section: 'addressForm',
    });
  });

  it('повторный клик после отказа, на этот раз updateSettings успешен — диалог закрывается', async () => {
    updateSettings
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({});
    renderPicker();
    await act(async () => {});
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(screen.getByText(/Не удалось сохранить выбор/)).toBeTruthy();

    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(updateSettings).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
    expect(sessionStorage.getItem('addr_form_asked')).toBe('1');
  });

  it('«Позже» после отказа — мягкий выход всё равно закрывает пикер', async () => {
    updateSettings.mockRejectedValue(new Error('network'));
    renderPicker();
    await act(async () => {});
    fireEvent.click(screen.getByText('На «ты»'));
    await act(async () => {});
    expect(screen.getByText(/Не удалось сохранить выбор/)).toBeTruthy();

    fireEvent.click(screen.getByText('Позже'));
    await act(async () => {});
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
    expect(sessionStorage.getItem('addr_form_asked')).toBe('1');
  });

  it('«Позже» закрывает без сохранения формы и без сброса setForm', async () => {
    const setForm = vi.fn();
    renderPicker(setForm);
    await act(async () => {});
    fireEvent.click(screen.getByText('Позже'));
    await act(async () => {});
    expect(setForm).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(screen.queryByText('Как удобнее общаться?')).toBeNull();
    expect(sessionStorage.getItem('addr_form_asked')).toBe('1');
  });
});

// В6 (аудит 2026-08): position:fixed/inset:0-диалог обязан использовать
// useHistorySheet (CLAUDE.md), иначе браузерная «Назад» уводит из
// приложения вместо закрытия пикера. Оба пути закрытия («Позже» и успешный
// выбор — тесты выше) идут через один и тот же goBack = useHistorySheet(close):
// пикер требует react-router контекст (MemoryRouter в renderPicker), и без
// него useNavigate/useLocation внутри useHistorySheet бросили бы при
// монтировании — то, что все тесты выше рендерятся и закрываются, уже
// доказывает, что goBack реально вызывается, а не заглушка.
describe('AddressFormPicker — useHistorySheet (браузерная «Назад»)', () => {
  it('без Router-контекста монтирование диалога падает (регрессия на будущее: не убрать MemoryRouter)', async () => {
    getSettings.mockResolvedValue({ addressForm: null });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <AddressFormPicker />
        </AddressFormContext.Provider>,
      ),
    ).not.toThrow(); // сам компонент рендерится синхронно без Router — упадёт только внутренний AddressFormPickerModal, после resolve getSettings()
    await expect(act(async () => {})).rejects.toThrow();
    errorSpy.mockRestore();
  });
});
