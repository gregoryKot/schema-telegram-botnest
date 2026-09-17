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
  within,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { PhraseCheck } from './PhraseCheck';
import { PHRASE_CRITERIA } from '../../../shared/src/phraseCheck/criteria';
import { api } from '../api';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

vi.mock('../api', () => ({
  api: {
    getPhraseChecks: vi.fn(),
    createPhraseCheck: vi.fn(),
    updatePhraseCheck: vi.fn(),
    // Кризисная карточка трекает показ (правило №8) — без этого мока
    // падает не гейт, а аналитика внутри него.
    trackEvent: vi.fn(),
  },
}));

// canvas 2d-контекст в jsdom не реализован — карточка шаринга рисует на нём
// в useEffect при открытии (образец: ModeEntryShare.test.tsx).
function mockCanvasCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
  mockCanvasCtx() as unknown as RenderingContext,
);

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

  it('createPhraseCheck падает: финальный экран всё равно виден, но с предупреждением (regression: check-silent-catch)', async () => {
    // Раньше .catch(() => {}) прятал провал целиком — экран «Разобрано»
    // выглядел одинаково успешно вне зависимости от исхода запроса.
    vi.mocked(api.createPhraseCheck).mockRejectedValue(new Error('network'));
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    startWith('ни на что не гожусь');
    for (const c of PHRASE_CRITERIA)
      fireEvent.click(screen.getByText(c.critic));
    fireEvent.click(screen.getByText('Сохранить разбор'));

    expect(screen.getByText('БЫЛО')).toBeTruthy();
    await screen.findByText(/Не удалось сохранить разбор на сервере/);
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
    expect(screen.getByText(new RegExp(CRISIS_HOTLINE_DISPLAY))).toBeTruthy();
  });

  it('форма «вы»: обращение на «вы» и без «ты»-форм', () => {
    renderWithForm(<PhraseCheck onClose={() => {}} />, 'vy');
    expect(
      screen.getByText(/Запишите, что сказал внутренний голос/),
    ).toBeTruthy();
  });
});

// Прошлые разборы: тап открывает карточку, правится только rewrite, сохранение
// видно сразу в списке (read-after-write), сеть может подвести и без крашей.
describe('PhraseCheck — прошлые разборы', () => {
  const OLD_ENTRY = {
    id: 7,
    phrase: 'ни на что не гожусь',
    marks: ['goal' as const],
    rewrite: 'отчёт вышел с ошибкой, поправлю завтра',
    inWarmWords: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  async function openHistoryCard() {
    renderWithForm(<PhraseCheck onClose={() => {}} />);
    await waitFor(() => screen.getByRole('button', { name: /Открыть разбор/ }));
    fireEvent.click(screen.getByRole('button', { name: /Открыть разбор/ }));
  }

  /** Скоуп внутрь открытой карточки — фраза в ней дублирует текст строки
   * списка (это и есть цитата исходной фразы), поэтому глобальный
   * screen.getByText находит оба и падает на неоднозначности. */
  function cardScope() {
    const heading = screen.getByText('Разбор фразы');
    return within(heading.closest('.sheet-scroll') as HTMLElement);
  }

  beforeEach(() => {
    vi.mocked(api.getPhraseChecks).mockResolvedValue([OLD_ENTRY]);
  });

  it('тап по строке открывает карточку с текстом этого разбора', async () => {
    await openHistoryCard();

    // Исходная фраза — цитата (совпадает со строкой списка, поэтому
    // проверяем именно внутри открытой карточки — cardScope).
    expect(cardScope().getByText(`«${OLD_ENTRY.phrase}»`)).toBeTruthy();
    // Отметка критика этого разбора видна («короткая» подпись приметы).
    expect(screen.getByText('ткнуть в промах')).toBeTruthy();
    // Текущий ответ — в редактируемом поле.
    expect(screen.getByDisplayValue(OLD_ENTRY.rewrite)).toBeTruthy();
  });

  it('правка ответа зовёт api.updatePhraseCheck с нужным id и текстом', async () => {
    vi.mocked(api.updatePhraseCheck).mockResolvedValue({
      id: OLD_ENTRY.id,
      rewrite: 'новый, более добрый ответ',
    });
    await openHistoryCard();

    fireEvent.change(screen.getByDisplayValue(OLD_ENTRY.rewrite), {
      target: { value: 'новый, более добрый ответ' },
    });
    fireEvent.click(screen.getByText('Сохранить ответ'));

    await waitFor(() =>
      expect(api.updatePhraseCheck).toHaveBeenCalledWith(
        OLD_ENTRY.id,
        'новый, более добрый ответ',
      ),
    );
  });

  it('сохранил → увидел: обновлённый ответ виден в списке сразу, без перезахода', async () => {
    vi.mocked(api.updatePhraseCheck).mockResolvedValue({
      id: OLD_ENTRY.id,
      rewrite: 'новый, более добрый ответ',
    });
    await openHistoryCard();

    fireEvent.change(screen.getByDisplayValue(OLD_ENTRY.rewrite), {
      target: { value: 'новый, более добрый ответ' },
    });
    fireEvent.click(screen.getByText('Сохранить ответ'));

    await waitFor(() =>
      expect(screen.getByText('→ «новый, более добрый ответ»')).toBeTruthy(),
    );
  });

  it('ошибка сети не роняет экран и не делает вид, что сохранилось', async () => {
    vi.mocked(api.updatePhraseCheck).mockRejectedValue(new Error('offline'));
    await openHistoryCard();

    fireEvent.change(screen.getByDisplayValue(OLD_ENTRY.rewrite), {
      target: { value: 'текст, который не долетит' },
    });
    fireEvent.click(screen.getByText('Сохранить ответ'));

    await waitFor(() =>
      expect(screen.getByText(/Не сохранилось/)).toBeTruthy(),
    );
    // Список внизу остаётся со старым ответом — обмана «сохранилось» нет.
    expect(screen.getByText(`→ «${OLD_ENTRY.rewrite}»`)).toBeTruthy();
    expect(screen.queryByText('→ «текст, который не долетит»')).toBeNull();
  });

  it('шаринг открывает лист карточки', async () => {
    await openHistoryCard();

    fireEvent.click(
      screen.getByRole('button', { name: 'Поделиться карточкой' }),
    );
    expect(screen.getByText('Сохранить карточку')).toBeTruthy();
  });
});
