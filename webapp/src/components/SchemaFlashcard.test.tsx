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
  mockApi.getFlashcards.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
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
