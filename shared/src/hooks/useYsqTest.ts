import { useEffect, useMemo, useRef, useState } from 'react';

// Общая логика теста на схемы (116 утверждений, скоринг, персист прогресса и
// результата, история прохождений) — парный файл для webapp и schema-miniapp
// (правило №3 CLAUDE.md). UI (вёрстка/стили/тексты) остаётся в каждом
// YSQTestSheet.tsx отдельно; сюда вынесено только то, что должно совпадать
// побайтово: вопросы/страницы, вычисления скоринга, сохранение/восстановление
// прогресса, сабмит в api.
//
// Разница окружений (api-клиент конкретного фронтенда) приходит параметром
// хука — этот файл не импортирует ничего фронтенд-специфичного кроме react.

// Вопросы, схемы и скоринг вынесены в соседние модули (правило №10) и
// ре-экспортируются здесь, чтобы существующие импорты из этого файла
// (оба фронтенда, правило №3) продолжали работать без изменений.
export * from './ysqQuestions';
export * from './ysqSchemas';
export * from './ysqScoring';

import { QUESTIONS, TOTAL_PAGES } from './ysqQuestions';
import {
  SCHEMAS,
  DOMAIN_ORDER,
  NEED_LABELS,
  SCHEMA_NAME_TO_ID,
  type SchemaInfo,
} from './ysqSchemas';
import {
  computeScores,
  isSchemaScoreActive,
  type Phase,
  type SchemaScore,
  type YsqHistoryEntry,
} from './ysqScoring';

export const YSQ_RESULT_KEY = 'ysq_result';
export const YSQ_PROGRESS_KEY = 'ysq_progress';

export interface YsqApi {
  getYsqHistory: () => Promise<YsqHistoryEntry[] | null | undefined>;
  getYsqResult: () => Promise<
    { answers: number[]; completedAt: string } | null | undefined
  >;
  getYsqProgress: () => Promise<
    { answers: number[]; page: number } | null | undefined
  >;
  saveYsqProgress: (answers: number[], page: number) => Promise<unknown>;
  saveYsqResult: (answers: number[]) => Promise<unknown>;
  deleteYsqProgress: () => Promise<unknown>;
  deleteYsqResult: () => Promise<unknown>;
}

export interface UseYsqTestOptions {
  api: YsqApi;
  autoResume?: boolean;
}

export interface ResultViewDomain {
  needId: string;
  label: string;
  schemas: SchemaInfo[];
}

export interface ResultView {
  activeSchemas: SchemaInfo[];
  inactiveSchemas: SchemaInfo[];
  activeByDomain: ResultViewDomain[];
  dateLabel: string | null;
  activeCount: number;
  activeLabel: string;
  getSchemaDelta: (schemaName: string) => number | null;
}

// Ответ выбран, но переход на следующий вопрос (или сабмит результата)
// откладывается на длительность анимации выбора ответа в UI теста.
const ANSWER_ADVANCE_DELAY = 160;

