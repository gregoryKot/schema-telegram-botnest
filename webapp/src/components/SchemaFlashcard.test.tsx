// @vitest-environment jsdom
// Кризисная детекция в SchemaFlashcard (CLAUDE.md, правило №7): проверяем поле
// "reflection" на шаге ответа Здорового Взрослого — второй свободнотекстовый
// стейт (action) тестируется в BeliefCheckEx/FlashcardEx на том же паттерне.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaFlashcard } from './SchemaFlashcard';

vi.mock('../api', () => ({
  api: {
    getFlashcards: vi.fn(),
    createFlashcard: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderToResponseStep() {
  render(
    <MemoryRouter>
      <SchemaFlashcard onClose={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('Стало чуть лучше – разобраться →'));
  fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getFlashcards.mockResolvedValue([]);
  // save() вешает .catch() на результат — мок обязан быть промисом,
  // иначе падает уже внутри обработчика клика.
  mockApi.createFlashcard.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe('SchemaFlashcard — проход мастера и сохранение', () => {
  // Флоу из 4 шагов с несколькими точками входа: тест бьёт по связке
  // «прошёл шаги → сохранилось → показалось», а не только по записи
  // (CLAUDE.md, правило про read-after-write).
  function walkToAction() {
    renderToResponseStep();
    fireEvent.change(screen.getByPlaceholderText('Что хочется сказать себе...'), {
      target: { value: 'Побыть рядом с собой' },
    });
    fireEvent.click(screen.getByText('Дальше →'));
    fireEvent.click(screen.getByText('Привязанность'));
  }

  it('шаги идут по порядку и показывают свой номер', () => {
    renderToResponseStep();
    expect(screen.getByText('Шаг 2 из 4')).toBeTruthy();
    fireEvent.click(screen.getByText('Дальше →'));
    expect(screen.getByText('Шаг 3 из 4')).toBeTruthy();
    fireEvent.click(screen.getByText('Привязанность'));
    expect(screen.getByText('Шаг 4 из 4')).toBeTruthy();
    expect(screen.getByText('Один маленький шаг')).toBeTruthy();
  });

  it('«Назад» возвращает на предыдущий шаг', () => {
    renderToResponseStep();
    fireEvent.click(screen.getByText('Дальше →'));
    expect(screen.getByText('Шаг 3 из 4')).toBeTruthy();
    fireEvent.click(screen.getByText('Назад'));
    expect(screen.getByText('Шаг 2 из 4')).toBeTruthy();
  });

  it('выбранная потребность видна на шаге действия', () => {
    walkToAction();
    expect(screen.getByText('Потребность')).toBeTruthy();
    expect(screen.getByText('Привязанность')).toBeTruthy();
  });

  it('кнопка «Сохранить» заблокирована, пока действие пустое', () => {
    walkToAction();
    const btn = screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), {
      target: { value: 'выйти подышать' },
    });
    expect(btn.disabled).toBe(false);
  });

  it('сохранение уходит на бэк и в localStorage', () => {
    walkToAction();
    fireEvent.change(screen.getByPlaceholderText('Написать другу, выйти подышать, обнять подушку...'), {
      target: { value: 'выйти подышать' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(mockApi.createFlashcard).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'vulnerable_child',
        needId: 'attachment',
        reflection: 'Побыть рядом с собой',
        action: 'выйти подышать',
      }),
    );
    const stored = JSON.parse(localStorage.getItem('schema_flashcards') ?? '[]');
    expect(stored[0]).toEqual(
      expect.objectContaining({ action: 'выйти подышать', needId: 'attachment' }),
    );
  });
});

describe('SchemaFlashcard — кризисная детекция (reflection)', () => {
  it('кризисная фраза в отклике показывает CrisisCard', () => {
    renderToResponseStep();
    const textarea = screen.getByPlaceholderText('Что хочется сказать себе...');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderToResponseStep();
    const textarea = screen.getByPlaceholderText('Что хочется сказать себе...');
    fireEvent.change(textarea, { target: { value: 'Стало немного легче' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
