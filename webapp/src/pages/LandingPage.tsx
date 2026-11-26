import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Btn } from '../components/landing-kit';
import { DARK_BG, INK_ON_DARK, useReveal, useTheme } from '../components/landing-kit-hooks';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { TG_URL, PRACTICE_BOOKING_URL, menuBtnStyle, burgerLine, TOPICS_A, TOPICS_B } from './landing/constants';
import { glueSpaces } from '../../../shared/src/utils/typo';
import { isPracticeHost } from '../utils/domainChrome';
import { OPERATOR_NAME, OPERATOR_INN, OPERATOR_STATUS } from '../legal/operator';
import { SectionNav, MobileMenu } from './landing/nav';
import { HeroSection } from './landing/HeroSection';
import { AuthorAvatar } from '../components/AuthorAvatar';
import { MarqueeStrip } from './landing/MarqueeStrip';
import { BookingEntry } from './landing/BookingEntry';
import { FaqList } from './landing/cards';
import { LandingStyles } from './landing/LandingStyles';
import { trackGoalOnce } from '../lib/metrika';
import { useLandingGoals } from './landing/useLandingGoals';
import { useHashJump } from './landing/useHashJump';
import { useSessionPrice } from './landing/useSessionPrice';
import { PriceRows } from './landing/PriceRows';
import {
  WorkSection,
  EducationSection,
  TrustSection,
  ApproachSection,
  ProcessSection,
  BoundariesSection,
} from './landing/ContentSections';

