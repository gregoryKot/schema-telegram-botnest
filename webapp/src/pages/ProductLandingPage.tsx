import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecentArticles } from '../components/landing-kit-hooks';
import { botUrl, botHandle } from '../utils/botConfig';
// Палитра, логотип и CTA — в общих модулях бренда (используются и в /tests).
import { INK, SUB, FAINT, GLASS, GLASS_BORDER, VIOLET, PINK, CYAN, AURORA, glow } from './landing/aurora';
import { Logo, Cta } from './landing/BrandKit';
import { STEPS, FEATURES, TRUST, H2, EYEBROW, NAV_LINKS } from './landing/productContent';
import { GlassCard, ArticleCard, FaqList } from './landing/ProductKit';
import { AuthorSection } from './landing/AuthorSection';
import { AppInstallSection } from './landing/AppInstallSection';
import { AppPreview } from './landing/AppPreview';
import { AUTHOR_SITE, trackPracticeClick } from './landing/practiceLink';
import { ProductMobileMenu } from './landing/ProductMobileMenu';

// Продуктовый лендинг «Всё по схеме» — главная app-домена (schemehappens.ru).
// САМОСТОЯТЕЛЬНАЯ айдентика: тёмный «ночной» холст + аврора-градиенты, глассморфизм,
// крупная жирная типографика. Намеренно НЕ похоже на тёплую serif-страничку терапевта.
// Палитра захардкожена (не зависит от app-темы) — это отдельный маркетинговый бренд.

const BOT_URL = botUrl;


