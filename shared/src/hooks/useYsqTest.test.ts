// @vitest-environment jsdom
// Хук теста на схемы: страницы вопросов, сохранение прогресса/результата в
// localStorage + api, автопереход после ответа, пересчёт результата. Самое
// важное здесь — связка «сохранил → нашёл» (правило CLAUDE.md для
// read-after-write): прогресс, записанный при ответе, обязан подхватываться
// при повторном монтировании хука (пользователь закрыл и снова открыл тест),
// а не теряться молча.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import {
  useYsqTest,
  buildShareText,
  QUESTIONS,
  TOTAL_PAGES,
  YSQ_PROGRESS_KEY,
  YSQ_RESULT_KEY,
  type YsqApi,
} from './useYsqTest';
import { SCHEMAS } from './ysqSchemas';
import { computeScores } from './ysqScoring';

function makeApi(overrides: Partial<YsqApi> = {}): YsqApi {
  return {
    getYsqHistory: vi.fn().mockResolvedValue(null),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    saveYsqProgress: vi.fn().mockResolvedValue(undefined),
    saveYsqResult: vi.fn().mockResolvedValue(undefined),
    deleteYsqProgress: vi.fn().mockResolvedValue(undefined),
    deleteYsqResult: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const emptyAnswers = () => Array(QUESTIONS.length).fill(0);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  // Сначала размонтируем хук, потом возвращаем таймеры. Иначе отложенное
  // сохранение прогресса, запланированное предыдущим тестом, срабатывает уже
  // ВНУТРИ следующего — после его localStorage.clear() — и тест падает на
  // чужих данных. Так и вышло: локально порядок выполнения был другой, и
  // течь проявилась только в CI.
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useYsqTest — начальное состояние', () => {
  it('без сохранённого прогресса/результата — интро, ответы пустые', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api }));
    await waitFor(() => expect(api.getYsqHistory).toHaveBeenCalled());
    expect(result.current.phase).toBe('intro');
    expect(result.current.answers).toEqual(emptyAnswers());
    expect(result.current.progressAnswered).toBe(0);
    expect(result.current.hasProgress).toBe(false);
  });

  it('handleStartFresh — переходит в test с чистыми ответами', () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api }));
    act(() => result.current.handleStartFresh());
    expect(result.current.phase).toBe('test');
    expect(result.current.page).toBe(0);
    expect(result.current.answers).toEqual(emptyAnswers());
  });
});

describe('useYsqTest — сохранение → нахождение прогресса (read-after-write)', () => {
  it('ответ пишется в localStorage сразу, до истечения задержки перехода', () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api }));
    act(() => result.current.handleStartFresh());
    act(() => result.current.selectAnswer(0, 4));
    const saved = JSON.parse(localStorage.getItem(YSQ_PROGRESS_KEY)!);
    expect(saved.answers[0]).toBe(4);
  });

  it('после перезахода (новый монтаж хука) прогресс подхватывается: hasProgress=true', async () => {
    const api = makeApi();
    const first = renderHook(() => useYsqTest({ api }));
    act(() => first.result.current.handleStartFresh());
    act(() => first.result.current.selectAnswer(0, 5));
    first.unmount();

    const second = renderHook(() => useYsqTest({ api: makeApi() }));
    await waitFor(() => expect(second.result.current.hasProgress).toBe(true));
    expect(second.result.current.answers[0]).toBe(5);
  });

  it('autoResume=true возвращает прямо в test с сохранённой страницей', async () => {
    const api = makeApi();
    const first = renderHook(() => useYsqTest({ api }));
    act(() => first.result.current.handleStartFresh());
    act(() => first.result.current.selectAnswer(2, 3));
    first.unmount();

    const second = renderHook(() =>
      useYsqTest({ api: makeApi(), autoResume: true }),
    );
    expect(second.result.current.phase).toBe('test');
    expect(second.result.current.answers[2]).toBe(3);
  });
});