export function useYsqTest({ api, autoResume }: UseYsqTestOptions) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<number[]>(
    Array(QUESTIONS.length).fill(0),
  );
  const [page, setPage] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<YsqHistoryEntry[]>([]);
  const userStartedRef = useRef(false);
  const [hasProgress, setHasProgress] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [retakeConfirm, setRetakeConfirm] = useState(false);

  const progressAnswered = answers.filter((a) => a > 0).length;

  const goToPage = (newPage: number, dir: 'forward' | 'back') => {
    setSlideDir(dir);
    setSlideKey((k) => k + 1);
    setPage(newPage);
  };

  // Загрузка сохранённого состояния. autoResume означает «сразу к месту, где
  // пользователь остановился»: есть незаконченный прогресс → внутрь теста;
  // прогресса нет, но есть результат → показать результат (раньше autoResume
  // вовсе не грузил результат, и после прохождения кнопка входа открывала
  // интро с «Начать тест» — результаты было не найти).
  useEffect(() => {
    let resumedToTest = false;
    try {
      const saved = localStorage.getItem(YSQ_PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { answers: number[]; page: number };
        if (
          Array.isArray(parsed.answers) &&
          parsed.answers.length === QUESTIONS.length
        ) {
          setHasProgress(true);
          setAnswers(parsed.answers);
          if (autoResume) {
            setPage(parsed.page ?? 0);
            setPhase('test');
            resumedToTest = true;
          }
        }
      }
      if (!resumedToTest) {
        const result = localStorage.getItem(YSQ_RESULT_KEY);
        if (result) {
          const parsed = JSON.parse(result) as {
            answers?: number[];
            date?: string;
          };
          if (
            parsed.answers &&
            Array.isArray(parsed.answers) &&
            parsed.answers.length === QUESTIONS.length
          ) {
            setAnswers(parsed.answers);
            setPhase('result');
            if (parsed.date) setCompletedAt(parsed.date);
          }
        }
      }
    } catch {
      /* ignore */
    }

    if (!resumedToTest) {
      api
        .getYsqHistory()
        .then((h) => {
          if (h) setHistory(h);
        })
        .catch(() => {});

      Promise.all([api.getYsqResult(), api.getYsqProgress()])
        .then(([serverResult, serverProgress]) => {
          if (userStartedRef.current) return;
          const serverHasProgress =
            serverProgress?.answers &&
            Array.isArray(serverProgress.answers) &&
            serverProgress.answers.length === QUESTIONS.length;
          if (serverHasProgress) {
            localStorage.setItem(
              YSQ_PROGRESS_KEY,
              JSON.stringify({
                answers: serverProgress.answers,
                page: serverProgress.page,
              }),
            );
            setHasProgress(true);
          }
          if (autoResume && serverHasProgress) {
            setAnswers(serverProgress.answers);
            setPage(serverProgress.page);
            setPhase('test');
          } else if (
            serverResult?.answers &&
            Array.isArray(serverResult.answers) &&
            serverResult.answers.length === QUESTIONS.length
          ) {
            const dateStr =
              serverResult.completedAt ?? new Date().toISOString();
            localStorage.setItem(
              YSQ_RESULT_KEY,
              JSON.stringify({ date: dateStr, answers: serverResult.answers }),
            );
            setAnswers(serverResult.answers);
            setCompletedAt(dateStr);
            setPhase('result');
          } else if (serverHasProgress) {
            setAnswers(serverProgress.answers);
            setPage(serverProgress.page);
          }
        })
        .catch(() => {});
    }
  }, []);

  const saveProgress = (newAnswers: number[], newPage: number) => {
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers: newAnswers, page: newPage }),
    );
  };

  const handleContinue = () => {
    userStartedRef.current = true;
    try {
      const saved = localStorage.getItem(YSQ_PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { answers: number[]; page: number };
        if (
          Array.isArray(parsed.answers) &&
          parsed.answers.length === QUESTIONS.length
        ) {
          setAnswers(parsed.answers);
          setPage(parsed.page ?? 0);
        }
      }
    } catch {
      /* ignore */
    }
    setPhase('test');
  };

  const handleStartFresh = () => {
    userStartedRef.current = true;
    localStorage.removeItem(YSQ_PROGRESS_KEY);
    setAnswers(Array(QUESTIONS.length).fill(0));
    setPage(0);
    setHasProgress(false);
    setPhase('test');
  };

  const handleAnswer = (qIndex: number, value: number) => {
    const next = [...answers];
    next[qIndex] = value;
    setAnswers(next);
    saveProgress(next, page);
  };

  // Выбор ответа на текущий вопрос: сохраняет ответ сразу, а через
  // ANSWER_ADVANCE_DELAY переходит к следующему вопросу либо (на последнем
  // вопросе) сабмитит результат.
  const selectAnswer = (qIdx: number, value: number) => {
    handleAnswer(qIdx, value);
    setTimeout(() => {
      const newAnswers = answers.map((a, idx) => (idx === qIdx ? value : a));
      if (page < TOTAL_PAGES - 1) {
        const next = page + 1;
        goToPage(next, 'forward');
        saveProgress(newAnswers, next);
        api.saveYsqProgress(newAnswers, next).catch(() => {});
      } else {
        const dateStr = new Date().toISOString();
        localStorage.setItem(
          YSQ_RESULT_KEY,
          JSON.stringify({ date: dateStr, answers: newAnswers }),
        );
        api
          .saveYsqResult(newAnswers)
          .then(() =>
            api
              .getYsqHistory()
              .then((h) => {
                if (h) setHistory(h);
              })
              .catch(() => {}),
          )
          .catch(() => {});
        api.deleteYsqProgress().catch(() => {});
        localStorage.removeItem(YSQ_PROGRESS_KEY);
        setAnswers(newAnswers);
        setCompletedAt(dateStr);
        setPhase('result');
      }
    }, ANSWER_ADVANCE_DELAY);
  };

  const handleBack = () => {
    if (page > 0) {
      const prev = page - 1;
      goToPage(prev, 'back');
      saveProgress(answers, prev);
      api.saveYsqProgress(answers, prev).catch(() => {});
    } else {
      setPhase('intro');
    }
  };

  const handleRetake = () => {
    localStorage.removeItem(YSQ_RESULT_KEY);
    localStorage.removeItem(YSQ_PROGRESS_KEY);
    api.deleteYsqResult().catch(() => {});
    api.deleteYsqProgress().catch(() => {});
    setAnswers(Array(QUESTIONS.length).fill(0));
    setPage(0);
    setHasProgress(false);
    setInactiveExpanded(false);
    setCompletedAt(null);
    setRetakeConfirm(false);
    setPhase('intro');
  };

  const scores = phase === 'result' ? computeScores(answers) : null;

  const resultView = useMemo<ResultView | null>(() => {
    if (!scores) return null;
    const sortedSchemas = [...SCHEMAS].sort(
      (a, b) =>
        scores[b.name].pct5plus - scores[a.name].pct5plus ||
        scores[b.name].avg - scores[a.name].avg,
    );
    const activeSchemas = sortedSchemas.filter((s) =>
      isSchemaScoreActive(scores[s.name]),
    );
    const inactiveSchemas = sortedSchemas.filter(
      (s) => !isSchemaScoreActive(scores[s.name]),
    );

    const activeByDomain = DOMAIN_ORDER.map((needId) => ({
      needId,
      label: NEED_LABELS[needId],
      schemas: activeSchemas.filter((s) => s.needId === needId),
    })).filter((d) => d.schemas.length > 0);

    const dateLabel = completedAt
      ? new Date(completedAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    const activeCount = activeSchemas.length;
    const activeLabel =
      activeCount === 0
        ? 'Активных схем не найдено'
        : `${activeCount}\u00A0${activeCount === 1 ? 'выраженная схема' : activeCount < 5 ? 'выраженные схемы' : 'выраженных схем'}`;

    // Дельта со прошлого прохождения — в единицах среднего балла (главная
    // метрика карточки), напр. «+0.4». Старые записи истории могли не хранить
    // avg — тогда дельту не показываем (null), а не смешиваем с pct5plus.
    const prevEntry = history.length >= 2 ? history[1] : null;
    const getSchemaDelta = (schemaName: string): number | null => {
      if (!prevEntry) return null;
      const id = SCHEMA_NAME_TO_ID[schemaName];
      if (!id) return null;
      const prev = prevEntry.scores.find((s) => s.id === id);
      if (prev == null || prev.avg == null) return null;
      return Math.round(((scores[schemaName]?.avg ?? 0) - prev.avg) * 10) / 10;
    };

    return {
      activeSchemas,
      inactiveSchemas,
      activeByDomain,
      dateLabel,
      activeCount,
      activeLabel,
      getSchemaDelta,
    };
  }, [scores, history, completedAt]);

  return {
    phase,
    setPhase,
    answers,
    page,
    slideKey,
    slideDir,
    completedAt,
    history,
    hasProgress,
    inactiveExpanded,
    setInactiveExpanded,
    retakeConfirm,
    setRetakeConfirm,
    progressAnswered,
    handleContinue,
    handleStartFresh,
    selectAnswer,
    handleBack,
    handleRetake,
    scores,
    resultView,
  };
}

