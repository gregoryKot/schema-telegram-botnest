// @vitest-environment jsdom
// Правило №7 CLAUDE.md: свободный текст (письмо Уязвимому Ребёнку) обязан
// проходить через кризисную детекцию (crisisMarkers) с карточкой телефона
// доверия. Тест проверяет только появление/отсутствие карточки — не разметку.
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
import { LetterToSelf } from './LetterToSelf';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

vi.mock('../api', () => ({
  api: {
    getLetters: vi.fn(),
    createLetter: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getLetters.mockResolvedValue([]);
  mockApi.createLetter.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function renderSheet() {
  render(<LetterToSelf onClose={() => {}} />);
  await act(async () => {}); // flush getLetters()
  return screen.getByPlaceholderText('Здравствуй,...');
}

describe('LetterToSelf — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в тексте письма', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('карточка появляется от одного набора текста — ДО клика «Сохранить» и ДО любого сетевого запроса', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    // Детекция сработала без нажатия «Сохранить письмо» — раньше, чем текст
    // вообще мог уйти на сервер (createLetter ещё не вызывался).
    expect(mockApi.createLetter).not.toHaveBeenCalled();
  });
});

describe('LetterToSelf — сохранение: read-after-write и видимая ошибка', () => {
  it('сохранённое письмо переживает перезагрузку: следующий рендер подтягивает его с сервера', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, {
      target: { value: 'Здравствуй, я из будущего.' },
    });
    fireEvent.click(screen.getByText('Сохранить письмо'));
    await waitFor(() => expect(screen.getByText('✓ Сохранено')).toBeTruthy());
    cleanup();

    // «Перезагрузка»: чистый рендер, сервер теперь отдаёт письмо, которое мы
    // только что сохранили (реальный round-trip, не локальный кэш).
    mockApi.getLetters.mockResolvedValueOnce([
      {
        id: 1,
        text: 'Здравствуй, я из будущего.',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    render(<LetterToSelf onClose={() => {}} />);
    await act(async () => {});
    expect(screen.getByText('Здравствуй, я из будущего.')).toBeTruthy();
  });

  it('падение createLetter показывает видимую ошибку, а не тихо теряется', async () => {
    mockApi.createLetter.mockRejectedValueOnce(new Error('network down'));
    const textarea = await renderSheet();
    fireEvent.change(textarea, {
      target: { value: 'письмо, которое не долетит' },
    });
    fireEvent.click(screen.getByText('Сохранить письмо'));
    await waitFor(() =>
      expect(screen.getByText(/Не удалось сохранить на сервере/)).toBeTruthy(),
    );
    // Ложного «успеха» быть не должно — пользователь не должен подумать,
    // что письмо долетело до сервера, когда оно не долетело.
    expect(screen.queryByText('✓ Сохранено')).toBeNull();
  });

  it('текст ошибки звучит в обеих формах обращения (ты/вы)', async () => {
    mockApi.createLetter.mockRejectedValueOnce(new Error('down'));
    const tyTextarea = renderWithForm(
      <LetterToSelf onClose={() => {}} />,
      'ty',
    ).getByPlaceholderText('Здравствуй,...');
    await act(async () => {});
    fireEvent.change(tyTextarea, { target: { value: 'текст на ты' } });
    fireEvent.click(screen.getByText('Сохранить письмо'));
    await waitFor(() =>
      expect(screen.getByText(/попробуй ещё раз/)).toBeTruthy(),
    );
    cleanup();

    mockApi.createLetter.mockRejectedValueOnce(new Error('down'));
    const vyTextarea = renderWithForm(
      <LetterToSelf onClose={() => {}} />,
      'vy',
    ).getByPlaceholderText('Здравствуй,...');
    await act(async () => {});
    fireEvent.change(vyTextarea, { target: { value: 'текст на вы' } });
    fireEvent.click(screen.getByText('Сохранить письмо'));
    await waitFor(() =>
      expect(screen.getByText(/попробуйте ещё раз/)).toBeTruthy(),
    );
  });
});
