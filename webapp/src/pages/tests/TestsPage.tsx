// Публичный список мини-тестов (/tests) — без регистрации. Правило
// онбординга: страница сама отвечает «что это, зачем и сколько займёт» до
// первого действия.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuizzes } from '../../hooks/useQuizzes';
import { SkeletonCard } from '../../components/Skeleton';
import { INK, SUB, FAINT, GLASS_BORDER, AURORA, glow, PINK, GLASS_CARD } from '../landing/aurora';
import { TestsFrame } from './testsKit';

export function TestsPage() {
  const { quizzes, error } = useQuizzes();

  useEffect(() => {
    document.title = 'Мини-тесты — Всё по схеме';
  }, []);

  return (
    <TestsFrame>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'rgba(255,255,255,.05)', border: `1px solid ${GLASS_BORDER}`, fontSize: 12.5, fontWeight: 700, color: SUB, marginBottom: 20 }}>
        🎲 Без регистрации · результат сразу
      </div>
      <h1 style={{ fontSize: 'clamp(34px, 6vw, 52px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05, margin: '0 0 14px' }}>
        Мини-<span style={{ background: AURORA, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>тесты</span>
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: SUB, maxWidth: 560, margin: '0 0 36px' }}>
        Лёгкие тесты по мотивам схема-терапии: 6–7 вопросов, пара минут — и
        небольшое наблюдение о себе с подсказкой, что с ним делать. Почты,
        регистрации и «мы вам перезвоним» не будет.
      </p>

      {error && (
        <div style={{ ...GLASS_CARD, padding: '24px 22px', fontSize: 15, color: SUB }}>
          Не получилось загрузить тесты. <a href="/tests" style={{ color: INK }}>Попробовать ещё раз</a>
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
            <Link
              key={q.id}
              to={`/tests/${q.id}`}
              style={{ ...GLASS_CARD, display: 'flex', gap: 18, alignItems: 'center', padding: '22px 20px', textDecoration: 'none', transition: 'transform .2s, border-color .2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = glow(PINK, .4); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
            >
              <span aria-hidden style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 18, fontSize: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: AURORA, boxShadow: `0 0 24px ${glow(PINK, .35)}` }}>
                {q.emoji}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', color: INK, marginBottom: 4 }}>{q.title}</span>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.55, color: SUB, marginBottom: 6 }}>{q.teaser}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: FAINT }}>
                  {q.questions.length} вопросов · ~2 минуты
                </span>
              </span>
              <span aria-hidden style={{ marginLeft: 'auto', color: FAINT, fontSize: 20 }}>→</span>
            </Link>
          ))}
        </div>
      )}
    </TestsFrame>
  );
}