// ─── Main page ────────────────────────────────────────────────────────────────
export function LandingPage() {
  const bookingRef          = useRef<HTMLElement>(null);
  const activeSectionRef    = useRef('');
  const scrollspyReadyRef   = useRef(false);
  const [showBar, setShowBar] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [activeSection, setActiveSection] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useLandingGoals();
  useHashJump();
  // Живая цена сессии в валюте посетителя (правится в админке) — лендинг совпадает с формой записи.
  const sessionPrice = useSessionPrice();
  // Hero photo + marquee topics (editable in admin) — hardcoded defaults keep
  // the site looking the same until the therapist actually edits them.
  const [siteContent, setSiteContent] = useState<{ heroPhoto: string | null; marqueeTopicsA: typeof TOPICS_A; marqueeTopicsB: typeof TOPICS_B }>({
    heroPhoto: null, marqueeTopicsA: TOPICS_A, marqueeTopicsB: TOPICS_B,
  });
  useEffect(() => { api.getSiteContent().then(setSiteContent).catch(() => {}); }, []);
  const { theme, toggle: toggleTheme } = useTheme();

  const aboutRef    = useReveal() as React.RefObject<HTMLElement>;
  const priceRef    = useReveal() as React.RefObject<HTMLElement>;
  const formRef     = useReveal() as React.RefObject<HTMLElement>;

  // Запись живёт на сайте практики (kotlarewski). На самом kotlarewski —
  // плавно скроллим к форме; на schemehappens и прочих — уводим на практику.
  const scrollToBooking = useCallback(() => {
    trackGoalOnce('booking_start');
    if (isPracticeHost()) scrollIntoViewSafe(bookingRef.current, { block: 'start' });
    else window.location.href = PRACTICE_BOOKING_URL;
  }, []);

  useEffect(() => {
    const ids = ['about', 'work', 'education', 'approach', 'process', 'prices', 'booking', 'faq'];
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
    // search обязателен: без него терялись utm_source/yclid Яндекс.Директа.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + hash);
  }, [activeSection]);

  return (
    // Бренд визитки (индиго + Instrument Serif, блок .landing-personal-brand в
    // webapp/src/index.css) задаёт layout-маршрут PracticeBrand в App.tsx —
    // одинаково для всех страниц визитки, а не только для этой.
    // alignSelf: flex-start обязателен: #root — flex-контейнер высотой 100vh, и
    // растянутая обёртка с overflowX: hidden становилась внутренним скроллером —
    // window.scrollY всегда 0, липкая панель «Записаться» и scrollspy не включались.
    <div style={{ background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden', flex: '1 1 0%', minWidth: 0, alignSelf: 'flex-start' }}>

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
      <div className="sticky-bar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 32px',
        background: 'var(--nav-bg)', // см. index.css/.mobile-nav
        borderBottom: '1px solid var(--line)',
        transform: showBar ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform .4s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <AuthorAvatar photo={siteContent.heroPhoto ?? '/gregory.jpg'} size={30} letterSize={13} />
          {/* Узкий экран: имя ужимается с многоточием, кнопка и бургер не сжимаются. */}
          <span style={{ fontSize: 15, fontFamily: 'var(--serif)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Григорий Котляревский</span>
        </div>
        <SectionNav className="sticky-nav" active={activeSection} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
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
          <div style={{ position: 'absolute', width: 900, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 65%)', top: '-10%', right: '-15%' }} />
          <div style={{ position: 'absolute', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, color-mix(in srgb, var(--c-clay) 7%, transparent) 0%, transparent 65%)', bottom: '10%', left: '-5%' }} />
        </div>

        <HeroSection
          photo={siteContent.heroPhoto ?? '/gregory.jpg'}
          activeSection={activeSection}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBook={scrollToBooking}
          onOpenMenu={() => setMenuOpen(true)}
        />
      </section>

      {/* ── MARQUEE #1 ───────────────────────────────────────────────────── */}
      <MarqueeStrip topics={siteContent.marqueeTopicsA} />

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      <section id="about" ref={aboutRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 40px' }}>
        <div className="about-inner">
          <div style={{ position: 'relative' }}>
            <div style={{ aspectRatio: '3/4', borderRadius: 'var(--r-16)', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={siteContent.heroPhoto ?? "/gregory.jpg"} alt="Григорий Котляревский" loading="lazy" decoding="async" width={600} height={800} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
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
            <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--text-sub)' }}><b className="u-fg">50 мин</b> · онлайн-сессия</p>
          </div>
          <div style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 18px' }}>Обо мне</p>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(34px, 3.8vw, 52px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text)', margin: '0 0 28px', letterSpacing: '-.01em' }}>
              Работаю с тем,<br /><span style={{ fontStyle: 'italic' }}>что важно для вас</span>
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 18px' }}>
              Я – Григорий Котляревский, работаю в подходе схема-терапия. Ко мне приходят, когда одни и те же сценарии – в отношениях, в самооценке, в тревоге – повторяются годами, а справиться с ними в одиночку не выходит.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 18px' }}>
              Меня интересует «что» происходит с человеком и «почему» – какие ранние убеждения и режимы стоят за сегодняшними трудностями. Работаю онлайн.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 32px' }}>
              Веду частную практику с 2025 года и регулярно разбираю случаи с супервизором. Шестой год прохожу личную терапию: убеждён, что сопровождать другого можно, только зная этот путь изнутри.
            </p>
            <p style={{ margin: 0, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 13, fontWeight: 600, letterSpacing: '.02em', color: 'var(--accent)' }}>Схема-терапия · КПТ · Онлайн</p>
          </div>
        </div>
      </section>

      {/* ── WORK THEMES ─────────────────────────────────────────────────── */}
      <WorkSection />

      {/* ── EDUCATION ───────────────────────────────────────────────────── */}
      <EducationSection />

      {/* ── TRUST ───────────────────────────────────────────────────────── */}
      <TrustSection />

      {/* ── MARQUEE #2 (reverse) ────────────────────────────────────────── */}
      <MarqueeStrip reverse bg="var(--bg)" italic topics={siteContent.marqueeTopicsB} />

      {/* ── APPROACH BENTO ──────────────────────────────────────────────── */}
      <ApproachSection />

      {/* ── PROCESS ─────────────────────────────────────────────────────── */}
      <ProcessSection />

      {/* ── MARQUEE #3 ───────────────────────────────────────────────────── */}
      <MarqueeStrip topics={siteContent.marqueeTopicsB} />

      {/* ── PRICES ──────────────────────────────────────────────────────── */}
      <section id="prices" ref={priceRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Формат и цены</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>Как устроена работа</h2>
        <PriceRows sessionPrice={sessionPrice} onBook={scrollToBooking} />
      </section>

      {/* ── BOUNDARIES ──────────────────────────────────────────────────── */}
      <BoundariesSection />

      {/* ── BOOKING ─────────────────────────────────────────────────────── */}
      <section id="booking" ref={bookingRef} style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)' }}>
        <section ref={formRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 660, margin: '0 auto', padding: '80px 40px 96px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Запись</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-.01em' }}>
            Записаться<br /><span style={{ fontStyle: 'italic' }}>на первую встречу</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 40px' }}>{glueSpaces('Напишите пару слов о себе и как с вами связаться – отвечу в течение дня, и мы договоримся о времени. Если удобнее выбрать время самим, расписание откроется ниже.')}</p>
          <BookingEntry />
        </section>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ maxWidth: 780, margin: '0 auto', padding: '88px 40px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Частые вопросы</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 48px', letterSpacing: '-.01em' }}>
          Что нужно знать
        </h2>
        <FaqList price={sessionPrice.text} online={sessionPrice.online} />
      </section>

      {/* ── MARQUEE #4 ───────────────────────────────────────────────────── */}
      <MarqueeStrip reverse bg="var(--bg-rail)" topics={siteContent.marqueeTopicsA} />

      {/* ── PRE-FOOTER CTA ──────────────────────────────────────────────── */}
      <section style={{ background: DARK_BG, padding: '96px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--on-dark) 50%, transparent)', margin: '0 0 24px' }}>Начать</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 400, color: INK_ON_DARK, lineHeight: 1.05, margin: '0 0 36px', letterSpacing: '-.025em' }}>
            Первая встреча –<br /><span style={{ fontStyle: 'italic', color: 'color-mix(in srgb, var(--accent-on-dark) 85%, transparent)' }}>бесплатно</span>
          </h2>
          <Btn size="lg" onClick={scrollToBooking}>Записаться на знакомство →</Btn>
          <p style={{ fontSize: 13, color: 'color-mix(in srgb, var(--on-dark) 50%, transparent)', marginTop: 20 }}>15 минут · без обязательств · онлайн</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5 }}>© {new Date().getFullYear()} {OPERATOR_NAME} · {OPERATOR_STATUS} · ИНН {OPERATOR_INN}</span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/articles" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Статьи</a>
            <a href="/reviews" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Отзывы</a>
            <a href="/privacy" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Политика конфиденциальности</a>
            <a href="/offer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Оферта</a>
            <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Telegram</a>
          </div>
        </div>
      </footer>

      {/* ── GLOBAL STYLES ───────────────────────────────────────────────── */}
      <LandingStyles />
    </div>
  );
}
