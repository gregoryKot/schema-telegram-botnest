// Общий каркас публичных страниц мини-тестов (/tests, /tests/:id): бумага
// кабинета, как продуктовый лендинг (styles/product-landing.css), шапка,
// футер-CTA в бота. Одна механика — один компонент: рамка живёт здесь,
// страницы рисуют только содержимое.
import { Link } from 'react-router-dom';
import { Logo, Cta } from '../landing/BrandKit';
import { botUrl } from '../../utils/botConfig';
import '../../styles/product-landing.css';

export function TestsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="light-lock pl2-root">
      <header className="pl2-header pl2-header--static">
        <a href="/" className="pl2-brand" aria-label="На главную"><Logo /></a>
        <Cta href={botUrl}>Бот в Telegram ↗</Cta>
      </header>
      <main className="pl2-tests-main">
        {children}
      </main>
      <footer className="pl2-tests-foot">
        <p className="pl2-card-text" style={{ maxWidth: 560, margin: '0 auto 18px' }}>
          Эти же тесты есть в телеграм-боте — вместе с трекером пяти
          потребностей, дневниками и большим тестом схем.
        </p>
        <div className="pl2-actions">
          <Cta href={botUrl} size="lg">Продолжить в Telegram</Cta>
          <Cta href="/login" variant="ghost" size="lg">Войти в приложение</Cta>
        </div>
        <p className="pl2-fine" style={{ marginTop: 24 }}>
          Мини-тесты — игра-наблюдение по мотивам схема-терапии, а не
          диагностика и не замена психотерапии.
        </p>
      </footer>
    </div>
  );
}

/** Прогресс прохождения: «Вопрос X из N» + полоска акцентного цвета. */
export function QuizProgress({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ margin: '0 0 22px' }}>
      <div className="pl2-card-meta" style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 8px' }}>
        <span>Вопрос {index + 1} из {total}</span>
        <Link to="/tests" className="pl2-link pl2-link--solo">✕ выйти</Link>
      </div>
      <div className="pl2-progress">
        <span style={{ width: `${(index / total) * 100}%` }} />
      </div>
    </div>
  );
}
