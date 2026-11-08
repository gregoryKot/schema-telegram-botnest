// Общий каркас публичных страниц мини-тестов (/tests, /tests/:id): бумага кабинета, как
// продуктовый лендинг (styles/product-landing.css + product-tests.css), шапка, футер-CTA
// в бота. Одна механика — один компонент: рамка живёт здесь, страницы рисуют содержимое.
import { Link } from 'react-router-dom';
import { Logo, Cta } from '../landing/BrandKit';
import { botUrl } from '../../utils/botConfig';
import { glue } from '../landing/typo';
import '../../styles/product-landing.css';
import '../../styles/product-tests.css';

export function TestsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="light-lock pl2-root">
      <header className="pl2-header pl2-header--static pl2-tests-head">
        <a href="/" className="pl2-brand" aria-label="На главную"><Logo /></a>
        <Cta href={botUrl}>Бот в Telegram ↗</Cta>
      </header>
      <main className="pl2-tests-main">
        {children}
      </main>
      <footer className="pl2-tests-foot">
        <p className="pl2-card-text pl2-tests-foot-text">
          {glue('Эти же тесты есть в телеграм-боте — вместе с трекером пяти потребностей, дневниками и большим тестом схем.')}
        </p>
        <div className="pl2-actions">
          <Cta href={botUrl} size="lg">Продолжить в Telegram</Cta>
          <Cta href="/login" variant="ghost" size="lg">Войти в приложение</Cta>
        </div>
        <p className="pl2-fine pl2-tests-foot-fine">
          {glue('Мини-тесты — игра-наблюдение по мотивам схема-терапии, а не диагностика и не замена психотерапии.')}
        </p>
      </footer>
    </div>
  );
}

/** Прогресс прохождения: «Вопрос X из N» + полоска акцентного цвета. */
export function QuizProgress({ index, total }: { index: number; total: number }) {
  return (
    <div className="pl2-quiz-progress">
      <div className="pl2-card-meta pl2-quiz-progress-head">
        <span>Вопрос {index + 1} из {total}</span>
        <Link to="/tests" className="pl2-link pl2-link--solo">✕ выйти</Link>
      </div>
      <div className="pl2-progress">
        <span style={{ width: `${(index / total) * 100}%` }} />
      </div>
    </div>
  );
}
