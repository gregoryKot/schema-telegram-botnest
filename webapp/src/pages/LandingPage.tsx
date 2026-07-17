import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';
import { BookingPicker } from '../components/BookingPicker';
import { DARK_BG, INK_ON_DARK, Btn, ThemeIcon, useReveal, useTheme } from '../components/landing-kit';
import { botUrl } from '../utils/botConfig';
import {
  TG_URL, menuBtnStyle, burgerLine,
  TOPICS_A, TOPICS_B, EDUCATION, WORK_THEMES, BOUNDARIES, TRUST, APP_FEATURES,
} from './landing/data';
import {
  TgLink, SectionNav, MobileMenu, MarqueeStrip, BookingForm, AppFeatureCard, BentoCard, FaqList,
} from './landing/components';
import { LandingStyles } from './landing/LandingStyles';

// ─── Main page ────────────────────────────────────────────────────────────────
export function LandingPage() {
  const bookingRef          = useRef<HTMLElement>(null);
  const activeSectionRef    = useRef('');
  const scrollspyReadyRef   = useRef(false);
  const [showBar, setShowBar] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [activeSection, setActiveSection] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  // Live session price (editable in admin) — keep the landing in sync with checkout.
  const [sessionPrice, setSessionPrice] = useState(4000);
  useEffect(() => {
    api.getBookingOptions()
      .then((o) => { const s = o.find((x) => x.type === 'SESSION_50'); if (s) setSessionPrice(s.price); })
      .catch(() => {});
  }, []);
  const priceStr = sessionPrice.toLocaleString('ru-RU');
  // Hero photo + marquee topics (editable in admin) — hardcoded defaults keep
  // the site looking the same until the therapist actually edits them.
  const [siteContent, setSiteContent] = useState<{ heroPhoto: string | null; marqueeTopicsA: typeof TOPICS_A; marqueeTopicsB: typeof TOPICS_B }>({
    heroPhoto: null, marqueeTopicsA: TOPICS_A, marqueeTopicsB: TOPICS_B,
  });
  useEffect(() => { api.getSiteContent().then(setSiteContent).catch(() => {}); }, []);
  const { theme, toggle: toggleTheme } = useTheme();

  const aboutRef    = useReveal() as React.RefObject<HTMLElement>;
  const workRef     = useReveal() as React.RefObject<HTMLElement>;
  const quoteRef    = useReveal() as React.RefObject<HTMLElement>;
  const trustRef    = useReveal() as React.RefObject<HTMLElement>;
  const approachRef = useReveal() as React.RefObject<HTMLElement>;
  const processRef  = useReveal() as React.RefObject<HTMLElement>;
  const priceRef    = useReveal() as React.RefObject<HTMLElement>;
  const boundRef    = useReveal() as React.RefObject<HTMLElement>;
  const formRef     = useReveal() as React.RefObject<HTMLElement>;

  const scrollToBooking = useCallback(() => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const ids = ['about', 'work', 'education', 'approach', 'process', 'prices', 'booking', 'app', 'faq'];
    let ticking = false;
    let firstRun = true;
    const fn = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setShowBar(y > window.innerHeight * 0.75);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrollPct(max > 0 ? (y / max) * 100 : 0);
        if (!firstRun) {
          // Scrollspy: last section whose top has crossed 35% of viewport.
          const line = window.innerHeight * 0.35;
          let current = '';
          for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top <= line) current = id;
          }
          if (current !== activeSectionRef.current) {
            activeSectionRef.current = current;
            scrollspyReadyRef.current = true;
            setActiveSection(current);
          }
        }
        firstRun = false;
        ticking = false;
      });
    };
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Mirror active section into the address bar without creating history entries.
  // Guard prevents clearing any initial hash before the user has actually scrolled.
  useEffect(() => {
    if (!scrollspyReadyRef.current) return;
    const hash = activeSection ? `#${activeSection}` : '';
    window.history.replaceState(window.history.state, '', window.location.pathname + hash);
  }, [activeSection]);

  // On first load with a hash (e.g. shared /#prices) jump to that block
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }), 0);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>

      {/* ── MOBILE MENU ─────────────────────────────────────────────────── */}
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} active={activeSection} onBook={scrollToBooking} />}

      {/* ── SCROLL PROGRESS ─────────────────────────────────────────────── */}
      <div aria-hidden style={{ position: 'fixed', top: 0, left: 0, zIndex: 102, height: 2, width: `${scrollPct}%`, background: 'var(--accent)', pointerEvents: 'none', transition: 'width .1s linear' }} />

      {/* ── GRAIN OVERLAY ───────────────────────────────────────────────── */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.028,
      }} />

      {/* ── STICKY BAR ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px',
        background: 'var(--nav-bg)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--line)',
        transform: showBar ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform .4s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ position: 'absolute', fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--text-sub)' }}>Г</span>
            <img src={siteContent.heroPhoto ?? "/gregory.jpg"} alt="Григорий Котляревский" decoding="async" width={34} height={34} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <span style={{ fontSize: 15, fontFamily: 'var(--serif)', color: 'var(--text)', whiteSpace: 'nowrap' }}>Григорий Котляревский</span>
        </div>
        <SectionNav className="sticky-nav" active={activeSection} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="https://schemehappens.ru" className="desktop-inline" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Войти</a>
          <Btn size="sm" onClick={scrollToBooking}>Записаться</Btn>
          <button className="menu-btn" aria-label="Открыть меню" onClick={() => setMenuOpen(true)} style={menuBtnStyle}>
            <span style={burgerLine} /><span style={burgerLine} /><span style={burgerLine} />
          </button>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* Soft ambient light – top-right */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', width: 900, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(77,71,153,.08) 0%, transparent 65%)', top: '-10%', right: '-15%' }} />
          <div style={{ position: 'absolute', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(176,111,74,.07) 0%, transparent 65%)', bottom: '10%', left: '-5%' }} />
        </div>

        <div className="hero-wrap" style={{ position: 'relative', zIndex: 1 }}>

          {/* ── Nav ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '26px 0', animation: 'hero-in .5s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {/* Имя + фото → Обо мне */}
              <a href="#about" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}
                onMouseEnter={e => { const n = e.currentTarget.querySelector('.nav-name') as HTMLElement | null; if (n) n.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { const n = e.currentTarget.querySelector('.nav-name') as HTMLElement | null; if (n) n.style.color = 'var(--text)'; }}>
                <div style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--text-sub)' }}>Г</span>
                  <img src={siteContent.heroPhoto ?? "/gregory.jpg"} alt="Григорий Котляревский" decoding="async" width={34} height={34} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <span className="nav-name" style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--text)', whiteSpace: 'nowrap', transition: 'color .15s' }}>Григорий Котляревский</span>
              </a>
            </div>
            <SectionNav className="hero-nav" active={activeSection} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
              <button
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)', transition: 'border-color .15s, color .15s', padding: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-sub)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}
              >
                <ThemeIcon dark={theme === 'dark'} />
              </button>
              <a href={TG_URL} target="_blank" rel="noopener noreferrer"
                className="nav-tg"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none', transition: 'color .15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}>
                Написать ↗
              </a>
              <button className="menu-btn" aria-label="Открыть меню" onClick={() => setMenuOpen(true)} style={menuBtnStyle}>
                <span style={burgerLine} /><span style={burgerLine} /><span style={burgerLine} />
              </button>
            </div>
          </div>

          {/* ── Eyebrow ── */}
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', margin: '20px 0 20px', animation: 'hero-in .6s .15s both' }}>
            Схема-терапевт · Онлайн
          </p>

          {/* ── Full-width headline – the centrepiece ── */}
          <h1 className="hero-h1" style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(44px, 9vw, 120px)',
            fontWeight: 400, lineHeight: 1.0, letterSpacing: '-.025em',
            color: 'var(--text)', margin: 0,
          }}>
            <span style={{ display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', animation: 'line-in .75s .2s both' }}>Работа с тем,</span>
            </span>
            <span style={{ display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', animation: 'line-in .75s .38s both', fontStyle: 'italic', color: 'var(--accent)' }}>что мешает</span>
            </span>
            <span style={{ display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', animation: 'line-in .75s .56s both' }}>жить</span>
            </span>
          </h1>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: 'var(--line-strong)', margin: '36px 0', animation: 'hero-in .5s .7s both' }} />

          {/* ── Below divider: single editorial column, generous whitespace ── */}
          <div style={{ maxWidth: 460, animation: 'hero-in .7s .8s both' }}>
            <p style={{ fontSize: 17, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 28px' }}>
              Мы снова и снова попадаем в одни и те же ситуации – в отношениях, самооценке, тревоге. Схема-терапия помогает понять почему – и найти выход.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
              <Btn size="lg" onClick={scrollToBooking}>Записаться на знакомство →</Btn>
              <TgLink label="Написать в Telegram" size="lg" />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '18px 0 0' }}>
              Первая встреча бесплатно · 15 минут · без обязательств
            </p>
          </div>

          {/* ── Subtle scroll cue ── */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0 28px', animation: 'hero-in .5s 1.1s both' }}>
            <div style={{ width: 1, height: 28, background: 'var(--line-strong)', animation: 'scroll-bar 2s ease-in-out infinite' }} />
          </div>

        </div>
      </section>

      {/* ── MARQUEE #1 ───────────────────────────────────────────────────── */}
      <MarqueeStrip topics={siteContent.marqueeTopicsA} />

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      <section id="about" ref={aboutRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 40px' }}>
        <div className="about-inner">
          <div style={{ position: 'relative' }}>
            <div style={{ aspectRatio: '3/4', borderRadius: 24, overflow: 'hidden', background: 'var(--surface-2)', boxShadow: '0 24px 80px rgba(28,25,20,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={siteContent.heroPhoto ?? "/gregory.jpg"} alt="Григорий Котляревский – схема-терапевт" loading="lazy" decoding="async" width={600} height={800} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                onError={e => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  const fb = img.parentElement;
                  if (fb && !fb.querySelector('.photo-fallback')) {
                    const d = document.createElement('div');
                    d.className = 'photo-fallback';
                    d.style.cssText = 'font-family:var(--serif);font-size:72px;color:var(--text-faint);font-weight:400;';
                    d.textContent = 'ГК';
                    fb.appendChild(d);
                  }
                }} />
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: -16, background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 18px', boxShadow: '0 8px 32px rgba(28,25,20,.12)' }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>50 мин</p>
              <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>онлайн · сессия</p>
            </div>
          </div>
          <div style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 18px' }}>Обо мне</p>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(34px, 3.8vw, 52px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text)', margin: '0 0 28px', letterSpacing: '-.01em' }}>
              Работаю с тем,<br /><span style={{ fontStyle: 'italic' }}>что важно для вас</span>
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 18px' }}>
              Я Григорий Котляревский – схема-терапевт. Ко мне приходят, когда привычные сценарии в отношениях, самооценке или тревоге повторяются годами, а справиться с ними в одиночку не выходит.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 18px' }}>
              Меня интересует не только «что» происходит с человеком, но и «почему» – какие ранние убеждения и режимы стоят за сегодняшними трудностями. Работаю онлайн.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 32px' }}>
              Веду практику под супервизией – мой супервизор подтвердил готовность к самостоятельной работе. Шестой год прохожу личную терапию: убеждён, что сопровождать другого можно, только зная этот путь изнутри.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Схема-терапия', 'КПТ', 'Онлайн'].map(tag => (
                <span key={tag} style={{ padding: '8px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 100, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WORK THEMES ─────────────────────────────────────────────────── */}
      <section id="work" ref={workRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>С чем я работаю</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-.01em' }}>
            Если узнаёте <span style={{ fontStyle: 'italic' }}>себя</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 44px', maxWidth: 560 }}>
            Эти темы чаще всего приносят на сессии. Не обязательно формулировать запрос идеально – достаточно ощущения «это про меня».
          </p>
          <div className="work-grid">
            {WORK_THEMES.map(t => (
              <div key={t.title} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 16, padding: '24px 22px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EDUCATION ───────────────────────────────────────────────────── */}
      <section id="education" ref={quoteRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 40px' }}>
        <div className="edu-grid" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Образование</p>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 18px', lineHeight: 1.2, letterSpacing: '-.01em' }}>
              Подготовка<br /><span style={{ fontStyle: 'italic' }}>и обучение</span>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0, maxWidth: 290 }}>
              Регулярно повышаю квалификацию – это методы, которые использую в работе с вами.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {EDUCATION.map((item, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr', gap: '0 20px',
                padding: '18px 0',
                borderTop: '1px solid var(--line)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', paddingTop: 3, whiteSpace: 'nowrap' }}>{item.year}</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
                    {item.placeUrl
                      ? <a href={item.placeUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid var(--accent-line)' }}>{item.place} ↗</a>
                      : item.place}
                    {' · '}{item.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ───────────────────────────────────────────────────────── */}
      <section ref={trustRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Этика и качество практики</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>
            Почему мне можно <span style={{ fontStyle: 'italic' }}>доверять</span>
          </h2>
          <div className="trust-grid">
            {TRUST.map((t, i) => (
              <div key={t.title} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 22, borderTop: '1px solid var(--line-strong)' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', color: 'var(--accent)', lineHeight: 1 }}>0{i + 1}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEE #2 (reverse) ────────────────────────────────────────── */}
      <MarqueeStrip reverse bg="var(--bg)" italic topics={siteContent.marqueeTopicsB} />

      {/* ── APPROACH BENTO ──────────────────────────────────────────────── */}
      <section id="approach" ref={approachRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: 'var(--bg-rail)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Подход</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>Как я работаю</h2>
          <div className="bento-grid">
            <div className="bento-tall"><BentoCard num="01" title={'Схема-\nтерапия'} text="Работаем с глубинными убеждениями и режимами, которые сформировались ещё в детстве – и тихо управляют сегодняшними выборами." accent /></div>
            <div className="bento-wide"><BentoCard num="02" title="Тёплый контакт" text="Наши отношения – не нейтральный экран, а инструмент изменений. Я присутствую в сессии целиком и использую этот контакт как часть терапии." /></div>
            <div><BentoCard num="03" title="Доказательная база" text="Схема-терапия – один из наиболее исследованных методов для работы с хроническими трудностями. Это подтверждено клиническими исследованиями." /></div>
            <div><BentoCard num="04" title="Долгосрочный результат" text="Цель – изменить не симптом, а то, как вы воспринимаете себя. Глубоко, но устойчиво." /></div>
          </div>
        </div>
      </section>

      {/* ── PROCESS ─────────────────────────────────────────────────────── */}
      <section id="process" ref={processRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: DARK_BG, padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(236,234,229,.4)', margin: '0 0 10px' }}>Как начать</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: INK_ON_DARK, margin: '0 0 56px', letterSpacing: '-.01em' }}>Три шага до первой встречи</h2>
          <div className="process-grid">
            {[
              { n: '01', title: 'Оставьте заявку', sub: 'Имя и контакт – этого достаточно. Можно добавить пару слов о запросе.' },
              { n: '02', title: 'Знакомство 15 минут', sub: 'Бесплатная встреча: расскажете о ситуации, я – о подходе. Без давления.' },
              { n: '03', title: 'Начинаем работу', sub: 'Если подходим друг другу – назначаем регулярные сессии и двигаемся вглубь.' },
            ].map((s, i) => (
              <div key={i} style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,.08)' : 'none', padding: '0 40px 0 ' + (i > 0 ? '40px' : '0') }}>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 6vw, 80px)', fontWeight: 400, color: 'rgba(144,137,224,.3)', lineHeight: 1, margin: '0 0 16px', letterSpacing: '-.03em' }}>{s.n}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: INK_ON_DARK, margin: '0 0 10px' }}>{s.title}</p>
                <p style={{ fontSize: 14, color: 'rgba(236,234,229,.5)', lineHeight: 1.7, margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEE #3 ───────────────────────────────────────────────────── */}
      <MarqueeStrip topics={siteContent.marqueeTopicsB} />

      {/* ── PRICES ──────────────────────────────────────────────────────── */}
      <section id="prices" ref={priceRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Формат и цены</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>Как устроена работа</h2>
        <div className="price-grid">
          {/* Free intro – PRIMARY */}
          <div style={{ background: 'var(--accent-soft)', border: '1.5px solid var(--accent-line)', borderRadius: 24, padding: '40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>Знакомство</span>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, color: 'var(--accent)', margin: '6px 0 0', letterSpacing: '-.03em', lineHeight: 1 }}>0 ₽</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['15 минут онлайн', 'Рассказываете о запросе', 'Я рассказываю о подходе', 'Никаких обязательств'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 15, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 15, color: 'var(--text-sub)' }}>{f}</span>
                </div>
              ))}
            </div>
            <Btn radius="btn" full onClick={scrollToBooking}>Записаться бесплатно →</Btn>
          </div>
          {/* Session – always dark card so light text stays legible in any theme */}
          <div style={{ background: '#1c1916', borderRadius: 24, padding: '40px', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.12)', padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>Основной</div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(236,234,229,.45)' }}>Сессия</span>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, color: INK_ON_DARK, margin: '6px 0 0', letterSpacing: '-.03em', lineHeight: 1 }}>{priceStr} ₽</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['50 минут онлайн (видео)', 'Индивидуальная работа', 'Схема-терапия и КПТ', 'Регулярные встречи'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: 'rgba(144,137,224,.9)', fontSize: 15, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 15, color: 'rgba(236,234,229,.7)' }}>{f}</span>
                </div>
              ))}
            </div>
            <Btn variant="dark" radius="btn" full onClick={scrollToBooking}>Начать работу →</Btn>
          </div>
        </div>
      </section>

      {/* ── BOUNDARIES ──────────────────────────────────────────────────── */}
      <section ref={boundRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 24, padding: 'clamp(28px, 4vw, 48px)', background: 'var(--bg-elev)' }}>
          <div className="bound-grid">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Границы помощи</p>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-.01em' }}>
                Когда нужен<br /><span style={{ fontStyle: 'italic' }}>другой специалист</span>
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>
                Это психологическое консультирование, а не медицинская психотерапия по ФЗ-323. Есть ситуации, где эффективнее и безопаснее другая помощь – и я сразу об этом скажу.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {BOUNDARIES.map(b => (
                <div key={b} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--c-clay)', fontSize: 15, flexShrink: 0, lineHeight: 1.6 }}>→</span>
                  <span style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>{b}</span>
                </div>
              ))}
              <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.7, margin: '8px 0 0', paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                Если на знакомстве станет ясно, что вам нужен врач, – помогу сориентироваться. Бесплатный телефон доверия в кризисной ситуации: <a href="tel:88002000122" style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>8 800 2000 122</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOOKING ─────────────────────────────────────────────────────── */}
      <section id="booking" ref={bookingRef} style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)' }}>
        <section ref={formRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 660, margin: '0 auto', padding: '80px 40px 96px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Запись</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-.01em' }}>
            Записаться<br /><span style={{ fontStyle: 'italic' }}>на первую встречу</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 40px' }}>Выберите удобное время – забронирую слот сразу, пришлю подтверждение и ссылку на встречу.</p>
          <BookingPicker fallback={<BookingForm />} />
          <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Или напишите напрямую:</span>
            <TgLink label="@kotlarewski" />
          </div>
        </section>
      </section>

      {/* ── ВСЁ ПО СХЕМЕ ────────────────────────────────────────────────── */}
      <section id="app" style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 40px' }}>
          <div className="app-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 100, marginBottom: 22 }}>
                <span style={{ fontSize: 14 }}>🧠</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>Всё по схеме</span>
              </div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 18px', lineHeight: 1.1, letterSpacing: '-.01em' }}>
Помогите себе сами.<br /><span style={{ fontStyle: 'italic' }}>Между сессиями.</span>
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 32px' }}>
                «Всё по схеме» – бесплатное веб-приложение для самостоятельной работы в подходе схема-терапии. Ведите дневник состояний, отслеживайте потребности, делайте упражнения. Всё сохраняется – динамика всегда перед глазами.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Btn href="https://schemehappens.ru" newTab={false}>Попробовать бесплатно</Btn>
                <Btn variant="ghost" href={botUrl}>Telegram-бот</Btn>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {APP_FEATURES.map((f, i) => <AppFeatureCard key={i} f={f} accent={i === 0} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ maxWidth: 780, margin: '0 auto', padding: '88px 40px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Частые вопросы</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 48px', letterSpacing: '-.01em' }}>
          Что нужно знать
        </h2>
        <FaqList price={priceStr} />
      </section>

      {/* ── MARQUEE #4 ───────────────────────────────────────────────────── */}
      <MarqueeStrip reverse bg="var(--bg-rail)" topics={siteContent.marqueeTopicsA} />

      {/* ── PRE-FOOTER CTA ──────────────────────────────────────────────── */}
      <section style={{ background: DARK_BG, padding: '96px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(236,234,229,.28)', margin: '0 0 24px' }}>Начать</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 400, color: INK_ON_DARK, lineHeight: 1.05, margin: '0 0 36px', letterSpacing: '-.025em' }}>
            Первая встреча –<br /><span style={{ fontStyle: 'italic', color: 'rgba(144,137,224,.85)' }}>бесплатно</span>
          </h2>
          <Btn size="lg" onClick={scrollToBooking}>Записаться на знакомство →</Btn>
          <p style={{ fontSize: 13, color: 'rgba(236,234,229,.28)', marginTop: 20 }}>15 минут · без обязательств · онлайн</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>© {new Date().getFullYear()} Григорий Котляревский</span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/articles" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Статьи</a>
            <a href="/reviews" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Отзывы</a>
            <a href="/privacy" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Политика конфиденциальности</a>
            <a href="/offer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Оферта</a>
            <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Telegram</a>
            <a href="https://schemehappens.ru" style={{ fontSize: 13, color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600 }}>Открыть «Всё по схеме» →</a>
          </div>
        </div>
      </footer>

      {/* ── GLOBAL STYLES ───────────────────────────────────────────────── */}
      <LandingStyles />
    </div>
  );
}
