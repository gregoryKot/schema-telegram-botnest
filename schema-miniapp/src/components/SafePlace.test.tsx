// @vitest-environment jsdom
// Правило №7 CLAUDE.md: свободнотекстовое поле «Безопасное место» обязано
// проходить через кризисную детекцию. Тест проверяет только появление
// карточки, не разметку.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { SafePlace } from './SafePlace';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

vi.mock('../api', () => ({
  api: {
    getSafePlace: vi.fn(),
    saveSafePlace: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Пусто на сервере → компонент остаётся в форме редактирования (editing).
  mockApi.getSafePlace.mockResolvedValue(null);
  mockApi.saveSafePlace.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function renderSheet() {
  render(<SafePlace onClose={() => {}} />);
  await act(async () => {}); // flush getSafePlace()
  return screen.getByPlaceholderText(
    'Это небольшой уютный лес недалеко от дома. Я слышу птиц...',
  );
}

describe('SafePlace — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });

  it('карточка появляется от одного набора текста — ДО клика «Сохранить» и ДО любого сетевого запроса', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
    expect(mockApi.saveSafePlace).not.toHaveBeenCalled();
  });
});

describe('SafePlace — сохранение: read-after-write и видимая ошибка', () => {
  it('сохранённый текст переживает перезагрузку: следующий рендер подтягивает его с сервера', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, {
      target: { value: 'Тихий лес у озера, слышно птиц.' },
    });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText('Тихий лес у озера, слышно птиц.')).toBeTruthy(),
    );
    cleanup();

    // «Перезагрузка»: сервер теперь отдаёт то, что мы только что сохранили.
    mockApi.getSafePlace.mockResolvedValueOnce({
      description: 'Тихий лес у озера, слышно птиц.',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    render(<SafePlace onClose={() => {}} />);
    await act(async () => {});
    expect(screen.getByText('Тихий лес у озера, слышно птиц.')).toBeTruthy();
  });

  it('падение saveSafePlace показывает видимую ошибку и НЕ переключает на экран просмотра', async () => {
    mockApi.saveSafePlace.mockRejectedValueOnce(new Error('network down'));
    const textarea = await renderSheet();
    fireEvent.change(textarea, {
      target: { value: 'место, которое не долетит до сервера' },
    });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText(/Не удалось сохранить на сервере/)).toBeTruthy(),
    );
    // Остаёмся в форме редактирования — экран просмотра (кнопки «Изменить»/
    // «Готово») появляется только при подтверждённом успехе.
    expect(screen.queryByText('Изменить')).toBeNull();
    expect(screen.getByText('Сохранить')).toBeTruthy();
  });

  it('текст ошибки звучит в обеих формах обращения (ты/вы)', async () => {
    mockApi.saveSafePlace.mockRejectedValueOnce(new Error('down'));
    const tyTextarea = renderWithForm(
      <SafePlace onClose={() => {}} />,
      'ty',
    ).getByPlaceholderText(
      'Это небольшой уютный лес недалеко от дома. Я слышу птиц...',
    );
    await act(async () => {});
    fireEvent.change(tyTextarea, { target: { value: 'текст на ты' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText(/попробуй ещё раз/)).toBeTruthy(),
    );
    cleanup();
    // SafePlace пишет в localStorage синхронно даже при упавшем сохранении
    // (офлайн-устойчивость) — без очистки следующий рендер откроется сразу
    // в режиме просмотра вместо формы.
    localStorage.clear();

    mockApi.saveSafePlace.mockRejectedValueOnce(new Error('down'));
    const vyTextarea = renderWithForm(
      <SafePlace onClose={() => {}} />,
      'vy',
    ).getByPlaceholderText(
      'Это небольшой уютный лес недалеко от дома. Я слышу птиц...',
    );
    await act(async () => {});
    fireEvent.change(vyTextarea, { target: { value: 'текст на вы' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText(/попробуйте ещё раз/)).toBeTruthy(),
    );
  });
});
