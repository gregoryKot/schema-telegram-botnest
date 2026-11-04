// @vitest-environment jsdom
// Черновики упражнений с текстом в мини-аппе (QA 2026-11, З3; пара к
// webapp/src/components/exercises/exerciseDrafts.test.tsx, правило №3):
// ввёл → закрыл → открыл → текст на месте; сохранил → открыл → пусто.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LetterToSelf } from './LetterToSelf';
import { SafePlace } from './SafePlace';
import { BeliefCheck } from './BeliefCheck';
import { PhraseCheck } from './PhraseCheck';

vi.mock('../api', () => ({
  api: {
    getLetters: vi.fn(),
    createLetter: vi.fn(),
    getSafePlace: vi.fn(),
    saveSafePlace: vi.fn(),
    getBeliefChecks: vi.fn(),
    createBeliefCheck: vi.fn(),
    getPhraseChecks: vi.fn(),
    createPhraseCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

async function open(el: ReactElement) {
  const r = render(el);
  await act(async () => {}); // ответы GET-запросов
  return r;
}
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });
const valueOf = (el: HTMLElement) => (el as HTMLTextAreaElement).value;
const close = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  for (const k of ['getLetters', 'getBeliefChecks', 'getPhraseChecks'])
    mockApi[k].mockResolvedValue([]);
  mockApi.getSafePlace.mockResolvedValue(null);
  for (const k of ['createLetter', 'saveSafePlace', 'createBeliefCheck'])
    mockApi[k].mockResolvedValue(undefined);
  mockApi.createPhraseCheck.mockResolvedValue(undefined);
});

describe('Письмо себе', () => {
  const field = () => screen.getByPlaceholderText('Здравствуй,...');

  it('ввёл → закрыл → открыл: на месте; сохранил → открыл: пусто', async () => {
    const first = await open(<LetterToSelf onClose={close} />);
    type(field(), 'Тогда было страшно');
    first.unmount();

    const second = await open(<LetterToSelf onClose={close} />);
    expect(valueOf(field())).toBe('Тогда было страшно');
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить письмо' })),
    );
    second.unmount();

    await open(<LetterToSelf onClose={close} />);
    expect(valueOf(field())).toBe('');
  });
});

describe('Безопасное место', () => {
  const field = () => screen.getByPlaceholderText(/уютный лес/);

  it('несохранённая правка открывает редактор даже при сохранённом месте', async () => {
    const first = await open(<SafePlace onClose={close} />);
    type(field(), 'Дача у бабушки');
    first.unmount();

    mockApi.getSafePlace.mockResolvedValue({
      description: 'Старое место',
      updatedAt: new Date().toISOString(),
    });
    const second = await open(<SafePlace onClose={close} />);
    expect(valueOf(field())).toBe('Дача у бабушки');
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })),
    );
    expect(mockApi.saveSafePlace).toHaveBeenCalledWith('Дача у бабушки');
    second.unmount();
    expect(localStorage.getItem('exercise_draft_safe_place')).toBeNull();
  });
});

describe('Проверка убеждения', () => {
  it('убеждение и шаг переживают закрытие', async () => {
    const first = await open(<BeliefCheck onClose={close} />);
    type(screen.getByPlaceholderText(/я всегда всё порчу/), 'Я всё порчу');
    first.unmount();

    await open(<BeliefCheck onClose={close} />);
    expect(valueOf(screen.getByPlaceholderText(/я всегда всё порчу/))).toBe(
      'Я всё порчу',
    );
  });
});

describe('Критик или забота?', () => {
  it('фраза переживает закрытие', async () => {
    const first = await open(<PhraseCheck onClose={close} />);
    type(
      screen.getByPlaceholderText(/опять всё завалила/),
      'Ни на что не гожусь',
    );
    first.unmount();

    await open(<PhraseCheck onClose={close} />);
    expect(valueOf(screen.getByPlaceholderText(/опять всё завалила/))).toBe(
      'Ни на что не гожусь',
    );
  });
});
