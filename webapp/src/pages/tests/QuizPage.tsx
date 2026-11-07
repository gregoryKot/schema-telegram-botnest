// Прохождение мини-теста (/tests/:quizId): интро («что это и зачем» — правило
// онбординга) → вопросы → результат с подсказкой и CTA в бота. Без регистрации;
// аналитика — анонимные quiz_started/quiz_completed (POST /api/public-event).
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useQuizzes } from '../../hooks/useQuizzes';
import { useQuizRunner } from '../../hooks/useQuizRunner';
import { Skeleton, SkeletonCard } from '../../components/Skeleton';
import { AUTHOR_SITE, trackPracticeClick } from '../landing/practiceLink';
import { TestsFrame, QuizProgress } from './testsKit';
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

      {quiz && !started && (
        <div>
          <Link to="/tests" className="pl2-link pl2-link--solo" style={{ fontSize: 13 }}>← Все тесты</Link>
          <div aria-hidden className="pl2-quiz-emoji" style={{ display: 'flex', margin: '8px 0 16px' }}>{quiz.emoji}</div>
          <h1 className="pl2-h1" style={{ fontSize: 'clamp(30px, 5vw, 44px)', margin: '0 0 18px' }}>{quiz.title}</h1>
          <p className="pl2-lead" style={{ whiteSpace: 'pre-line', maxWidth: 560, margin: '0 0 26px' }}>{quiz.intro}</p>
          <div className="pl2-actions">
            <button onClick={start} className="ds-btn pl2-cta--lg">
              Начать →
            </button>
            <span className="pl2-card-meta" style={{ margin: 0 }}>{quiz.questions.length} вопросов · ~2 минуты</span>
          </div>
        </div>
      )}

      {quiz && started && !runner.finished && runner.question && (
        <div>
          <QuizProgress index={runner.index} total={runner.total} />
          <h2 className="pl2-h2" style={{ fontSize: 'clamp(22px, 3.6vw, 30px)', lineHeight: 1.25, margin: '0 0 20px' }}>
            {runner.question.text}
          </h2>
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
        <div>
          <span className="pl2-eyebrow" style={{ margin: '0 0 14px' }}>{quiz.title} · результат</span>
          <div className="ds-card pl2-card" style={{ marginBottom: 16 }}>
            <div aria-hidden className="pl2-quiz-emoji">{runner.result.emoji}</div>
            <h1 className="pl2-h1" style={{ fontSize: 'clamp(26px, 4.6vw, 38px)', lineHeight: 1.12, margin: '4px 0 0' }}>{runner.result.title}</h1>
            <p className="pl2-card-text">{runner.result.text}</p>
          </div>
          <div className="pp-paper pl2-card pl2-card--paper" style={{ '--h': 70, marginBottom: 24 } as React.CSSProperties}>
            <span className="pl2-eyebrow">Что с этим делать</span>
            <p className="pl2-card-text">{runner.result.hint}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-12)', flexWrap: 'wrap', marginBottom: 22 }}>
            <button onClick={() => { void share(); }} className="ds-btn">
              {copied ? 'Скопировано ✓' : 'Поделиться результатом'}
            </button>
            <button onClick={() => { completedSent.current = false; runner.restart(); }} className="ds-btn ds-btn--secondary">
              Пройти ещё раз
            </button>
            <Link to="/tests" className="ds-btn ds-btn--secondary pl2-cta">
              Другие тесты
            </Link>
          </div>
          <p className="pl2-fine" style={{ lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
            Это игра-наблюдение, а не диагноз. Если тема отозвалась — в
            приложении есть большой тест схем (116 вопросов) и трекер
            потребностей.
          </p>
          {/* Мягкий мост к практике (событие practice_link_click, place: quiz) */}
          <div className="ds-card ds-card--row pl2-card" style={{ marginTop: 16, maxWidth: 520 }}>
            <p className="pl2-card-text" style={{ fontSize: 14 }}>
              Хочется разобрать результат с живым специалистом? Автор проекта
              работает в подходе схема-терапия, онлайн. Первая встреча — 15 минут,
              бесплатно.{' '}
              <a href={AUTHOR_SITE} target="_blank" rel="noopener noreferrer" onClick={() => trackPracticeClick('quiz')} className="pl2-link" style={{ whiteSpace: 'nowrap' }}>
                Познакомиться ↗
              </a>
            </p>
          </div>
        </div>
      )}
    </TestsFrame>
  );
}
