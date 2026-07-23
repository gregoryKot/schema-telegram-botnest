// Прохождение мини-теста (/tests/:quizId): интро («что это и зачем» — правило
// онбординга) → вопросы → результат с подсказкой и CTA в бота. Без регистрации;
// аналитика — анонимные quiz_started/quiz_completed (POST /api/public-event).
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useQuizzes } from '../../hooks/useQuizzes';
import { useQuizRunner } from '../../hooks/useQuizRunner';
import { Skeleton, SkeletonCard } from '../../components/Skeleton';
import { INK, SUB, FAINT, GLASS_BORDER, AURORA, glow, VIOLET, PINK, GLASS_CARD } from '../landing/aurora';
import { TestsFrame, QuizProgress } from './testsKit';

const OPTION_STYLE: React.CSSProperties = {
  ...GLASS_CARD,
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '16px 18px',
  fontSize: 15,
  lineHeight: 1.5,
  fontWeight: 600,
  fontFamily: 'inherit',
  color: INK,
  cursor: 'pointer',
  transition: 'transform .15s, border-color .15s, background .15s',
};

export function QuizPage() {
  const { quizId } = useParams();
  const { quizzes, error } = useQuizzes();
  const quiz = quizzes?.find((q) => q.id === quizId) ?? null;
  const runner = useQuizRunner(quiz);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
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
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
        <div style={{ ...GLASS_CARD, padding: '24px 22px', fontSize: 15, color: SUB }}>
          Не получилось загрузить тест.{' '}
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: INK, cursor: 'pointer', textDecoration: 'underline' }}>
            Попробовать ещё раз
          </button>
        </div>
      )}

      {quiz && !started && (
        <div>
          <Link to="/tests" style={{ fontSize: 13, fontWeight: 700, color: FAINT, textDecoration: 'none' }}>← Все тесты</Link>
          <div aria-hidden style={{ fontSize: 56, margin: '18px 0 6px' }}>{quiz.emoji}</div>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.08, margin: '0 0 18px' }}>{quiz.title}</h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: SUB, whiteSpace: 'pre-line', maxWidth: 560, margin: '0 0 26px' }}>{quiz.intro}</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={start} style={{ padding: '15px 30px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', borderRadius: 14, border: 'none', cursor: 'pointer', background: AURORA, color: '#1a0f2e', boxShadow: `0 8px 30px ${glow(VIOLET, .45)}` }}>
              Начать →
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: FAINT }}>{quiz.questions.length} вопросов · ~2 минуты</span>
          </div>
        </div>
      )}

      {quiz && started && !runner.finished && runner.question && (
        <div>
          <QuizProgress index={runner.index} total={runner.total} />
          <h2 style={{ fontSize: 'clamp(21px, 3.6vw, 28px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25, margin: '0 0 20px' }}>
            {runner.question.text}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {runner.question.options.map((o, idx) => (
              <button
                key={o.label}
                onClick={() => runner.answer(idx)}
                style={OPTION_STYLE}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = glow(PINK, .45); e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {quiz && runner.result && (
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: FAINT, margin: '0 0 14px' }}>{quiz.title} · результат</p>
          <div style={{ ...GLASS_CARD, padding: '30px 26px', marginBottom: 18 }}>
            <div aria-hidden style={{ fontSize: 54, marginBottom: 10 }}>{runner.result.emoji}</div>
            <h1 style={{ fontSize: 'clamp(26px, 4.6vw, 38px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.12, margin: '0 0 14px' }}>{runner.result.title}</h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: SUB, margin: 0 }}>{runner.result.text}</p>
          </div>
          <div style={{ ...GLASS_CARD, padding: '18px 20px', marginBottom: 26, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ fontSize: 20 }}>💡</span>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: SUB, margin: 0 }}>{runner.result.hint}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <button onClick={() => { void share(); }} style={{ padding: '13px 24px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', borderRadius: 14, border: 'none', cursor: 'pointer', background: AURORA, color: '#1a0f2e' }}>
              {copied ? 'Скопировано ✓' : 'Поделиться результатом'}
            </button>
            <button onClick={() => { completedSent.current = false; runner.restart(); }} style={{ padding: '13px 24px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', borderRadius: 14, cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: INK, border: `1px solid ${GLASS_BORDER}` }}>
              Пройти ещё раз
            </button>
            <Link to="/tests" style={{ padding: '13px 24px', fontSize: 14, fontWeight: 700, borderRadius: 14, textDecoration: 'none', background: 'rgba(255,255,255,.04)', color: INK, border: `1px solid ${GLASS_BORDER}`, boxSizing: 'border-box' }}>
              Другие тесты
            </Link>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: FAINT, maxWidth: 520, margin: 0 }}>
            Это игра-наблюдение, а не диагноз. Если тема отозвалась — в
            приложении есть большой тест схем (116 вопросов) и трекер
            потребностей.
          </p>
        </div>
      )}
    </TestsFrame>
  );
}