// ── Шаринг результата ────────────────────────────────────────────────────────
// Картинка и короткий текст — shared/src/share/cards/ysqCard.ts через общий
// ShareCardSheet. Здесь только подробный текстовый фолбэк.

// Развёрнутый текст (фолбэк «поделиться текстом»): обе метрики по каждой
// выраженной схеме. Формулировки нейтральные (без ты/вы) — текст уходит
// третьим лицам.
export function buildShareText(
  scores: Record<string, SchemaScore>,
  dateLabel: string | null,
): string {
  const active = SCHEMAS.filter((s) => isSchemaScoreActive(scores[s.name]));
  const lines: string[] = [
    `Мой результат теста на схемы${dateLabel ? ` — ${dateLabel}` : ''}`,
    '',
  ];
  if (active.length === 0) {
    lines.push('Выраженных схем не обнаружено.');
  } else {
    lines.push(`Выраженные схемы (${active.length}):`);
    for (const s of active) {
      const sc = scores[s.name];
      lines.push(
        `• ${s.name} — средний балл ${sc.avg} из 6 (ответов «5–6»: ${sc.n5plus} из ${sc.nQuestions})`,
      );
    }
  }
  lines.push(
    '',
    'Средний балл — насколько утверждения схемы в среднем про меня (от 4 из 6 — выражена).',
    'Образовательный опросник для самонаблюдения, не диагноз. schemehappens.ru',
  );
  return lines.join('\n');
}
