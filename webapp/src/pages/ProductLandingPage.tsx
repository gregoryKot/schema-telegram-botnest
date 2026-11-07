import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useRecentArticles } from '../components/landing-kit-hooks';
// Логотип и кнопка — общие модули бренда (используются и в /tests).
import { Logo, Cta } from './landing/BrandKit';
import { STEPS, FEATURES, TRUST, NAV_LINKS } from './landing/productContent';
import { InfoCard, ArticleCard, FaqList } from './landing/ProductKit';
import { Rich } from './landing/Rich';
import { HOME_HERO, HOME_HEADINGS, HOME_FINAL } from '../../../src/articles/home-landing.content';
import { AuthorSection } from './landing/AuthorSection';
import { AppInstallSection } from './landing/AppInstallSection';
import { AppPreview } from './landing/AppPreview';
import { AUTHOR_SITE, trackPracticeClick } from './landing/practiceLink';
import { ProductMobileMenu } from './landing/ProductMobileMenu';
import { entryCta } from './landing/entryCta';
import '../styles/product-landing.css';

// Продуктовый лендинг «Всё по схеме» — главная app-домена (schemehappens.ru).
// Тот же язык «бумажной аппликации», что у кабинета (docs/design/PAPER_2026-11.md):
// бумага, заголовки Literata, кнопки ds-btn, знаки PaperArt, цвета — токены.
// Вид — styles/product-landing.css; корень на .light-lock, как кабинет.

// ─── Страница ─────────────────────────────────────────────────────────────────
// Текст — src/articles/home-landing.content.ts (его же сервер вкладывает в #root
// для робота без JS), вид — landing/productContent.ts, карточки — ProductKit.tsx.
export function ProductLandingPage() {
  const { isAuthenticated } = useAuth();
  const articles = useRecentArticles(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const entry = entryCta(isAuthenticated);

  useEffect(() => { document.title = 'Всё по схеме — инструмент схема-терапии'; }, []);

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
          {/* Бургер — виден только ≤640px, .pl2-nav скрыт там же (В4, аудит 2026-08) */}
          <button className="pl2-burger" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      {menuOpen && <ProductMobileMenu entry={entry} onClose={() => setMenuOpen(false)} />}

      {/* ── Hero ── */}
      <section className="pl2-hero-sec">
        <div className="pl2-wrap pl2-hero">
          <div className="pl2-in">
            <div className="pl2-pill">
              <span className="pl2-pill-dot" />
              Схема-терапия · бесплатно · без рекламы
            </div>
            <h1 className="pl2-h1">
              {HOME_HERO.title.before}<em>{HOME_HERO.title.accent}</em>{HOME_HERO.title.after}
            </h1>
            <p className="pl2-lead">{HOME_HERO.lead}</p>
            <div className="pl2-actions">
              <Cta href={entry.href} size="lg">{entry.main}</Cta>
              <Cta href="/tests" variant="ghost" size="lg">Мини-тесты без регистрации</Cta>
            </div>
            {!isAuthenticated && <p className="pl2-fine">Вход через Google, ВКонтакте, Telegram или email · регистрация не нужна</p>}
          </div>
          <div className="pl2-in pl2-in--late"><AppPreview /></div>
        </div>
      </section>

      {/* ── Как это работает ── */}
      <section id="how" className="pl2-sec">
        <div className="pl2-wrap">
          <span className="pl2-eyebrow">Как это работает</span>
          <h2 className="pl2-h2">{HOME_HEADINGS.how}</h2>
          <div className="pl2-3 pl2-3--wide">
            {STEPS.map(({ num, Art, title, text }) => (
              <div key={num} className="pl2-step">
                <div className="pl2-step-head">
                  <span className="pl2-step-num">{num}</span>
                  <Art size="square" />
                </div>
                <p className="pl2-card-title">{title}</p>
                <p className="pl2-card-text">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Возможности ── */}
      <section id="features" className="pl2-sec">
        <div className="pl2-wrap">
          <span className="pl2-eyebrow">Возможности</span>
          <h2 className="pl2-h2">{HOME_HEADINGS.features}</h2>
          <div className="pl2-3">
            {FEATURES.map((f) => <InfoCard key={f.id} Art={f.Art} title={f.title}>{f.text}</InfoCard>)}
          </div>
        </div>
      </section>

      {/* ── Значок на экран (PWA) ── */}
      <AppInstallSection />

      {/* ── Доверие ── */}
      <section className="pl2-sec pl2-sec--tight">
        <div className="pl2-wrap pl2-3">
          {TRUST.map((t) => <InfoCard key={t.id} Art={t.Art} hue={t.hue} title={t.title}><Rich parts={t.text} /></InfoCard>)}
        </div>
      </section>

      {/* ── Кто это делает ── */}
      <AuthorSection />

      {/* ── Статьи ── */}
      {articles && articles.length > 0 && (
        <section id="articles" className="pl2-sec">
          <div className="pl2-wrap">
            <div className="pl2-head-row">
              <div>
                <span className="pl2-eyebrow">Статьи</span>
                <h2 className="pl2-h2 pl2-h2--flush">Разбираемся в схема-терапии — простым языком</h2>
              </div>
              <a href="/articles" className="pl2-link">Все статьи →</a>
            </div>
            <div className="pl2-3">
              {articles.map((a) => <ArticleCard key={a.slug} a={a} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section id="faq" className="pl2-sec">
        <div className="pl2-wrap" style={{ maxWidth: 760 }}>
          <span className="pl2-eyebrow">Вопросы</span>
          <h2 className="pl2-h2">{HOME_HEADINGS.faq}</h2>
          <FaqList />
        </div>
      </section>

      {/* ── Финальный CTA ── */}
      <section className="pl2-sec pl2-sec--tight">
        <div className="pl2-wrap ds-card ds-card--panel pl2-final">
          <h2 className="pl2-final-title">{HOME_FINAL.title}</h2>
          <p className="pl2-final-text">{HOME_FINAL.text}</p>
          <Cta href={entry.href} size="lg">{entry.main}</Cta>
        </div>
      </section>

      {/* ── Футер ── */}
      <footer className="pl2-footer">
        <div className="pl2-wrap pl2-footer-in">
          <div className="pl2-actions">
            <Logo />
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
