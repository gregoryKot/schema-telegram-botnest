import type { CSSProperties } from 'react';
import { Cta } from './BrandKit';
import { AuthorPhoto } from '../../components/AuthorAvatar';
import { AUTHOR_SITE, trackPracticeClick } from './practiceLink';
import { AUTHOR_HUE } from './productContent';
import { glue } from './typo';
import '../../styles/product-landing.css';
import '../../styles/product-landing-author.css';

// Блок «Кто это делает»: автор проекта работает в подходе схема-терапия, частная практика.
// Клик по CTA — продуктовое событие practice_link_click (place: 'author'),
// видно в /stats. Композиция своя, не копия Telegram-ленты (jscpd).
// Вид — плитка бумаги AUTHOR_HUE; фото — общая фотокарточка автора с наклейкой Talk
// (AuthorPhoto, components/AuthorAvatar.tsx; её же берут листы «Поговорить» без терапевта).
// Неразрывные пробелы и дефис — glue (typo.ts), слова не меняются.
export function AuthorSection() {
  return (
    <section id="author" className="pl2-sec pl2-sec--tight">
      <div className="pl2-wrap pp-paper pl2-author" style={{ '--h': AUTHOR_HUE } as CSSProperties}>
        <AuthorPhoto className="pl2-author-frame" />
        <div>
          <span className="pl2-eyebrow">Кто это делает</span>
          <h2 className="pl2-h2">Григорий Котляревский</h2>
          <p className="pl2-author-role">{glue('Работаю в подходе схема-терапия · частная практика\u00a0онлайн')}</p>
          <p className="pl2-author-text">
            {glue('Я работаю в подходе схема-терапия и сделал «Всё по схеме» бесплатным — чтобы у метода был '
              + 'доступный инструмент самонаблюдения. Приложение выросло из моей практики: это те же дневники и '
              + 'упражнения, которые помогают клиентам между сессиями. А если захочется разбирать свои схемы '
              + 'не в одиночку — приходите знакомиться.')}
          </p>
          <Cta href={AUTHOR_SITE} size="lg" onClick={() => trackPracticeClick('author')}>
            Познакомиться: сайт практики ↗
          </Cta>
          <p className="pl2-fine">{glue('Первая встреча — 15 минут, бесплатно')}</p>
        </div>
      </div>
    </section>
  );
}
