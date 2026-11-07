// Прохождение мини-теста (/tests/:quizId): интро («что это и зачем» — правило
// онбординга) → вопросы → результат с подсказкой и CTA в бота. Без регистрации;
// аналитика — анонимные quiz_started/quiz_completed (POST /api/public-event).
import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useQuizzes } from '../../hooks/useQuizzes';
import { useQuizRunner } from '../../hooks/useQuizRunner';
import { Skeleton, SkeletonCard } from '../../components/Skeleton';
import { TestsFrame, QuizProgress } from './testsKit';
import { QuizIntro } from './QuizIntro';
import { QuizResult } from './QuizResult';
import { useTimedFlag } from '../../../../shared/src/hooks/useTimedFlag';

export function QuizPage() {
  const { quizId } = useParams();
  const { quizzes, error } = useQuizzes();
  const quiz = quizzes?.find((q) => q.id === quizId) ?? null;
  const runner = useQuizRunner(quiz);
  const [started, setStarted] = useState(false);
  const [copied, flashCopied] = useTimedFlag(2000);
  const completedSent = useRef(false);

  useEffect(() => {
    if (quiz) document.title = `${quiz.title} — мини-тест`;
  }, [quiz]);

  // Связка «дошёл до результата → событие» (правило №8), ровно один раз.
  useEffect(() => {
    if (quiz && runner.result && !completedSent.current) {
      completedSent.current = true;
      api.trackPublicEvent('quiz_completed', { quiz: quiz.id, result: runner.result.id });
    }
  }, [quiz, runner.result]);

  if (quizzes && !quiz) return <Navigate to="/tests" replace />;

  const start = () => {
    if (!quiz) return;
    setStarted(true);
    api.trackPublicEvent('quiz_started', { quiz: quiz.id });
  };

  const share = async () => {
    if (!quiz || !runner.result) return;
    const text = `${runner.result.emoji} ${runner.result.title} — мой результат в мини-тесте «${quiz.title}». Пройти без регистрации: https://schemehappens.ru/tests/${quiz.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        flashCopied();
      }
    } catch { /* юзер закрыл шэр — не ошибка */ }
  };

  return (
    <TestsFrame>
      {!quiz && !error && (
        <div aria-label="Тест загружается">
          <Skeleton width="40%" height={16} style={{ marginBottom: 18 }} />
          <Skeleton width="75%" height={40} style={{ marginBottom: 22 }} />
          <SkeletonCard height={210} />
        </div>
      )}
      {error && (
        <div className="ds-card pl2-card-text">
          Не получилось загрузить тест.{' '}
          <button onClick={() => window.location.reload()} className="pl2-link" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            Попробовать ещё раз
          </button>
        </div>
      )}

      {quiz && !started && <QuizIntro quiz={quiz} onStart={start} />}

      {quiz && started && !runner.finished && runner.question && (
        <div>
          <QuizProgress index={runner.index} total={runner.total} />
          <h2 className="pl2-h2 pl2-question">{runner.question.text}</h2>
          <div className="u-col12">
            {runner.question.options.map((o, idx) => (
              <button key={o.label} onClick={() => runner.answer(idx)} className="pl2-option">
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {quiz && runner.result && (
        <QuizResult
          quiz={quiz}
          result={runner.result}
          copied={copied}
          onShare={() => { void share(); }}
          onRestart={() => { completedSent.current = false; runner.restart(); }}
        />
      )}
    </TestsFrame>
  );
}
