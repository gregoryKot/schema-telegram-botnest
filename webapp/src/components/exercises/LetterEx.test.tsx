// @vitest-environment jsdom
// Кризисная детекция в письме уязвимому ребёнку (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LetterEx } from './LetterEx';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { getQuickAction } from '../../../../shared/src/quickActions/quickActions';
import { journeyTypeMeta } from '../../../../shared/src/journey/journeyMeta';
import { TASK_OPTIONS } from '../taskCreate/taskOptions';
import { ASSIGN_TEMPLATES } from '../therapist/assignTemplates';

vi.mock('../../api', () => ({
  api: {
    getLetters: vi.fn(),
    createLetter: vi.fn(),
    updateLetter: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const SEALED = { id: 1, text: '', createdAt: new Date().toISOString() };

function renderSheet() {
  return render(
    <MemoryRouter>
      <LetterEx onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Черновик письма живёт в localStorage (useDraftAutosave): без очистки
  // текст одного теста приезжал бы в поле следующего.
  localStorage.clear();
  mockApi.getLetters.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

// Одно упражнение звалось «Письмо Уязвимому Ребёнку» в библиотеке и «Письмо себе»
// в «плюсе», заданиях и «Мой путь» (docs/open/frontend-ux.md). Имя одно — из
// каталога упражнений; термин объясняет сам экран.
describe('LetterEx — одно имя письма везде', () => {
  const NAME = 'Письмо себе в детстве';

  it('каталог, «Инструменты», задания, шаблоны терапевта и «Мой путь» зовут письмо одинаково', () => {
    expect(exerciseCard('letter').title).toBe(NAME);
    expect(getQuickAction('letter_to_self').label).toBe(NAME);
    expect(TASK_OPTIONS.find(o => o.type === 'letter_to_self')?.label).toBe(NAME);
    expect(ASSIGN_TEMPLATES.find(t => t.preset.type === 'letter_to_self')?.title).toBe(NAME);
    expect(journeyTypeMeta('letter').label).toBe(NAME);
  });

  it('экран упражнения носит то же имя, а термин «Уязвимый Ребёнок» объясняет в подводке', () => {
    renderSheet();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Письмосебе в детстве');
    expect(screen.getByText(/В схема-терапии эту часть называют Уязвимым Ребёнком/)).toBeTruthy();
  });
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
    mockApi.createLetter.mockResolvedValue(SEALED);
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
    mockApi.createLetter.mockResolvedValue(SEALED);
    mockApi.getLetters.mockResolvedValue([
      { id: 1, text: 'сегодняшнее', createdAt: new Date().toISOString() },
      { id: 2, text: 'прошлое письмо', createdAt: new Date().toISOString() },
    ]);
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'сегодняшнее' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));

    expect(await screen.findByText(/прошлое письмо/)).toBeTruthy();
    // «сегодняшнее» есть на бумаге письма, но не продублировано в списке прошлых
    expect(screen.queryByText(/«сегодняшнее…»/)).toBeNull();
    expect(screen.getByText('Прошлые письма · 1')).toBeTruthy();
  });

  it('«Изменить» возвращает к черновику с сохранённым текстом', async () => {
    mockApi.createLetter.mockResolvedValue(SEALED);
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'мой текст' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('мой текст');
  });
});

describe('LetterEx — правка запечатанного письма и подписи', () => {
  // QA клиента 2026-11, З4: «Изменить» → «Запечатать» создавало второе письмо
  // («Прошлые письма · 2», старая версия оставалась).
  it('«Изменить» → «Запечатать» правит то же письмо, второго не создаёт', async () => {
    mockApi.createLetter.mockResolvedValue({ ...SEALED, id: 7 });
    mockApi.updateLetter.mockResolvedValue({ ...SEALED, id: 7 });
    const onComplete = vi.fn();
    render(
      <MemoryRouter>
        <LetterEx onBack={vi.fn()} onComplete={onComplete} />
      </MemoryRouter>,
    );
    const seal = () => fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Первая версия письма' } });
    seal();
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Исправленная версия письма' } });
    seal();

    expect(await screen.findByText('Исправленная версия письма')).toBeTruthy();
    expect(mockApi.createLetter).toHaveBeenCalledTimes(1);
    expect(mockApi.updateLetter).toHaveBeenCalledWith(7, 'Исправленная версия письма');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('число слов склоняется: «3 слова»', () => {
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'мне очень жаль' } });
    expect(screen.getByText('3 слова')).toBeTruthy();
  });

  // QA клиента 2026-11, З14: «Сохраняется в дневнике», а в «Записях» письма нет.
  it('подпись говорит, где письмо искать потом', () => {
    renderSheet();
    expect(screen.getByText('Письма хранятся в разделе «Мой путь»')).toBeTruthy();
    expect(screen.queryByText(/в дневнике/)).toBeNull();
  });
});

describe('LetterEx — кризисная детекция', () => {
  it('кризисная фраза в тексте письма показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Дорогой я, всё будет хорошо.' } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  // Правка запечатанного письма (PATCH /api/letters/:id, QA 2026-11, З4) —
  // тот же свободный текст, и карточка обязана появиться на повторном вводе.
  it('«Изменить» после «Запечатать»: кризисная фраза в правке показывает CrisisCard', async () => {
    mockApi.createLetter.mockResolvedValue({ ...SEALED, id: 7 });
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Тебе тогда было трудно.' } });
    fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-100-49-94')).toBeTruthy();
  });
});

describe('LetterEx — сбой сохранения не теряет письмо', () => {
  // Регрессия: сбой createLetter глушился, а экран говорил «написано» —
  // 15–25 минут работы терялись без следа. В мини-аппе (LetterToSelf) этот
  // класс уже закрыт; здесь та же гарантия: подтверждение только после
  // успеха, при отказе текст остаётся в поле.
  it('отказ createLetter: видна ошибка, письмо в поле, onComplete не вызван', async () => {
    mockApi.createLetter.mockRejectedValue(new Error('offline'));
    const onComplete = vi.fn();
    render(
      <MemoryRouter>
        <LetterEx onBack={vi.fn()} onComplete={onComplete} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Тебе нужна была поддержка.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Запечатать письмо/ }));
    });

    expect(screen.getByRole('alert').textContent).toContain('Не удалось сохранить письмо');
    // Экран «написано.» не показан, текст остался в редактируемом поле.
    expect(screen.queryByText(/написано/)).toBeNull();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Тебе нужна была поддержка.',
    );
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('повторная попытка после отказа успешна — письмо запечатано', async () => {
    mockApi.createLetter
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(SEALED);
    renderSheet();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Второй заход.' },
    });
    const sealBtn = () => screen.getByRole('button', { name: /Запечатать письмо/ });
    await act(async () => {
      fireEvent.click(sealBtn());
    });
    expect(screen.getByRole('alert')).toBeTruthy();

    await act(async () => {
      fireEvent.click(sealBtn());
    });
    expect(screen.getByText('Второй заход.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockApi.createLetter).toHaveBeenCalledTimes(2);
  });
});
