// Общий каркас публичных страниц мини-тестов (/tests, /tests/:id):
// тёмный aurora-холст, навбар, футер-CTA в бота. Одна механика — один
// компонент: рамка живёт здесь, страницы рисуют только содержимое.
import { Link } from 'react-router-dom';
import {
  CANVAS, INK, SUB, FAINT, GLASS_BORDER, AURORA, VIOLET, PINK, glow,
} from '../landing/aurora';
import { Logo, Cta } from '../landing/BrandKit';
import { botUrl } from '../../utils/botConfig';

export function TestsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: '100dvh', background: CANVAS, color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* фоновые пятна-авроры, как на продуктовом лендинге */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: glow(VIOLET, .14), filter: 'blur(120px)', top: '-12%', right: '-8%' }} />
        <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', background: glow(PINK, .10), filter: 'blur(130px)', bottom: '-14%', left: '-6%' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 24px', borderBottom: `1px solid ${GLASS_BORDER}`, background: 'rgba(11,8,23,.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <a href="/" style={{ textDecoration: 'none' }} aria-label="На главную"><Logo /></a>
          <Cta href={botUrl}>Бот в Telegram ↗</Cta>
        </header>
        <main style={{ flex: 1, width: '100%', maxWidth: 720, margin: '0 auto', padding: '40px 20px 56px', boxSizing: 'border-box' }}>
          {children}
        </main>
        <footer style={{ borderTop: `1px solid ${GLASS_BORDER}`, padding: '36px 20px 44px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: SUB, margin: '0 0 18px', lineHeight: 1.65 }}>
              Эти же тесты есть в телеграм-боте — вместе с трекером пяти
              потребностей, дневниками и большим тестом схем.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Cta href={botUrl} size="lg">Продолжить в Telegram</Cta>
              <Cta href="/login" variant="ghost" size="lg">Войти в приложение</Cta>
            </div>
            <p style={{ fontSize: 12, color: FAINT, margin: '22px 0 0' }}>
              Мини-тесты — игра-наблюдение по мотивам схема-терапии, а не
              диагностика и не замена психотерапии.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Прогресс прохождения: «Вопрос X из N» + аврора-полоска. */
export function QuizProgress({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ margin: '0 0 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: FAINT, marginBottom: 8 }}>
        <span>Вопрос {index + 1} из {total}</span>
        <Link to="/tests" style={{ color: FAINT, textDecoration: 'none' }}>✕ выйти</Link>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${(index / total) * 100}%`, height: '100%', borderRadius: 4, background: AURORA, transition: 'width .25s' }} />
      </div>
    </div>
  );
}
