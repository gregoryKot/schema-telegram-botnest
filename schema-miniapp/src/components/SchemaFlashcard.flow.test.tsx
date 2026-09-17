// @vitest-environment jsdom
// SchemaFlashcard — контейнер флешкарты «Здоровый Взрослый» (0% покрытия).
// Шаги (Grounding/Mode/Response/Need/Action/Done) уже покрыты своими
// тестами — здесь не мокаем их, а проходим реальный путь целиком: контейнер
// это единственное место, которое знает порядок переходов и что именно
// летит в api.createFlashcard/localStorage. Grounding/История — в
// SchemaFlashcard.history.test.tsx (лимит ~300 строк/файл).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { SchemaFlashcard } from './SchemaFlashcard';
import { STORAGE_KEY } from './schemaFlashcard/constants';
import { api } from '../api';

vi.mock('../api', () => ({
  api: { getFlashcards: vi.fn(), createFlashcard: vi.fn() },
}));
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function passGrounding() {
  fireEvent.click(screen.getByText('Стало чуть лучше — разобраться →'));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getFlashcards.mockResolvedValue([]);
  mockApi.createFlashcard.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('SchemaFlashcard — весь путь mode → response → need → action → done', () => {
  it('заполняет карточку и в конце сохраняет её через api.createFlashcard', async () => {
    const onComplete = vi.fn();
    render(<SchemaFlashcard onClose={() => {}} onComplete={onComplete} />);

    passGrounding();
    expect(screen.getByText('Что сейчас активно?')).toBeTruthy();

    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(screen.getByText('Здоровый Взрослый')).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText('Что хочется сказать себе...'),
      { target: { value: 'Мне сейчас тяжело' } },
    );
    fireEvent.click(screen.getByText('Дальше →'));
    expect(screen.getByText('Что за этим стоит?')).toBeTruthy();

    fireEvent.click(screen.getByText('Привязанность'));
    expect(screen.getByText('Один маленький шаг')).toBeTruthy();

    const saveBtn = screen.getByText('Сохранить');
    expect(saveBtn.disabled).toBe(true);

    fireEvent.change(
      screen.getByPlaceholderText(
        'Написать другу, выйти подышать, обнять подушку...',
      ),
      { target: { value: 'Позвонить маме' } },
    );
    expect(screen.getByText('Сохранить').disabled).toBe(false);
    fireEvent.click(screen.getByText('Сохранить'));

    expect(screen.getByText('Сохранено')).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(mockApi.createFlashcard).toHaveBeenCalledWith({
        modeId: 'vulnerable_child',
        needId: 'attachment',
        reflection: 'Мне сейчас тяжело',
        action: 'Позвонить маме',
      }),
    );

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].action).toBe('Позвонить маме');
    expect(stored[0].needId).toBe('attachment');
  });

  it('пустая рефлексия уходит в api как undefined, а не пустая строка', async () => {
    render(<SchemaFlashcard onClose={() => {}} />);
    passGrounding();
    fireEvent.click(screen.getByText('Злой Ребёнок'));
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Автономия'));
    fireEvent.change(
      screen.getByPlaceholderText(
        'Написать другу, выйти подышать, обнять подушку...',
      ),
      { target: { value: 'Прогуляться' } },
    );
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(mockApi.createFlashcard).toHaveBeenCalledWith(
        expect.objectContaining({ reflection: undefined }),
      ),
    );
  });

  it('сбой api.createFlashcard не мешает локальному сохранению — Done всё равно показывается', async () => {
    mockApi.createFlashcard.mockRejectedValue(new Error('network'));
    render(<SchemaFlashcard onClose={() => {}} />);
    passGrounding();
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(
      screen.getByPlaceholderText(
        'Написать другу, выйти подышать, обнять подушку...',
      ),
      { target: { value: 'Позвонить другу' } },
    );
    fireEvent.click(screen.getByText('Сохранить'));
    expect(screen.getByText('Сохранено')).toBeTruthy();
    await waitFor(() => expect(mockApi.createFlashcard).toHaveBeenCalled());
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].action).toBe('Позвонить другу');
    // regression: check-silent-catch — раньше провал не был виден вообще.
    await waitFor(() =>
      expect(screen.getByText(/Не удалось сохранить на сервере/)).toBeTruthy(),
    );
  });
});

describe('SchemaFlashcard — навигация назад и «Ещё одну»', () => {
  it('кнопка «←» на шаге «Ответ» возвращает на выбор режима', () => {
    render(<SchemaFlashcard onClose={() => {}} />);
    passGrounding();
    fireEvent.click(screen.getByText('Внутренний Критик'));
    expect(screen.getByText('Здоровый Взрослый')).toBeTruthy();
    fireEvent.click(screen.getByText('←'));
    expect(screen.getByText('Что сейчас активно?')).toBeTruthy();
  });

  it('кнопка «←» на шаге «Потребность» возвращает на «Ответ» с текстом рефлексии', () => {
    render(<SchemaFlashcard onClose={() => {}} />);
    passGrounding();
    fireEvent.click(screen.getByText('Внутренний Критик'));
    fireEvent.change(
      screen.getByPlaceholderText('Что хочется сказать себе...'),
      { target: { value: 'Держусь' } },
    );
    fireEvent.click(screen.getByText('Дальше →'));
    expect(screen.getByText('Что за этим стоит?')).toBeTruthy();
    fireEvent.click(screen.getByText('←'));
    expect(
      screen.getByPlaceholderText('Что хочется сказать себе...').value,
    ).toBe('Держусь');
  });

  it('«Ещё одну» из Done сбрасывает выбор и возвращает на экран заземления', async () => {
    render(<SchemaFlashcard onClose={() => {}} />);
    passGrounding();
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(
      screen.getByPlaceholderText(
        'Написать другу, выйти подышать, обнять подушку...',
      ),
      { target: { value: 'Шаг' } },
    );
    fireEvent.click(screen.getByText('Сохранить'));
    expect(screen.getByText('Сохранено')).toBeTruthy();

    fireEvent.click(screen.getByText('Ещё одну'));
    expect(screen.getByText('Всё правильно')).toBeTruthy();
  });

  it('«Готово» из Done зовёт onClose', async () => {
    const onClose = vi.fn();
    render(<SchemaFlashcard onClose={onClose} />);
    passGrounding();
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
    fireEvent.change(
      screen.getByPlaceholderText(
        'Написать другу, выйти подышать, обнять подушку...',
      ),
      { target: { value: 'Шаг' } },
    );
    fireEvent.click(screen.getByText('Сохранить'));
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
