import { Cta } from './BrandKit';
import { AUTHOR_SITE, trackPracticeClick } from './practiceLink';

// Блок «Кто это делает»: автор проекта работает в подходе схема-терапия, частная практика.
// Клик по CTA — продуктовое событие practice_link_click (place: 'author'),
// видно в /stats. Композиция своя, не копия Telegram-ленты (jscpd).
// Вид — белая карточка кабинета (ds-card) + styles/product-landing.css.

export function AuthorSection() {
  return (
    <section id="author" className="pl2-sec pl2-sec--tight">
      <div className="pl2-wrap ds-card pl2-author">
        <img
          className="pl2-author-photo"
          src="/gregory.jpg"
          alt="Григорий Котляревский"
          loading="lazy"
          decoding="async"
          width={300}
          height={360}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div>
          <span className="pl2-eyebrow">Кто это делает</span>
          <h2 className="pl2-h2">Григорий Котляревский</h2>
          <p className="pl2-author-role">
            Работаю в подходе схема-терапия · частная практика онлайн
          </p>
          <p className="pl2-author-text">
            Я работаю в подходе схема-терапия и сделал «Всё по схеме»
            бесплатным — чтобы у метода был доступный инструмент самонаблюдения.
            Приложение выросло из моей практики: это те же дневники и упражнения,
            которые помогают клиентам между сессиями. А если захочется разбирать
            свои схемы не в одиночку — приходите знакомиться.
          </p>
          <Cta href={AUTHOR_SITE} size="lg" onClick={() => trackPracticeClick('author')}>
            Познакомиться: сайт практики ↗
          </Cta>
          <p className="pl2-fine">
            Первая встреча — 15 минут, бесплатно
          </p>
        </div>
      </div>
    </section>
  );
}
