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
} from '@testing-library/react';
import { LetterToSelf } from './LetterToSelf';

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
  return screen.getByPlaceholderText('Дорогой маленький я...');
}

describe('LetterToSelf — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в тексте письма', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
