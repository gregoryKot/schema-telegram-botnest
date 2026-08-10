// @vitest-environment jsdom
// Компонентные тесты YSQTestSheet: старт теста, ответ на вопрос → прогресс,
// результат с активными схемами, пустая история. Мокаем только '../api' —
// хук useYsqTest (shared/src/hooks/useYsqTest) используется настоящий
// (задание: "реальный useYsqTest"). Образец сетапа —
// schema-miniapp/src/components/TrackerOverlay.test.tsx (vi.useFakeTimers для
// задержки после выбора ответа, ANSWER_ADVANCE_DELAY=160мс).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { YSQTestSheet, YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from './YSQTestSheet';

vi.mock('../api', () => ({
  api: {
    getYsqHistory: vi.fn(),
    getYsqResult: vi.fn(),
    getYsqProgress: vi.fn(),
    saveYsqProgress: vi.fn(),
    saveYsqResult: vi.fn(),
    deleteYsqProgress: vi.fn(),
    deleteYsqResult: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Вопросы схемы «Эмоциональная депривация» — 1..5 (1-indexed), домен attachment
// (shared/src/hooks/ysqSchemas.ts). Answers длиной 116 (QUESTIONS.length).
const TOTAL_QUESTIONS = 116;
function buildAnswers(
  activeQuestionIdxs: number[],
  activeValue = 6,
  restValue = 1,
): number[] {
  const arr = Array(TOTAL_QUESTIONS).fill(restValue);
  for (const i of activeQuestionIdxs) arr[i] = activeValue;
  return arr;
}
const DEPRIVATION_IDXS = [0, 1, 2, 3, 4]; // questions 1..5

function seedResult(answers: number[]) {
  localStorage.setItem(
    YSQ_RESULT_KEY,
    JSON.stringify({ date: '2026-07-20T10:00:00.000Z', answers }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getYsqHistory.mockResolvedValue([]);
  mockApi.getYsqResult.mockResolvedValue(null);
  mockApi.getYsqProgress.mockResolvedValue(null);
  mockApi.saveYsqProgress.mockResolvedValue(undefined);
  mockApi.saveYsqResult.mockResolvedValue(undefined);
  mockApi.deleteYsqProgress.mockResolvedValue(undefined);
  mockApi.deleteYsqResult.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Подстраховка: если тест с vi.useFakeTimers() упадёт до своего локального
  // vi.useRealTimers(), следующий тест иначе виснет — findBy/waitFor внутри
  // testing-library ждут реальных таймеров (см. регрессионный набор ниже).
  vi.useRealTimers();
});

describe('YSQTestSheet — открытие (интро)', () => {
  it('без сохранённого прогресса показывает кнопку «Начать тест»', () => {
    render(<YSQTestSheet onClose={vi.fn()} />);
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Начать тест' })).toBeTruthy();
  });

  it('с сохранённым прогрессом показывает «Продолжить (N из 116)»', () => {
    const answers = Array(TOTAL_QUESTIONS).fill(0);
    answers[0] = 3;
    answers[1] = 4; // 2 отвеченных вопроса, остальные ещё не начаты (0)
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers, page: 2 }),
    );
    render(<YSQTestSheet onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Продолжить (2 из 116)' }),
    ).toBeTruthy();
  });
});

describe('YSQTestSheet — старт теста', () => {
  it('клик «Начать тест» открывает первый вопрос с прогрессом 1 / 116', () => {
    render(<YSQTestSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Начать тест' }));
    expect(screen.getByText('1 / 116')).toBeTruthy();
  });
});

describe('YSQTestSheet — ответ на вопрос', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('выбор ответа сохраняет прогресс через api и через задержку переходит к следующему вопросу', async () => {
    render(<YSQTestSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Начать тест' }));
    expect(screen.getByText('1 / 116')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Часто так' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByText('2 / 116')).toBeTruthy();
    expect(mockApi.saveYsqProgress).toHaveBeenCalledWith(
      expect.arrayContaining([4]),
      1,
    );
  });

  it('кнопка «Назад» на втором вопросе возвращает прогресс к первому', async () => {
    render(<YSQTestSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Начать тест' }));
    fireEvent.click(screen.getByRole('button', { name: 'Часто так' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByText('2 / 116')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('1 / 116')).toBeTruthy();
  });
});

describe('YSQTestSheet — результат с активными схемами', () => {
  it('показывает выраженную схему, её метку и карточку', async () => {
    seedResult(buildAnswers(DEPRIVATION_IDXS));
    render(<YSQTestSheet onClose={vi.fn()} />);

    expect(await screen.findByText('Эмоциональная депривация')).toBeTruthy();
    expect(screen.getByText(/1.{1}выраженная схема/)).toBeTruthy();
    expect(screen.getByText('Читать карточку схемы')).toBeTruthy();
  });

  it('без выраженных схем показывает пустое состояние результата', async () => {
    seedResult(buildAnswers([])); // все ответы низкие (restValue=1)
    render(<YSQTestSheet onClose={vi.fn()} />);

    expect(
      await screen.findByText(
        'Выраженных схем не обнаружено — отличный результат.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Активных схем не найдено')).toBeTruthy();
  });
});

describe('YSQTestSheet — история прохождений', () => {
  it('пустая история (0-1 запись) — блок «История прохождений» не отображается', async () => {
    mockApi.getYsqHistory.mockResolvedValue([
      { id: 1, completedAt: '2026-07-20T10:00:00.000Z', scores: [] },
    ]);
    seedResult(buildAnswers(DEPRIVATION_IDXS));
    render(<YSQTestSheet onClose={vi.fn()} />);

    await screen.findByText('Эмоциональная депривация');
    await act(async () => {}); // flush getYsqHistory().then(...)
    expect(screen.queryByText('История прохождений')).toBeNull();
  });

  it('история из 2+ записей — блок «История прохождений» отображается', async () => {
    mockApi.getYsqHistory.mockResolvedValue([
      { id: 2, completedAt: '2026-07-25T10:00:00.000Z', scores: [] },
      { id: 1, completedAt: '2026-07-10T10:00:00.000Z', scores: [] },
    ]);
    seedResult(buildAnswers(DEPRIVATION_IDXS));
    render(<YSQTestSheet onClose={vi.fn()} />);

    await screen.findByText('Эмоциональная депривация');
    expect(await screen.findByText('История прохождений')).toBeTruthy();
  });
});

describe('YSQTestSheet — сетевые сбои видны пользователю (regression: check-silent-catch)', () => {
  it('провал проверки прогресса на сервере показывает баннер и кнопку «Проверить снова» на интро', async () => {
    mockApi.getYsqResult.mockRejectedValue(new Error('network'));
    mockApi.getYsqProgress.mockRejectedValue(new Error('network'));
    render(<YSQTestSheet onClose={vi.fn()} />);

    expect(
      await screen.findByText(/Не удалось проверить, есть ли на сервере/),
    ).toBeTruthy();
    const retryBtn = screen.getByRole('button', { name: 'Проверить снова' });

    mockApi.getYsqResult.mockResolvedValue(null);
    mockApi.getYsqProgress.mockResolvedValue(null);
    fireEvent.click(retryBtn);

    await act(async () => {});
    expect(
      screen.queryByText(/Не удалось проверить, есть ли на сервере/),
    ).toBeNull();
  });

  it('провал отправки результата на сервере: результат виден локально, показан баннер с кнопкой повтора', async () => {
    vi.useFakeTimers();
    mockApi.saveYsqResult.mockRejectedValue(new Error('network'));
    const savedAnswers = buildAnswers(DEPRIVATION_IDXS);
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers: savedAnswers, page: 115 }),
    );
    render(<YSQTestSheet onClose={vi.fn()} autoResume />);

    fireEvent.click(screen.getByRole('button', { name: 'Часто так' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // Результат виден несмотря на провал сохранения (данные не потеряны для юзера)
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();
    const retryBtn = screen.getByRole('button', { name: 'Отправить ещё раз' });
    expect(mockApi.deleteYsqProgress).not.toHaveBeenCalled();

    mockApi.saveYsqResult.mockResolvedValue(undefined);
    fireEvent.click(retryBtn);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockApi.deleteYsqProgress).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Отправить ещё раз' }),
    ).toBeNull();
    vi.useRealTimers();
  });
});

describe('YSQTestSheet — пройти заново', () => {
  it('подтверждение «Пройти заново» удаляет результат и возвращает к интро', async () => {
    seedResult(buildAnswers(DEPRIVATION_IDXS));
    render(<YSQTestSheet onClose={vi.fn()} />);
    await screen.findByText('Эмоциональная депривация');

    fireEvent.click(screen.getByRole('button', { name: 'Пройти заново' }));
    expect(
      screen.getByText('Результаты будут удалены. Точно начать заново?'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }));

    expect(mockApi.deleteYsqResult).toHaveBeenCalled();
    expect(mockApi.deleteYsqProgress).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Начать тест' })).toBeTruthy();
  });
});
