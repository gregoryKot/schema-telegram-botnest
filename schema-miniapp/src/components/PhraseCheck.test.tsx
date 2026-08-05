// @vitest-environment jsdom
// Упражнение «Критик или забота?»: путь целиком (фраза → девять примет →
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
import { PHRASE_CRITERIA } from '../../../shared/src/phraseCheck/criteria';
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
  fireEvent.click(screen.getByText('Проверить →'));
}

/** Пройти весь путь до шага переписывания, ответив «критик» на все приметы. */
function answerAllCritic(rewrite: string) {
  startWith('ни на что не гожусь');
  for (const c of PHRASE_CRITERIA) fireEvent.click(screen.getByText(c.critic));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: rewrite } });
}

beforeEach(() => {
  vi.mocked(api.getPhraseChecks).mockResolvedValue([]);
  vi.mocked(api.createPhraseCheck).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('PhraseCheck', () => {
  it('до первого действия объясняет, что это и зачем (правило онбординга)', async () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    expect(screen.getByText('Критик или забота?')).toBeTruthy();
    expect(
      screen.getByText(/девяти приметам разрушительной самокритики/),
    ).toBeTruthy();
    await waitFor(() => expect(api.getPhraseChecks).toHaveBeenCalled());
  });

  it('пустую фразу разобрать нельзя', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    expect(screen.getByText('Проверить →').closest('button')?.disabled).toBe(
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
      marks: [
        'goal',
        'notok',
        'person',
        'label',
        'fear',
        'never',
        'mistake',
        'absolute',
        'worth',
      ],
      rewrite: 'отчёт вышел с ошибкой, проверю цифры дважды',
      // Галочка «в тёплые слова» стоит по умолчанию — переписанная фраза и
      // есть слова поддержки; тест ловит смену дефолта.
      inWarmWords: true,
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
      // Переписывать было нечего — забирать в коллекцию тоже нечего.
      inWarmWords: false,
    });
  });

  it('прогресс идёт до конца и считает приметы, а не застревает', () => {
    // Регрессия: полоса делилась на три сегмента, и после первой же приметы
    // показывала две трети до самого финала.
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    startWith('ни на что не гожусь');

    const bar = () => screen.getByRole('progressbar');
    const at = () => Number(bar().getAttribute('aria-valuenow'));
    expect(bar().getAttribute('aria-valuemax')).toBe(
      String(PHRASE_CRITERIA.length + 2),
    );

    const seen: number[] = [];
    for (const [i, c] of PHRASE_CRITERIA.entries()) {
      expect(
        screen.getByText(`Примета ${i + 1} из ${PHRASE_CRITERIA.length}`),
      ).toBeTruthy();
      seen.push(at());
      fireEvent.click(screen.getByText(c.critic));
    }
    // Каждый шаг двигает полосу ровно на один и доходит до максимума.
    expect(seen).toEqual(PHRASE_CRITERIA.map((_, i) => i + 2));
    expect(at()).toBe(PHRASE_CRITERIA.length + 2);
  });

  it('«в тёплые слова» можно снять — тогда фраза в коллекцию не идёт', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    answerAllCritic('вышло неточно, поправлю');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Сохранить разбор'));

    expect(api.createPhraseCheck).toHaveBeenCalledWith(
      expect.objectContaining({ inWarmWords: false }),
    );
  });

  it('поделиться можно и краткой карточкой, и всем разбором', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    answerAllCritic('вышло неточно, поправлю');
    fireEvent.click(screen.getByText('Сохранить разбор'));

    expect(screen.getByText('Поделиться всем разбором')).toBeTruthy();
    // Краткая карточка живёт за пилюлей шаринга — она рядом с подписью.
    expect(screen.getByText(/только две реплики/)).toBeTruthy();
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
