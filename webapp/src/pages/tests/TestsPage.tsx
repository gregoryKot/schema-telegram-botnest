// Публичный список мини-тестов (/tests) — без регистрации. Правило
// онбординга: страница сама отвечает «что это, зачем и сколько займёт» до
// первого действия.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuizzes } from '../../hooks/useQuizzes';
import { SkeletonCard } from '../../components/Skeleton';
import { TestsFrame } from './testsKit';

export function TestsPage() {
  const { quizzes, error } = useQuizzes();

  useEffect(() => {
    document.title = 'Мини-тесты — Всё по схеме';
  }, []);

  return (
    <TestsFrame>
      <div className="pl2-pill">
        <span className="pl2-pill-dot" />
        Без регистрации · результат сразу
      </div>
      <h1 className="pl2-h1" style={{ fontSize: 'clamp(34px, 6vw, 52px)' }}>
        Мини-<em>тесты</em>
      </h1>
      <p className="pl2-lead" style={{ maxWidth: 560 }}>
        Лёгкие тесты по мотивам схема-терапии: 6–7 вопросов, пара минут — и
        небольшое наблюдение о себе с подсказкой, что с ним делать. Почты,
        регистрации и «мы вам перезвоним» не будет.
      </p>

      {error && (
        <div className="ds-card pl2-card-text">
          Не получилось загрузить тесты. <a href="/tests" className="pl2-link">Попробовать ещё раз</a>
        </div>
      )}

      {!quizzes && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-label="Тесты загружаются">
          <SkeletonCard height={132} />
          <SkeletonCard height={132} />
          <SkeletonCard height={132} />
        </div>
      )}

      {quizzes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {quizzes.map((q) => (
            <Link key={q.id} to={`/tests/${q.id}`} className="ds-card ds-card--hover pl2-quiz-row">
              <span aria-hidden className="pl2-quiz-emoji">{q.emoji}</span>
              <span className="pl2-card" style={{ minWidth: 0, gap: 4 }}>
                <span className="pl2-card-title">{q.title}</span>
                <span className="pl2-card-text">{q.teaser}</span>
                <span className="pl2-card-meta" style={{ margin: 0 }}>
                  {q.questions.length} вопросов · ~2 минуты
                </span>
              </span>
              <span aria-hidden className="pl2-quiz-arrow">→</span>
            </Link>
          ))}
        </div>
      )}
    </TestsFrame>
  );
}
