// @vitest-environment jsdom
// Черновики упражнений с текстом (QA 2026-11, З3): «Письмо», «Безопасное
// место», «Проверка убеждения» и «Критик или забота?» держали текст только в
// useState — F5 или «Назад» стирали написанное. Перемонтирование = то, что
// видит человек после перезагрузки или повторного открытия: ввёл → закрыл →
// открыл → текст на месте; сохранил → открыл → пусто.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { LetterEx } from './LetterEx';
import { SafePlaceEx } from './SafePlaceEx';
import { BeliefCheckEx } from './BeliefCheckEx';
import { PhraseCheckEx } from './PhraseCheckEx';
import { PHRASE_CRITERIA } from '../../../../shared/src/phraseCheck/criteria';

vi.mock('../../api', () => ({
  api: {
    getLetters: vi.fn(),
    createLetter: vi.fn(),
    saveSafePlace: vi.fn(),
    getBeliefChecks: vi.fn(),
    createBeliefCheck: vi.fn(),
    getPhraseChecks: vi.fn(),
    createPhraseCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const open = (el: ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const valueOf = (el: HTMLElement) => (el as HTMLInputElement).value;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  for (const k of ['getLetters', 'getBeliefChecks', 'getPhraseChecks']) mockApi[k].mockResolvedValue([]);
  for (const k of ['createLetter', 'saveSafePlace', 'createBeliefCheck', 'createPhraseCheck']) mockApi[k].mockResolvedValue({});
});

describe('Письмо', () => {
  it('ввёл → закрыл → открыл: текст на месте; запечатал → открыл: пусто', async () => {
    const first = open(<LetterEx onBack={vi.fn()} />);
    type(screen.getByRole('textbox'), 'Тогда было очень страшно.');
    first.unmount();

    const second = open(<LetterEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByRole('textbox'))).toBe('Тогда было очень страшно.');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ })));
    second.unmount();

    open(<LetterEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByRole('textbox'))).toBe('');
  });

  it('отказ сервера черновик не стирает', async () => {
    mockApi.createLetter.mockRejectedValue(new Error('offline'));
    const first = open(<LetterEx onBack={vi.fn()} />);
    type(screen.getByRole('textbox'), 'Не потерять');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ })));
    first.unmount();
    open(<LetterEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByRole('textbox'))).toBe('Не потерять');
  });
});

describe('Безопасное место', () => {
  it('общее впечатление и чувства переживают закрытие, после сохранения — пусто', async () => {
    const first = open(<SafePlaceEx onBack={vi.fn()} />);
    type(screen.getByPlaceholderText(/небольшая полянка/), 'Дача у бабушки');
    type(screen.getByPlaceholderText(/шорох листьев/), 'скрип половиц');
    first.unmount();

    const second = open(<SafePlaceEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByPlaceholderText(/небольшая полянка/))).toBe('Дача у бабушки');
    expect(valueOf(screen.getByPlaceholderText(/шорох листьев/))).toBe('скрип половиц');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Сохранить место/ })));
    second.unmount();

    open(<SafePlaceEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByPlaceholderText(/небольшая полянка/))).toBe('');
  });
});

describe('Проверка убеждения', () => {
  it('убеждение, доказательства и шаг переживают закрытие', () => {
    const first = open(<BeliefCheckEx onBack={vi.fn()} />);
    type(screen.getByPlaceholderText(/я всегда всё порчу/), 'Я всегда всё порчу');
    fireEvent.click(screen.getByText(/Дальше · доказательства за/));
    type(screen.getByPlaceholderText('Добавить доказательство…'), 'Забыл про встречу');
    first.unmount();

    open(<BeliefCheckEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByPlaceholderText('Добавить доказательство…'))).toBe('Забыл про встречу');
    expect(screen.getByText(/Что подтверждает/).textContent).toContain('Я всегда всё порчу');
  });
});

describe('Критик или забота?', () => {
  it('фраза переживает закрытие, после сохранения — пусто', async () => {
    const first = open(<PhraseCheckEx onBack={vi.fn()} />);
    type(screen.getByPlaceholderText(/опять всё завалила/), 'Ни на что не гожусь');
    first.unmount();

    const second = open(<PhraseCheckEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByPlaceholderText(/опять всё завалила/))).toBe('Ни на что не гожусь');
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }));
    for (const c of PHRASE_CRITERIA) fireEvent.click(screen.getByText(c.critic));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Сохранить/ })));
    second.unmount();

    open(<PhraseCheckEx onBack={vi.fn()} />);
    expect(valueOf(screen.getByPlaceholderText(/опять всё завалила/))).toBe('');
  });
});
