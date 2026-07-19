// @vitest-environment jsdom
// Тест общей логики теста на схемы (этап 3 REMEDIATION_PLAN — вынос дублированной
// логики webapp/schema-miniapp в парный хук). Правило CLAUDE.md о
// read-after-write: прогресс и результат кэшируются в localStorage
// (денормализованное состояние, зеркалящее сервер) — поэтому кроме «сохранился
// ли ответ» здесь проверяется и «виден ли он после повторного монтирования».
//
// Копия webapp/src/hooks/useYsqTest.test.ts (файл-источник useYsqTest.ts —
// канонический байт-в-байт парный файл, см. scripts/check-paired-files.mjs) +
// доп. блок в конце — аудит паттерна setTimeout(..., ANSWER_ADVANCE_DELAY) в
// selectAnswer на баг класса useClientDetail (замыкание читает устаревший
// рендер вместо текущей правки).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useYsqTest,
  computeScores,
  QUESTIONS,
  TOTAL_PAGES,
  YSQ_PROGRESS_KEY,
  YSQ_RESULT_KEY,
  type YsqApi,
} from './useYsqTest';

function makeApi(overrides: Partial<YsqApi> = {}): YsqApi {
  return {
    getYsqHistory: vi.fn().mockResolvedValue([]),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    saveYsqProgress: vi.fn().mockResolvedValue(undefined),
    saveYsqResult: vi.fn().mockResolvedValue(undefined),
    deleteYsqProgress: vi.fn().mockResolvedValue(undefined),
    deleteYsqResult: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Advances the fake clock past the hook's internal ANSWER_ADVANCE_DELAY
// (setTimeout) deterministically, instead of sleeping wall-clock time —
// no real-time waits left in this suite.
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Скоринг ──────────────────────────────────────────────────────────────────
describe('computeScores', () => {
  // Схема «Эмоциональная депривация» = вопросы 1..5 (индексы 0..4).
  it('100% pct5plus когда все ответы схемы >= 5', () => {
    const answers = Array(QUESTIONS.length).fill(0);
    answers[0] = 5;
    answers[1] = 6;
    answers[2] = 5;
    answers[3] = 5;
    answers[4] = 6;
    const s = computeScores(answers)['Эмоциональная депривация'];
    expect(s.pct5plus).toBe(100);
    expect(s.sum).toBe(27);
    expect(s.max).toBe(30);
    expect(s.pct).toBe(90);
  });

  it('0% pct5plus когда ни один ответ схемы не достиг 5', () => {
    const answers = Array(QUESTIONS.length).fill(0);
    answers[0] = 3;
    answers[1] = 2;
    answers[2] = 4;
    answers[3] = 3;
    answers[4] = 1;
    expect(computeScores(answers)['Эмоциональная депривация'].pct5plus).toBe(0);
  });

  it('неотвеченные (0) вопросы не считаются числителем, но входят в знаменатель схемы', () => {
    const answers = Array(QUESTIONS.length).fill(0);
    answers[0] = 5; // отвечен только 1 из 5 вопросов схемы
    // 1 из 5 вопросов схемы >= 5 → 20%, а не 100% (знаменатель — вся схема, не только отвеченные)
    expect(computeScores(answers)['Эмоциональная депривация'].pct5plus).toBe(
      20,
    );
  });
});

// ── Персист/восстановление прогресса ────────────────────────────────────────
describe('useYsqTest — прогресс', () => {
  it('выбор ответа сохраняет прогресс в localStorage синхронно', () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api, autoResume: true }));

    act(() => {
      result.current.selectAnswer(0, 4);
    });

    const saved = JSON.parse(localStorage.getItem(YSQ_PROGRESS_KEY)!);
    expect(saved.answers[0]).toBe(4);
    expect(saved.page).toBe(0);
  });

  it('после ANSWER_ADVANCE_DELAY переходит на следующую страницу и обновляет прогресс', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api, autoResume: true }));

    act(() => {
      result.current.selectAnswer(0, 4);
    });
    await advance(250);

    expect(result.current.page).toBe(1);
    const saved = JSON.parse(localStorage.getItem(YSQ_PROGRESS_KEY)!);
    expect(saved.page).toBe(1);
    expect(api.saveYsqProgress).toHaveBeenCalledWith(expect.any(Array), 1);
  });

  it('read-after-write: сохранённый прогресс виден в новом монтировании хука (hasProgress + ответы)', async () => {
    const api1 = makeApi();
    const { result: r1 } = renderHook(() =>
      useYsqTest({ api: api1, autoResume: true }),
    );
    act(() => {
      r1.current.selectAnswer(0, 6);
    });
    await advance(250);

    // Новый инстанс хука — как при повторном открытии интро-экрана теста.
    const api2 = makeApi();
    const { result: r2 } = renderHook(() =>
      useYsqTest({ api: api2, autoResume: false }),
    );

    expect(r2.current.hasProgress).toBe(true);
    expect(r2.current.progressAnswered).toBe(1);
    expect(r2.current.answers[0]).toBe(6);
  });
});