describe('useYsqTest — прохождение по страницам', () => {
  it('selectAnswer на обычной странице: после задержки переходит дальше и шлёт прогресс в api', async () => {
    vi.useFakeTimers();
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api }));
    act(() => result.current.handleStartFresh());

    act(() => result.current.selectAnswer(0, 4));
    expect(result.current.page).toBe(0); // переход отложен на ANSWER_ADVANCE_DELAY
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.page).toBe(1);
    expect(api.saveYsqProgress).toHaveBeenCalledWith(
      expect.arrayContaining([4]),
      1,
    );
  });

  it('selectAnswer на последней странице: сабмитит результат, чистит прогресс', async () => {
    // Восстанавливаем прогресс сразу на последней странице (реалистичный
    // путь — незачем реально проходить 116 вопросов), затем отвечаем на
    // последний. autoResume ставит phase='test' прямо на сохранённой странице.
    vi.useFakeTimers();
    const savedAnswers = Array(QUESTIONS.length).fill(3);
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers: savedAnswers, page: TOTAL_PAGES - 1 }),
    );
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api, autoResume: true }));
    expect(result.current.phase).toBe('test');
    expect(result.current.page).toBe(TOTAL_PAGES - 1);

    act(() => result.current.selectAnswer(TOTAL_PAGES - 1, 6));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.phase).toBe('result');
    expect(api.saveYsqResult).toHaveBeenCalled();
    expect(api.deleteYsqProgress).toHaveBeenCalled();
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(YSQ_RESULT_KEY)!).answers[
        TOTAL_PAGES - 1
      ],
    ).toBe(6);
  });

  it('handleBack со страницы 0 уводит в intro, а не в отрицательную страницу', () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api }));
    act(() => result.current.handleStartFresh());
    expect(result.current.page).toBe(0);
    act(() => result.current.handleBack());
    expect(result.current.phase).toBe('intro');
  });

  it('handleBack со страницы > 0 идёт на предыдущую страницу и шлёт прогресс в api', () => {
    const savedAnswers = Array(QUESTIONS.length).fill(2);
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers: savedAnswers, page: 5 }),
    );
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api, autoResume: true }));
    expect(result.current.page).toBe(5);
    act(() => result.current.handleBack());
    expect(result.current.page).toBe(4);
    expect(result.current.phase).toBe('test');
    expect(api.saveYsqProgress).toHaveBeenCalledWith(
      expect.arrayContaining([2]),
      4,
    );
  });

  it('handleRetake: чистит и localStorage, и api, возвращает в intro', () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api }));
    act(() => result.current.handleStartFresh());
    act(() => result.current.selectAnswer(0, 6));
    act(() => result.current.handleRetake());
    expect(result.current.phase).toBe('intro');
    expect(result.current.answers).toEqual(emptyAnswers());
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
    expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull();
    expect(api.deleteYsqResult).toHaveBeenCalled();
    expect(api.deleteYsqProgress).toHaveBeenCalled();
  });
});

describe('useYsqTest — resultView', () => {
  it('без результата (phase !== result) — resultView и scores равны null', () => {
    const { result } = renderHook(() => useYsqTest({ api: makeApi() }));
    expect(result.current.scores).toBeNull();
    expect(result.current.resultView).toBeNull();
  });

  it('все ответы «6» — все схемы выражены, activeLabel во множественном числе', async () => {
    const savedAnswers = Array(QUESTIONS.length).fill(6);
    localStorage.setItem(
      YSQ_RESULT_KEY,
      JSON.stringify({ date: '2026-05-01T00:00:00Z', answers: savedAnswers }),
    );
    const { result } = renderHook(() => useYsqTest({ api: makeApi() }));
    await waitFor(() => expect(result.current.phase).toBe('result'));
    expect(result.current.resultView?.activeCount).toBe(SCHEMAS.length);
    expect(result.current.resultView?.activeLabel).toContain('выраженных схем');
    expect(result.current.resultView?.inactiveSchemas).toHaveLength(0);
  });

  it('ни одного ответа выше порога — «активных схем не найдено»', async () => {
    localStorage.setItem(
      YSQ_RESULT_KEY,
      JSON.stringify({ date: '2026-05-01T00:00:00Z', answers: emptyAnswers() }),
    );
    const { result } = renderHook(() => useYsqTest({ api: makeApi() }));
    await waitFor(() => expect(result.current.phase).toBe('result'));
    expect(result.current.resultView?.activeCount).toBe(0);
    expect(result.current.resultView?.activeLabel).toBe(
      'Активных схем не найдено',
    );
  });
});

describe('buildShareText', () => {
  it('без выраженных схем — «не обнаружено», без ложных данных', () => {
    const scores = computeScores(emptyAnswers());
    const text = buildShareText(scores, null);
    expect(text).toContain('Выраженных схем не обнаружено');
  });

  it('с датой и выраженной схемой — текст содержит её баллы', () => {
    const answers = emptyAnswers();
    for (const q of SCHEMAS[0].questions) answers[q - 1] = 6;
    const scores = computeScores(answers);
    const text = buildShareText(scores, '3 мая 2026');
    expect(text).toContain('3 мая 2026');
    expect(text).toContain(SCHEMAS[0].name);
    expect(text).toContain('средний балл 6');
  });
});

describe('useYsqTest — отложенный переход не переживает закрытие теста', () => {
  it('человек ответил и сразу закрыл тест — прогресс не уезжает на страницу, до которой он не дошёл', async () => {
    // Найдено этим же спеком: таймер автоперехода не отменялся при
    // размонтировании, поэтому через 160 мс после закрытия хук всё равно
    // писал прогресс со следующей страницей и дёргал api. В тестах это
    // выглядело как течь в соседний тест, у пользователя — как «я закрыл, а
    // оно само пролистнуло и сохранило».
    vi.useFakeTimers();
    const api = makeApi();
    const { result, unmount } = renderHook(() => useYsqTest({ api }));
    act(() => result.current.handleStartFresh());
    act(() => result.current.selectAnswer(0, 4));

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const saved = JSON.parse(localStorage.getItem(YSQ_PROGRESS_KEY)!) as {
      page: number;
    };
    expect(saved.page).toBe(0);
    expect(api.saveYsqProgress).not.toHaveBeenCalled();
  });
});
