import { Cta } from './BrandKit';
import { SignScene } from '../../components/art/SceneParts';
import { Talk } from '../../components/art/PaperArtSigns';
import { AUTHOR_SITE, trackPracticeClick } from './practiceLink';
import '../../styles/product-landing.css';
import '../../styles/product-landing-author.css';

// Блок «Кто это делает»: автор проекта работает в подходе схема-терапия, частная практика.
// Клик по CTA — продуктовое событие practice_link_click (place: 'author'),
// видно в /stats. Композиция своя, не копия Telegram-ленты (jscpd).
// Вид — плитка персиковой бумаги; фото — наклеенная фотокарточка в белой рамке, в углу
// наклейка со знаком Talk (разговор с человеком) — styles/product-landing-author.css.
export function AuthorSection() {
  return (
    <section id="author" className="pl2-sec pl2-sec--tight">
      <div className="pl2-wrap pp-paper pl2-author">
        <div className="pl2-author-frame">
          <img className="pl2-author-photo" src="/gregory.jpg" alt="Григорий Котляревский" loading="lazy" decoding="async"
            width={300} height={360} onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
          <span className="pl2-author-sticker"><SignScene Art={Talk} /></span>
        </div>
        <div>
          <span className="pl2-eyebrow">Кто это делает</span>
          <h2 className="pl2-h2">Григорий Котляревский</h2>
          <p className="pl2-author-role">
            Работаю в подходе схема-терапия · частная практика&nbsp;онлайн
          </p>
          <p className="pl2-author-text">
            Я работаю в подходе <span className="pl2-nowrap">схема-терапия</span> и сделал «Всё по&nbsp;схеме»
            бесплатным&nbsp;— чтобы у метода был доступный инструмент самонаблюдения.
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
