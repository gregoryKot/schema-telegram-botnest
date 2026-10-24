import { useEffect, useMemo, useRef, useState } from 'react';

// Общая логика теста на схемы (116 утверждений, скоринг, персист прогресса и
// результата, история прохождений) — парный файл для webapp и schema-miniapp
// (правило №3). UI остаётся в каждом YSQTestSheet.tsx отдельно; api-клиент
// приходит параметром хука — файл не импортирует ничего фронтенд-специфичного.
// Вопросы/схемы/скоринг/шаринг — в соседних модулях (правило №10),
// ре-экспортируются здесь, чтобы импорты потребителей не менялись.
export * from './ysqQuestions';
export * from './ysqSchemas';
export * from './ysqScoring';
export * from './ysqShareText';

import { QUESTIONS, TOTAL_PAGES } from './ysqQuestions';
import { computeScores, type Phase, type YsqHistoryEntry } from './ysqScoring';

// Сами значения — в ysqStorageKeys.ts (см. его комментарий): импорт здесь
// нужен для внутреннего использования хуком ниже, ре-экспорт — чтобы старые
// потребители `from './useYsqTest'` не заметили переезда.
import { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from './ysqStorageKeys';
export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY };

// Типы и сборка результата переехали в соседние модули (правило №10);
// ре-экспорт держит прежний путь импорта у потребителей.
import type { UseYsqTestOptions } from './ysqTest.types';
export type {
  YsqApi,
  UseYsqTestOptions,
  ResultViewDomain,
  ResultView,
} from './ysqTest.types';
import { buildYsqResultView } from './buildYsqResultView';

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
  // Таймер автоперехода к следующему вопросу. Держим ссылку, чтобы отменить
  // его при размонтировании: иначе человек, ответивший и тут же закрывший
  // тест, через 160 мс всё равно получал запись прогресса на страницу, до
  // которой не дошёл, — а на последнем вопросе ещё и отправку результата.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    [],
  );
  const [hasProgress, setHasProgress] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [retakeConfirm, setRetakeConfirm] = useState(false);
  // Не удалось проверить сохранённый на сервере прогресс/результат — без
  // флага «Начать тест» выглядит безопасным, а первый ответ перезаписывает
  // на сервере то, что реально отвечено на другом устройстве (upsert).
  const [resumeCheckFailed, setResumeCheckFailed] = useState(false);
  // Сабмит результата упал: localStorage уже обновлён, но на сервере его нет.
  const [resultSaveError, setResultSaveError] = useState(false);

  const progressAnswered = answers.filter((a) => a > 0).length;

  const goToPage = (newPage: number, dir: 'forward' | 'back') => {
    setSlideDir(dir);
    setSlideKey((k) => k + 1);
    setPage(newPage);
  };

  // Отдельная функция (не только тело mount-эффекта), чтобы кнопка
  // «Проверить снова» могла повторить её после сетевого сбоя.
  const checkServerState = () => {
    Promise.all([api.getYsqResult(), api.getYsqProgress()])
      .then(([serverResult, serverProgress]) => {
        setResumeCheckFailed(false);
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
          const dateStr = serverResult.completedAt ?? new Date().toISOString();
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
      .catch(() => setResumeCheckFailed(true));
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
        .catch((e) => console.error('getYsqHistory failed', e));

      checkServerState();
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
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      const newAnswers = answers.map((a, idx) => (idx === qIdx ? value : a));
      if (page < TOTAL_PAGES - 1) {
        const next = page + 1;
        goToPage(next, 'forward');
        saveProgress(newAnswers, next);
        // Локальный прогресс уже записан строкой выше — фон, не потеря
        // данных на этом устройстве, но лог нужен ловить рассинхрон между.
        api
          .saveYsqProgress(newAnswers, next)
          .catch((e) => console.error('saveYsqProgress failed', e));
      } else {
        const dateStr = new Date().toISOString();
        localStorage.setItem(
          YSQ_RESULT_KEY,
          JSON.stringify({ date: dateStr, answers: newAnswers }),
        );
        // Локальный результат уже показан вне зависимости от ответа
        // сервера — resultSaveError показывает баннер с кнопкой повтора.
        api
          .saveYsqResult(newAnswers)
          .then(() => {
            setResultSaveError(false);
            api
              .getYsqHistory()
              .then((h) => {
                if (h) setHistory(h);
              })
              .catch((e) => console.error('getYsqHistory failed', e));
            api
              .deleteYsqProgress()
              .catch((e) => console.error('deleteYsqProgress failed', e));
          })
          .catch(() => setResultSaveError(true));
        localStorage.removeItem(YSQ_PROGRESS_KEY);
        setAnswers(newAnswers);
        setCompletedAt(dateStr);
        setPhase('result');
      }
    }, ANSWER_ADVANCE_DELAY);
  };

  // Повтор отправки после сбоя — локальные ответы уже верны.
  const retrySaveResult = () => {
    api
      .saveYsqResult(answers)
      .then(() => {
        setResultSaveError(false);
        api
          .deleteYsqProgress()
          .catch((e) => console.error('deleteYsqProgress failed', e));
      })
      .catch(() => setResultSaveError(true));
  };

  const handleBack = () => {
    if (page > 0) {
      const prev = page - 1;
      goToPage(prev, 'back');
      saveProgress(answers, prev);
      api
        .saveYsqProgress(answers, prev)
        .catch((e) => console.error('saveYsqProgress failed', e));
    } else {
      setPhase('intro');
    }
  };

  const handleRetake = () => {
    localStorage.removeItem(YSQ_RESULT_KEY);
    localStorage.removeItem(YSQ_PROGRESS_KEY);
    api.deleteYsqResult().catch((e) => console.error('deleteYsqResult', e));
    api.deleteYsqProgress().catch((e) => console.error('deleteYsqProgress', e));
    setAnswers(Array(QUESTIONS.length).fill(0));
    setPage(0);
    setHasProgress(false);
    setInactiveExpanded(false);
    setCompletedAt(null);
    setRetakeConfirm(false);
    setPhase('intro');
  };

  const scores = phase === 'result' ? computeScores(answers) : null;

  const resultView = useMemo(
    () => buildYsqResultView(scores, history, completedAt),
    [scores, history, completedAt],
  );

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
    resumeCheckFailed,
    retryResumeCheck: checkServerState,
    resultSaveError,
    retrySaveResult,
  };
}