// ─── Страница ─────────────────────────────────────────────────────────────────
// Данные (STEPS/FEATURES/TRUST/FAQ, H2/EYEBROW) — в landing/productContent.tsx,
// карточки (GlassCard/ArticleCard/FaqList) — в landing/ProductKit.tsx.
export function ProductLandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const articles = useRecentArticles(3);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/today', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => { document.title = 'Всё по схеме — инструмент схема-терапии'; }, []);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, overflowX: 'hidden', minHeight: '100dvh', background: '#0b0817', color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Аврора-фон (фиксированный) */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: glow(VIOLET, .22), filter: 'blur(120px)', top: '-18%', left: '-10%' }} />
        <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', background: glow(PINK, .16), filter: 'blur(120px)', top: '20%', right: '-14%' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: glow(CYAN, .12), filter: 'blur(130px)', bottom: '-10%', left: '20%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Навбар ── */}
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 24px', boxSizing: 'border-box', background: 'rgba(11,8,23,.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${GLASS_BORDER}` }}>
          <a href="/" style={{ textDecoration: 'none' }}><Logo /></a>
          <nav className="pl2-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {NAV_LINKS.map(({ label, href }) => (
              <a key={href} href={href} style={{ fontSize: 13.5, fontWeight: 600, color: SUB, textDecoration: 'none', padding: '7px 12px', borderRadius: 10, whiteSpace: 'nowrap', transition: 'color .15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = INK; }} onMouseLeave={(e) => { e.currentTarget.style.color = SUB; }}>{label}</a>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="pl2-nav">
              <Cta href="/login">Войти</Cta>
            </div>
            {/* Бургер — виден только ≤640px, .pl2-nav скрыт там же (В4, аудит 2026-08) */}
            <button
              className="pl2-burger" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}
              style={{ display: 'none', flexDirection: 'column', justifyContent: 'center', gap: 4, alignItems: 'center', width: 44, height: 44, borderRadius: 10, border: `1px solid ${GLASS_BORDER}`, background: 'rgba(255,255,255,.05)', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ width: 17, height: 1.6, background: INK, borderRadius: 2, display: 'block' }} />
              <span style={{ width: 17, height: 1.6, background: INK, borderRadius: 2, display: 'block' }} />
              <span style={{ width: 17, height: 1.6, background: INK, borderRadius: 2, display: 'block' }} />
            </button>
          </div>
        </header>

        {menuOpen && <ProductMobileMenu onClose={() => setMenuOpen(false)} />}

        {/* ── Hero ── */}
        <section style={{ padding: '140px 24px 90px' }}>
          <div className="pl2-hero" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.06fr 1fr', gap: 56, alignItems: 'center' }}>
            <div style={{ animation: 'pl2-in .7s cubic-bezier(.16,1,.3,1) both' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'rgba(255,255,255,.05)', border: `1px solid ${GLASS_BORDER}`, fontSize: 12.5, fontWeight: 700, color: SUB, marginBottom: 26 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PINK, boxShadow: `0 0 10px ${PINK}`, animation: 'pl2-pulse 2.5s ease-in-out infinite' }} />
                Схема-терапия · бесплатно · без рекламы
              </div>
              <h1 style={{ fontFamily: 'inherit', fontSize: 'clamp(40px, 5.6vw, 68px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-.04em', margin: '0 0 22px', color: INK }}>
                Почему со мной <span style={{ background: AURORA, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>снова</span> это&nbsp;происходит?
              </h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: SUB, maxWidth: 490, margin: '0 0 34px' }}>
                Одни и те же ссоры, тревога, самокритика — не «характер», а&nbsp;схемы:
                выученные паттерны, которые можно заметить и постепенно менять.
                «Всё по схеме» — бесплатное приложение для самостоятельной работы в подходе схема-терапии.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <Cta href="/login" size="lg">Начать бесплатно →</Cta>
                <Cta href="/tests" variant="ghost" size="lg">🎲 Мини-тесты без регистрации</Cta>
              </div>
              <p style={{ fontSize: 12.5, color: FAINT, margin: '18px 0 0' }}>Вход через Google, ВКонтакте, Telegram или email · регистрация не нужна</p>
            </div>
            <div style={{ animation: 'pl2-in .7s cubic-bezier(.16,1,.3,1) .15s both' }}><AppPreview /></div>
          </div>
        </section>

        {/* ── Как это работает ── */}
        <section id="how" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <span style={EYEBROW}>Как это работает</span>
            <h2 style={{ ...H2, margin: '14px 0 48px', maxWidth: 700 }}>От «что со мной не так» к «какая схема включилась»</h2>
            <div className="pl2-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {STEPS.map((s) => (
                <div key={s.num} className="pl2-card" style={{ position: 'relative', background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 22, padding: '28px 24px', overflow: 'hidden', transition: 'transform .25s, border-color .25s, box-shadow .25s' }}>
                  <div aria-hidden style={{ position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: '50%', background: glow(s.color, .16), filter: 'blur(34px)' }} />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <span style={{ width: 48, height: 48, borderRadius: 14, fontSize: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: glow(s.color, .14), border: `1px solid ${glow(s.color, .3)}` }}>{s.emoji}</span>
                    <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', color: glow(s.color, .55) }}>{s.num}</span>
                  </div>
                  <p style={{ position: 'relative', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px', color: INK }}>{s.title}</p>
                  <p style={{ position: 'relative', fontSize: 14, lineHeight: 1.7, color: SUB, margin: 0 }}>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Возможности ── */}
        <section id="features" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <span style={EYEBROW}>Возможности</span>
            <h2 style={{ ...H2, margin: '14px 0 48px', maxWidth: 620 }}>Всё для работы между сессиями — или до них</h2>
            <div className="pl2-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {FEATURES.map((f) => <GlassCard key={f.title} emoji={f.emoji} color={f.color} title={f.title} big>{f.text}</GlassCard>)}
            </div>
          </div>
        </section>

        {/* ── Telegram ── */}
        <section style={{ padding: '20px 24px 72px' }}>
          <div className="pl2-tg" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center', background: 'linear-gradient(120deg, rgba(167,139,250,.12), rgba(56,224,208,.08))', border: `1px solid ${GLASS_BORDER}`, borderRadius: 28, padding: '48px 44px' }}>
            <div>
              <span style={EYEBROW}>Telegram</span>
              <h2 style={{ ...H2, margin: '14px 0 18px' }}>Живёт и в&nbsp;Telegram</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: SUB, maxWidth: 470, margin: '0 0 26px' }}>
                Бот <strong style={{ color: INK }}>{botHandle}</strong> раз в месяц мягко напомнит заглянуть на чек-ин,
                а мини-приложение открывается прямо в чате — тот же дневник, те же схемы.
                Данные общие с сайтом: начните в телефоне, продолжите в браузере.
              </p>
              <Cta href={BOT_URL} size="lg">Открыть в Telegram ↗</Cta>
            </div>
            <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, width: '100%', justifySelf: 'center' }}>
              <div style={{ padding: '14px 16px', borderRadius: '16px 16px 16px 6px', background: 'rgba(255,255,255,.05)', border: `1px solid ${GLASS_BORDER}`, backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: AURORA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🧠</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Всё по схеме</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: SUB, margin: 0 }}>🌤️ Как ты в этом месяце? Пара минут на чек-ин помогут увидеть динамику.</p>
                <div style={{ marginTop: 12, padding: '9px 14px', borderRadius: 10, background: AURORA, color: '#1a0f2e', fontSize: 13, fontWeight: 800, textAlign: 'center' }}>Открыть чек-ин</div>
              </div>
              <span style={{ fontSize: 11.5, color: FAINT, alignSelf: 'center' }}>мини-приложение открывается прямо в чате</span>
            </div>
          </div>
        </section>

        {/* ── Значок на экран (PWA) ── */}
        <AppInstallSection />

        {/* ── Доверие ── */}
        <section style={{ padding: '20px 24px 72px' }}>
          <div className="pl2-3" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {TRUST.map((t) => <GlassCard key={t.title} emoji={t.icon} color={t.color} title={t.title}>{t.node}</GlassCard>)}
          </div>
        </section>

        {/* ── Кто это делает ── */}
        <AuthorSection />

        {/* ── Статьи ── */}
        {articles && articles.length > 0 && (
          <section id="articles" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
            <div style={{ maxWidth: 1160, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 44 }}>
                <div>
                  <span style={EYEBROW}>Статьи</span>
                  <h2 style={{ ...H2, margin: '14px 0 0', maxWidth: 620 }}>Разбираемся в схема-терапии — простым языком</h2>
                </div>
                <a href="/articles" style={{ fontSize: 14, fontWeight: 700, color: VIOLET, textDecoration: 'none', whiteSpace: 'nowrap' }}>Все статьи →</a>
              </div>
              <div className="pl2-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                {articles.map((a) => <ArticleCard key={a.slug} a={a} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        <section id="faq" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <span style={EYEBROW}>Вопросы</span>
            <h2 style={{ ...H2, margin: '14px 0 36px' }}>Частые вопросы</h2>
            <FaqList />
          </div>
        </section>

        {/* ── Финальный CTA ── */}
        <section style={{ padding: '24px 24px 96px' }}>
          <div style={{ position: 'relative', overflow: 'hidden', maxWidth: 1160, margin: '0 auto', background: AURORA, borderRadius: 32, padding: '76px 32px', textAlign: 'center' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,.25), transparent 60%)' }} />
            <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'inherit', fontSize: 'clamp(32px, 4.6vw, 52px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.06, margin: '0 0 18px', color: '#1a0f2e' }}>Первый шаг — просто заметить</h2>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(26,15,46,.78)', margin: '0 0 34px', fontWeight: 500 }}>Минутный чек-ин в день — и через пару недель паттерны станут видимыми. Бесплатно, бережно, в вашем темпе.</p>
              <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 34px', background: '#12091f', color: INK, borderRadius: 14, fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 12px 34px rgba(0,0,0,.3)' }}>Начать бесплатно →</a>
            </div>
          </div>
        </section>

        {/* ── Футер ── */}
        <footer style={{ borderTop: `1px solid ${GLASS_BORDER}`, padding: '32px 24px' }}>
          <div className="pl2-footer" style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Logo size={26} />
              <span style={{ fontSize: 12.5, color: FAINT }}>© {new Date().getFullYear()}</span>
            </div>
            <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[['Политика конфиденциальности', '/privacy'], ['Оферта', '/offer'], ['Поддержать 💛', '/donate'], ['Григорий Котляревский — автор, схема-терапевт ↗', AUTHOR_SITE]].map(([label, href]) => (
                <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  onClick={href === AUTHOR_SITE ? () => trackPracticeClick('footer') : undefined}
                  style={{ fontSize: 13, color: SUB, textDecoration: 'none', transition: 'color .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = INK; }} onMouseLeave={(e) => { e.currentTarget.style.color = SUB; }}>{label}</a>
              ))}
            </nav>
          </div>
        </footer>
      </div>

      {/* ── Стили ── */}
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes pl2-in    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes pl2-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pl2-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.6); } }
        .pl2-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,.22); box-shadow: 0 18px 50px rgba(0,0,0,.4); }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
        }
        @media (max-width: 900px) {
          .pl2-hero { grid-template-columns: 1fr !important; gap: 48px !important; }
          .pl2-3 { grid-template-columns: 1fr !important; }
          .pl2-tg { grid-template-columns: 1fr !important; gap: 36px !important; padding: 36px 28px !important; }
          .pl2-author { grid-template-columns: 1fr !important; gap: 32px !important; padding: 36px 28px !important; }
          .pl2-chip { display: none; }
        }
        @media (min-width: 601px) and (max-width: 900px) { .pl2-3 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 640px) { .pl2-nav { display: none !important; } .pl2-burger { display: flex !important; } }
      `}</style>
    </div>
  );
}
