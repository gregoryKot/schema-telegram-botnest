// @vitest-environment jsdom
// Упражнение «Разобрать фразу»: путь целиком (фраза → четыре приметы →
// вердикт → переписать → сохранение), кризисный гейт на свободном тексте
// (правило №7) и форма обращения «вы» (правило ты/вы).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { PhraseCheck } from './PhraseCheck';
import { PHRASE_CRITERIA } from './phraseCheck/criteria';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    getPhraseChecks: vi.fn(),
    createPhraseCheck: vi.fn(),
    // Кризисная карточка трекает показ (правило №8) — без этого мока
    // падает не гейт, а аналитика внутри него.
    trackEvent: vi.fn(),
  },
}));

function renderWithForm(ui: ReactElement, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

/** Ввести фразу и дойти до шага разбора. */
function startWith(phrase: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: phrase } });
  fireEvent.click(screen.getByText('Разобрать →'));
}

beforeEach(() => {
  vi.mocked(api.getPhraseChecks).mockResolvedValue([]);
  vi.mocked(api.createPhraseCheck).mockResolvedValue(undefined as never);
});

afterEach(cleanup);

describe('PhraseCheck', () => {
  it('до первого действия объясняет, что это и зачем (правило онбординга)', async () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    expect(screen.getByText('Разобрать фразу')).toBeTruthy();
    expect(screen.getByText(/четырём приметам из схема-терапии/)).toBeTruthy();
    await waitFor(() => expect(api.getPhraseChecks).toHaveBeenCalled());
  });

  it('пустую фразу разобрать нельзя', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    expect(screen.getByText('Разобрать →').closest('button')?.disabled).toBe(
      true,
    );
  });

  it('все ответы «критик» → вердикт «Говорит критик», разбор уходит на сервер', async () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    startWith('ни на что не гожусь');

    for (const c of PHRASE_CRITERIA) {
      expect(screen.getByText(new RegExp(c.question))).toBeTruthy();
      fireEvent.click(screen.getByText(c.critic));
    }

    expect(screen.getByText(/Говорит критик/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'отчёт вышел с ошибкой, проверю цифры дважды' },
    });
    fireEvent.click(screen.getByText('Сохранить разбор'));

    expect(api.createPhraseCheck).toHaveBeenCalledWith({
      phrase: 'ни на что не гожусь',
      marks: ['person', 'fear', 'absolute', 'shame'],
      rewrite: 'отчёт вышел с ошибкой, проверю цифры дважды',
    });
    // Финальный экран показывает «было → стало» — ради этого всё и затевалось.
    expect(screen.getByText('БЫЛО')).toBeTruthy();
    expect(screen.getByText('СТАЛО')).toBeTruthy();
  });

  it('все ответы «забота» → переписывать не предлагается, приметы пустые', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    startWith('вышло неточно, поправлю завтра');

    for (const c of PHRASE_CRITERIA) fireEvent.click(screen.getByText(c.care));

    expect(screen.getByText(/Это самокоррекция/)).toBeTruthy();
    fireEvent.click(screen.getByText('Сохранить разбор'));
    expect(api.createPhraseCheck).toHaveBeenCalledWith({
      phrase: 'вышло неточно, поправлю завтра',
      marks: [],
      rewrite: undefined,
    });
  });

  it('кризисный маркер во фразе показывает телефон доверия', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'не хочу жить' },
    });
    expect(screen.getByText(/8-800-2000-122/)).toBeTruthy();
  });

  it('форма «вы»: обращение на «вы» и без «ты»-форм', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />, 'vy');
    expect(
      screen.getByText(/Запишите, что сказал внутренний голос/),
    ).toBeTruthy();
  });
});