// ── Завершение теста → результат сохранён и виден ───────────────────────────
describe('useYsqTest — завершение', () => {
  function seedProgressAtLastQuestion() {
    const answers = Array(QUESTIONS.length).fill(0);
    for (let i = 0; i < QUESTIONS.length - 1; i++) answers[i] = 3;
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers, page: TOTAL_PAGES - 1 }),
    );
    return answers;
  }

  it('ответ на последний вопрос сабмитит результат: localStorage, api, прогресс очищен', async () => {
    seedProgressAtLastQuestion();
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api, autoResume: true }));

    expect(result.current.phase).toBe('test');
    expect(result.current.page).toBe(TOTAL_PAGES - 1);

    act(() => {
      result.current.selectAnswer(TOTAL_PAGES - 1, 5);
    });
    await advance(250);

    expect(result.current.phase).toBe('result');
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();

    const savedResult = JSON.parse(localStorage.getItem(YSQ_RESULT_KEY)!);
    expect(savedResult.answers[TOTAL_PAGES - 1]).toBe(5);
    expect(savedResult.answers[0]).toBe(3);

    expect(api.saveYsqResult).toHaveBeenCalledTimes(1);
    const submitted = (api.saveYsqResult as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(submitted[TOTAL_PAGES - 1]).toBe(5);
    expect(api.deleteYsqProgress).toHaveBeenCalledTimes(1);
  });

  it('read-after-write: после завершения новое монтирование хука сразу показывает результат', async () => {
    seedProgressAtLastQuestion();
    const api1 = makeApi();
    const { result: r1 } = renderHook(() =>
      useYsqTest({ api: api1, autoResume: true }),
    );
    act(() => {
      r1.current.selectAnswer(TOTAL_PAGES - 1, 5);
    });
    await advance(250);

    // Повторное открытие карточки схемы/теста читает то, что реально сохранилось,
    // а не только внутреннее состояние первого инстанса хука.
    const api2 = makeApi();
    const { result: r2 } = renderHook(() =>
      useYsqTest({ api: api2, autoResume: false }),
    );

    expect(r2.current.phase).toBe('result');
    expect(r2.current.answers[TOTAL_PAGES - 1]).toBe(5);
    expect(r2.current.scores).not.toBeNull();
    expect(r2.current.resultView).not.toBeNull();
  });
});

// ── Аудит: selectAnswer и устаревшие замыкания ──────────────────────────────
// handleAnswer() кладёт в setTimeout не state, а `answers.map(...)` с явным
// патчем текущего [qIdx]=value — т.е. даже читая state из замыкания ДО
// коммита, конкретно текущий ответ не теряется (структурно не может отстать
// на шаг, в отличие от старого useClientDetail.autoSave).
describe('useYsqTest — selectAnswer: устаревшие замыкания (аудит)', () => {
  it('НЕ БАГ: значение, которое только что выбрали, попадает в снапшот на отправку — не устаревшее', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useYsqTest({ api, autoResume: true }));

    act(() => {
      result.current.selectAnswer(0, 6);
    });
    await advance(160);

    expect(api.saveYsqProgress).toHaveBeenCalledWith(
      expect.arrayContaining([6]),
      1,
    );
    const sent = (api.saveYsqProgress as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(sent[0]).toBe(6);
  });

  it(
    'НАЙДЕНО (отдельный класс бага, не устаревшее замыкание): двойной тап по одному ответу до срабатывания ' +
      'ANSWER_ADVANCE_DELAY не отменяет первый таймер — оба колбэка шлют api.saveYsqProgress',
    async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useYsqTest({ api, autoResume: true }),
      );

      // Быстрый двойной тап на первый вопрос разными ответами, до истечения
      // ANSWER_ADVANCE_DELAY (160мс) — в отличие от TrackerOverlay/SchemaIntroSheet,
      // здесь нет clearTimeout предыдущего таймера в selectAnswer, поэтому
      // планируются ДВА независимых таймера вместо одного дебаунсированного.
      act(() => {
        result.current.selectAnswer(0, 3);
      });
      act(() => {
        result.current.selectAnswer(0, 5);
      });
      await advance(160);

      // Последний выбранный ответ не теряется (это не баг «устаревшего
      // замыкания» — value передаётся аргументом и явно патчит нужный индекс)...
      expect(result.current.answers[0]).toBe(5);
      // ...страница продвинулась лишь на 1, потому что оба таймера читают
      // `page` из момента ДО первого тапа (оба замыкания видели page=0,
      // React ещё не успел закоммитить продвижение между двумя act()).
      expect(result.current.page).toBe(1);
      // Но именно поэтому api получает ДВА одинаковых по смыслу вызова вместо
      // одного — лишняя (хоть и не разрушительная) сетевая нагрузка. Не
      // фиксится в рамках этой задачи (не то же семейство бага, что
      // useClientDetail/SchemaIntroSheet/ModeIntroSheet/TrackerOverlay —
      // там дебаунс явно отменяет предыдущий таймер, здесь его никогда не было).
      expect(api.saveYsqProgress).toHaveBeenCalledTimes(2);
    },
  );
});
