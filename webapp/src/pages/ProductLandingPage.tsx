import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useRecentArticles } from '../components/landing-kit-hooks';
// Логотип и кнопка — общие модули бренда (используются и в /tests).
import { Logo, Cta } from './landing/BrandKit';
import { TRUST, NAV_LINKS } from './landing/productContent';
import { InfoCard, FaqList } from './landing/ProductKit';
import { ArticleCard } from './landing/ArticleCard';
import { Rich } from './landing/Rich';
import { HOME_HEADINGS, HOME_FINAL } from '../../../src/articles/home-landing.content';
import { ProductHero } from './landing/ProductHero';
import { HowSection } from './landing/HowSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { AuthorSection } from './landing/AuthorSection';
import { GameTeaser } from './landing/GameTeaser';
import { useGameArrival } from './landing/useGameArrival';
import { AppInstallSection } from './landing/AppInstallSection';
import { AUTHOR_SITE, trackPracticeClick } from './landing/practiceLink';
import { ProductMobileMenu } from './landing/ProductMobileMenu';
import { entryCta } from './landing/entryCta';
import { FinalCorners, SignScene } from '../components/art/SceneParts';
import { Pebbles } from '../components/art/PaperArt';
import { glue } from '../../../shared/src/utils/typo';
import { PaperBand } from './landing/PaperBand';
import '../styles/product-landing.css';

// Продуктовый лендинг «Всё по схеме» (schemehappens.ru), язык «бумажной аппликации» кабинета
// (docs/design/PAPER_2026-11.md). Вид — styles/product-landing*.css, корень на .light-lock. Текст —
// src/articles/home-landing.content.ts (он же в #root для робота без JS), вид — productContent.ts.
export function ProductLandingPage() {
  const { isAuthenticated } = useAuth();
  const articles = useRecentArticles(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const entry = entryCta(isAuthenticated);

  useEffect(() => { document.title = 'Всё по схеме — инструмент схема-терапии'; }, []);
  useGameArrival();

  return (
    <div className="light-lock pl2-root">
      {/* ── Навбар ── */}
      <header className="pl2-header">
        <a href="/" className="pl2-brand"><Logo /></a>
        <nav className="pl2-nav">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={href} href={href} className="pl2-navlink">{label}</a>
          ))}
        </nav>
        <div className="pl2-actions">
          <div className="pl2-nav">
            <Cta href={entry.href}>{entry.nav}</Cta>
          </div>
          {/* Бургер — виден ≤960px, .pl2-nav скрыт там же: на 641–960 «Войти» уезжал за край */}
          <button className="pl2-burger" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      {menuOpen && <ProductMobileMenu entry={entry} onClose={() => setMenuOpen(false)} />}

      <ProductHero entry={entry} isAuthenticated={isAuthenticated} />
      <HowSection />
      <FeaturesSection />

      <AppInstallSection />{/* значок на экран (PWA) */}

      {/* ── Доверие: три плитки цветной бумаги со знаками кабинета ── */}
      <section className="pl2-sec">
        <div className="pl2-wrap pl2-trust">
          {TRUST.map((t) => <InfoCard key={t.id} Art={t.Art} hue={t.hue} title={t.title}><Rich parts={t.text} /></InfoCard>)}
        </div>
      </section>

      <AuthorSection />{/* кто это делает */}
      <GameTeaser />

      {/* ── Статьи ── */}
      {articles && articles.length > 0 && (
        <section id="articles" className="pl2-sec pl2-sec--tight">
          <div className="pl2-wrap">
            <div className="pl2-head-row">
              <div>
                <span className="pl2-eyebrow">Статьи</span>
                <h2 className="pl2-h2 pl2-h2--flush">Разбираемся в&nbsp;<span className="pl2-nowrap">схема-терапии</span>&nbsp;— простым языком</h2>
              </div>
              <a href="/articles" className="pl2-link pl2-link--solo">Все статьи →</a>
            </div>
            <div className="pl2-3">
              {articles.map((a, i) => <ArticleCard key={a.slug} a={a} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ: полоса шалфея, слева камешки Pebbles (мысли, разложенные по местам) на квадрате персика ── */}
      <PaperBand id="faq">
        <div className="pl2-wrap pl2-faq-wrap">
          <div className="pl2-faq-side">
            <span className="pl2-eyebrow">Вопросы</span>
            <h2 className="pl2-h2">{HOME_HEADINGS.faq}</h2>
            <div className="pl2-faq-art"><SignScene Art={Pebbles} /></div>
          </div>
          <FaqList />
        </div>
      </PaperBand>

      {/* ── Финальный призыв: тёплый лист бумаги, знаки по углам, одна залитая кнопка ── */}
      <section className="pl2-sec">
        <div className="pl2-wrap pl2-final">
          <FinalCorners />
          <h2 className="pl2-final-title">{glue(HOME_FINAL.title)}</h2>
          <p className="pl2-final-text">{glue(HOME_FINAL.text)}</p>
          <Cta href={entry.href} size="lg">{entry.main}</Cta>
        </div>
      </section>

      {/* ── Футер ── */}
      <footer className="pl2-footer">
        <div className="pl2-wrap pl2-footer-in">
          <div className="pl2-actions">
            <a href="/" className="pl2-brand" aria-label="На главную" title="На главную"><Logo /></a>
            <span className="pl2-copy">© {new Date().getFullYear()}</span>
          </div>
          <nav className="pl2-footer-nav">
            {[['Политика конфиденциальности', '/privacy'], ['Оферта', '/offer'], ['Поддержать', '/donate'], ['Григорий Котляревский — автор проекта ↗', AUTHOR_SITE]].map(([label, href]) => (
              <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                onClick={href === AUTHOR_SITE ? () => trackPracticeClick('footer') : undefined}
                className="pl2-footer-link">{label}</a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
