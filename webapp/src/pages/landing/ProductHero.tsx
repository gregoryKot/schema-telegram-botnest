import { Cta } from './BrandKit';
import { AppPreview } from './AppPreview';
import type { entryCta } from './entryCta';
import { HeroCollage } from '../../components/art/HeroCollage';
import { HOME_HERO } from '../../../../src/articles/home-landing.content';
import { glue } from './typo';
import '../../styles/product-landing.css';
import '../../styles/product-landing-hero.css';

// Первый экран продуктового лендинга: заголовок-вопрос, абзац, одна залитая кнопка
// и тихая вторая; справа мокап «Сегодня» на бумажном коллаже (HeroCollage: лента-петля
// за телефоном — то самое «снова»). Под словом «снова» — завиток той же ленты.
// Вид — styles/product-landing-hero.css (.pl2-hero*, мокап .pl2-phone).
export function ProductHero({ entry, isAuthenticated }: { entry: ReturnType<typeof entryCta>; isAuthenticated: boolean }) {
  const t = HOME_HERO.title;
  return (
    <section className="pl2-hero-sec">
      <div className="pl2-wrap pl2-hero">
        <div className="pl2-in">
          <div className="pl2-pill">
            <span className="pl2-pill-dot" />
            Схема-терапия · бесплатно · без&nbsp;рекламы
          </div>
          <h1 className="pl2-h1">
            {t.before}
            <em className="pl2-h1-loop">
              {t.accent}
              <svg className="pl2-h1-swirl" viewBox="0 0 200 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M4 10 C40 20 84 20 118 12 C136 8 146 2 140 2 C132 2 128 14 146 16 C164 18 182 12 196 6" />
              </svg>
            </em>
            {t.after}
          </h1>
          <p className="pl2-lead">{glue(HOME_HERO.lead)}</p>
          <div className="pl2-actions">
            <Cta href={entry.href} size="lg">{entry.main}</Cta>
            <Cta href="/tests" variant="ghost" size="lg">Мини-тесты без регистрации</Cta>
          </div>
          {!isAuthenticated && <p className="pl2-fine">Вход через Google, ВКонтакте, Telegram или email · регистрация не нужна</p>}
        </div>
        <div className="pl2-in pl2-in--late pl2-hero-art">
          <HeroCollage />
          <AppPreview />
        </div>
      </div>
    </section>
  );
}
