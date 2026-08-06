// @vitest-environment jsdom
// Кризисная детекция в письме уязвимому ребёнку (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LetterEx } from './LetterEx';

vi.mock('../../api', () => ({
  api: {
    getLetters: vi.fn(),
    createLetter: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <LetterEx onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getLetters.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('LetterEx — приветствие без мужского рода', () => {
  // Было «Дорогой маленький я,» — прилагательные согласовывались с «я», то есть
  // с читателем, и женщина читала письмо к себе в мужском роде. Приветствие
  // держим в обоих экранах — черновике и запечатанном.
  it('черновик письма приветствует нейтрально', () => {
    renderSheet();
    expect(screen.getByText('Здравствуй,')).toBeTruthy();
    expect(screen.queryByText(/маленький я|Дорогой мой ребёнок/)).toBeNull();
  });

  it('запечатанное письмо показывает тот же текст и то же приветствие', async () => {
    mockApi.createLetter.mockResolvedValue({});
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Тебе тогда очень нужна была поддержка.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));

    expect(await screen.findByText('Здравствуй,')).toBeTruthy();
    expect(screen.getByText('Тебе тогда очень нужна была поддержка.')).toBeTruthy();
    expect(mockApi.createLetter).toHaveBeenCalledWith('Тебе тогда очень нужна была поддержка.');
    expect(screen.getByText('6 слов')).toBeTruthy();
  });

  it('прошлые письма показываются, а только что написанное в них не дублируется', async () => {
    mockApi.createLetter.mockResolvedValue({});
    mockApi.getLetters.mockResolvedValue([
      { text: 'сегодняшнее', createdAt: new Date().toISOString() },
      { text: 'прошлое письмо', createdAt: new Date().toISOString() },
    ]);
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'сегодняшнее' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));

    expect(await screen.findByText(/прошлое письмо/)).toBeTruthy();
    // «сегодняшнее» есть на бумаге письма, но не продублировано в списке прошлых
    expect(screen.queryByText(/«сегодняшнее…»/)).toBeNull();
  });

  it('«Изменить» возвращает к черновику с сохранённым текстом', async () => {
    mockApi.createLetter.mockResolvedValue({});
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'мой текст' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('мой текст');
  });
});

describe('LetterEx — кризисная детекция', () => {
  it('кризисная фраза в тексте письма показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Дорогой я, всё будет хорошо.' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
