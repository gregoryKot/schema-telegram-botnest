import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';

// ─── Scroll reveal via CSS scroll-driven (with IntersectionObserver fallback) ─
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('revealed'); obs.disconnect(); } },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Card hover tilt ──────────────────────────────────────────────────────────
function useTilt() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px)`;
      el.style.boxShadow = '0 20px 60px rgba(28,25,20,.16)';
    };
    const onLeave = () => { el.style.transform = ''; el.style.boxShadow = ''; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, []);
  return ref;
}

// ─── Marquee strip ────────────────────────────────────────────────────────────
const TOPICS: { label: string; href: string }[] = [
  { label: 'Схема-терапия', href: '#approach' },
  { label: 'Паттерны', href: '#approach' },
  { label: 'Отношения', href: '#booking' },
  { label: 'Самооценка', href: '#booking' },
  { label: 'Тревога', href: '#booking' },
  { label: 'Идентичность', href: '#approach' },
  { label: 'КПТ', href: '#approach' },
  { label: 'Бесплатное знакомство', href: '#booking' },
  { label: 'Онлайн-сессии', href: '#prices' },
];

function MarqueeStrip({ reverse = false, bg = 'var(--bg-rail)', italic = false }: { reverse?: boolean; bg?: string; italic?: boolean }) {
  const dur = reverse ? '38s' : '30s';
  const anim = reverse ? 'marquee-rev' : 'marquee-fwd';
  return (
    <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', overflow: 'hidden', padding: '14px 0', background: bg }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ display: 'inline-flex', flexShrink: 0, animation: `${anim} ${dur} linear infinite` }}>
            {TOPICS.map(w => (
              <a key={w.label} href={w.href}
                style={{ fontSize: 14, fontWeight: 500, fontStyle: italic ? 'italic' : 'normal', color: 'var(--text-sub)', padding: '0 20px', textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
                {w.label}<span style={{ color: 'var(--accent)', marginLeft: 20, fontStyle: 'normal' }}>·</span>
              </a>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Booking form ─────────────────────────────────────────────────────────────
function BookingForm() {
  const [name, setName]       = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !consent) return;
    setStatus('loading');
    try {
      await api.submitBooking({ name: name.trim(), contact: contact.trim(), message: message.trim() || undefined });
      setStatus('done');
    } catch { setStatus('error'); }
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '14px 16px', fontSize: 15,
    background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
    borderRadius: 12, color: 'var(--text)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
  };
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
    textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
  };

  if (status === 'done') return (
    <div style={{ textAlign: 'center', padding: '56px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>✉️</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Заявка отправлена</h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7 }}>Свяжусь в течение дня. Договоримся о времени.</p>
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-grid">
        <div><label style={labelSt}>Имя *</label><input style={field} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></div>
        <div><label style={labelSt}>Telegram / телефон *</label><input style={field} placeholder="@username" value={contact} onChange={e => setContact(e.target.value)} required maxLength={100} /></div>
      </div>
      <div>
        <label style={labelSt}>Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
        <textarea style={{ ...field, resize: 'vertical', minHeight: 96 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={e => setMessage(e.target.value)} maxLength={500} />
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
        <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Я ознакомился(ась) с{' '}<a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Политикой конфиденциальности</a>{' '}и даю согласие на обработку данных
        </span>
      </label>
      {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>Не вышло — напишите напрямую: <a href="https://t.me/kotlarewski" style={{ color: 'inherit' }}>@kotlarewski</a></p>}
      <button type="submit" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent} style={{
        padding: '16px 32px', background: 'var(--accent)', color: 'white',
        border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        opacity: (status === 'loading' || !name.trim() || !contact.trim() || !consent) ? .4 : 1,
        transition: 'opacity .15s, transform .1s', alignSelf: 'flex-start',
        boxShadow: '0 8px 28px rgba(77,71,153,.3)',
      }}>
        {status === 'loading' ? 'Отправляю…' : 'Записаться на встречу →'}
      </button>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Первая встреча 15 минут — бесплатно. Никаких обязательств.</p>
    </form>
  );
}

// ─── App features ─────────────────────────────────────────────────────────────
const APP_FEATURES = [
  { num: '01', title: 'Дневник состояний', text: 'Каждый день — короткая оценка восьми базовых потребностей. Появляется картина того, что происходит.' },
  { num: '02', title: 'Схемы и режимы',   text: 'Узнайте, какие ранние убеждения управляют реакциями. Инструмент диагностики прямо в телефоне.' },
  { num: '03', title: 'Практики',          text: 'Упражнения из схема-терапии и КПТ: переоценка убеждений, письма, безопасное место, флэшкарточки.' },
  { num: '04', title: 'Динамика',          text: 'История состояний за недели и месяцы. Видно, что меняется, а что стоит на месте.' },
];

// ─── App feature card (needs own component for useTilt hook) ─────────────────
function AppFeatureCard({ f, accent }: { f: typeof APP_FEATURES[0]; accent: boolean }) {
  const ref = useTilt();
  return (
    <div ref={ref} style={{ background: accent ? 'var(--accent)' : 'var(--bg-elev)', border: accent ? 'none' : '1px solid var(--line)', borderRadius: 16, padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default', transition: 'transform .25s, box-shadow .25s', willChange: 'transform' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: accent ? 'rgba(255,255,255,.6)' : 'var(--accent)' }}>{f.num}</span>
      <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: accent ? 'white' : 'var(--text)' }}>{f.title}</p>
      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: accent ? 'rgba(255,255,255,.78)' : 'var(--text-sub)' }}>{f.text}</p>
    </div>
  );
}

// ─── Approach cards ───────────────────────────────────────────────────────────
function BentoCard({ num, title, text, accent = false }: { num: string; title: string; text: string; accent?: boolean }) {
  const ref = useTilt();
  return (
    <div ref={ref} style={{
      background: accent ? 'var(--accent)' : 'var(--bg-elev)',
      border: accent ? 'none' : '1px solid var(--line)',
      color: accent ? 'white' : undefined,
      borderRadius: 20, padding: '32px',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'transform .25s, box-shadow .25s',
      cursor: 'default', willChange: 'transform',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', opacity: accent ? .65 : 1, color: accent ? 'white' : 'var(--text-faint)' }}>{num}</span>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: accent ? 28 : 21, fontWeight: 400, lineHeight: 1.2, margin: 0, color: accent ? 'white' : 'var(--text)' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, opacity: accent ? .85 : 1, color: accent ? 'white' : 'var(--text-sub)' }}>{text}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function LandingPage() {
  const bookingRef  = useRef<HTMLElement>(null);
  const [showBar, setShowBar] = useState(false);

  const aboutRef    = useReveal() as React.RefObject<HTMLElement>;
  const quoteRef    = useReveal() as React.RefObject<HTMLElement>;
  const approachRef = useReveal() as React.RefObject<HTMLElement>;
  const processRef  = useReveal() as React.RefObject<HTMLElement>;
  const priceRef    = useReveal() as React.RefObject<HTMLElement>;
  const formRef     = useReveal() as React.RefObject<HTMLElement>;

  const scrollToBooking = useCallback(() => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const fn = () => setShowBar(window.scrollY > window.innerHeight * 0.75);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>

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
        background: 'rgba(245,242,235,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--line)',
        transform: showBar ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform .4s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>Г</div>
          <span style={{ fontSize: 15, fontFamily: 'var(--serif)', color: 'var(--text)' }}>Григорий Котляревский</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/login" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Войти</a>
          <button onClick={scrollToBooking} style={{ padding: '7px 18px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Записаться</button>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(77,71,153,.11) 0%, transparent 70%)', top: '-15%', right: '-8%', animation: 'blob-float 20s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(176,111,74,.08) 0%, transparent 70%)', bottom: '5%', left: '-8%', animation: 'blob-float 26s ease-in-out infinite reverse' }} />
        </div>

        <div className="hero-wrap" style={{ position: 'relative', zIndex: 1 }}>
          {/* Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontFamily: 'var(--serif)' }}>Г</div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Григорий Котляревский</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(107,129,86,.12)', border: '1px solid rgba(107,129,86,.25)', borderRadius: 100 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6b8156', display: 'inline-block', animation: 'pulse-dot 2.5s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b8156', letterSpacing: '.06em' }}>Принимаю клиентов</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <a href="#schemalab" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 100, fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', textDecoration: 'none' }}>
                🧠 СхемаЛаб
              </a>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 100, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                Знакомство · бесплатно
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="hero-body">
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 24px', animation: 'hero-in .6s .1s both' }}>Схема-терапия · Онлайн</p>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(44px, 5.2vw, 78px)', fontWeight: 400, lineHeight: 1.05, letterSpacing: '-.02em', color: 'var(--text)', margin: '0 0 28px' }}>
                <span style={{ display: 'block', overflow: 'hidden' }}><span style={{ display: 'block', animation: 'line-in .7s .2s both' }}>Работа с теми</span></span>
                <span style={{ display: 'block', overflow: 'hidden' }}><span style={{ display: 'block', animation: 'line-in .7s .35s both', fontStyle: 'italic', color: 'var(--accent)' }}>паттернами,</span></span>
                <span style={{ display: 'block', overflow: 'hidden' }}><span style={{ display: 'block', animation: 'line-in .7s .5s both' }}>которые мешают</span></span>
              </h1>
              <p style={{ fontSize: 17, color: 'var(--text-sub)', lineHeight: 1.75, maxWidth: 460, margin: '0 0 40px', animation: 'hero-in .6s .65s both' }}>
                Мы снова и снова попадаем в одни и те же ситуации — в отношениях, самооценке, тревоге. Схема-терапия объясняет почему и даёт выход.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animation: 'hero-in .6s .8s both' }}>
                <button onClick={scrollToBooking} style={{ padding: '15px 32px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 100, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(28,25,20,.18)', transition: 'transform .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
                  Записаться на встречу
                </button>
                <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 24px', border: '1.5px solid var(--line-strong)', borderRadius: 100, fontSize: 15, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none', transition: 'border-color .15s, color .15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--text)'; el.style.color = 'var(--text)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = ''; }}>
                  Написать в Telegram ↗
                </a>
              </div>
            </div>

            {/* Right: price cards */}
            <div className="hero-cards" style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', animation: 'hero-in .8s .45s both' }}>
              <div style={{ background: 'var(--accent)', borderRadius: 20, padding: '28px', boxShadow: '0 20px 60px rgba(77,71,153,.3)', transition: 'transform .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)', margin: '0 0 10px' }}>Знакомство</p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 52, fontWeight: 400, color: 'white', margin: '0 0 6px', lineHeight: 1, letterSpacing: '-.02em' }}>0 ₽</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', margin: 0 }}>15 минут · без обязательств</p>
              </div>
              <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 20, padding: '24px', boxShadow: '0 8px 24px rgba(28,25,20,.07)', transition: 'transform .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Сессия</p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 44, fontWeight: 400, color: 'var(--text)', margin: '0 0 6px', lineHeight: 1, letterSpacing: '-.02em' }}>4 000 ₽</p>
                <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0 }}>50 минут · онлайн</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Схема-терапия', 'КПТ', 'Онлайн'].map(t => (
                  <span key={t} style={{ padding: '6px 14px', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 100, fontSize: 12, fontWeight: 500, color: 'var(--text-sub)' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 28, animation: 'hero-in .6s 1s both' }}>
            <div>
              <p style={{ fontSize: 20, fontFamily: 'var(--serif)', fontWeight: 400, margin: '0 0 3px', color: 'var(--text)' }}>Григорий Котляревский</p>
              <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Психолог · Схема-терапия · КПТ</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Далее</span>
              <div style={{ width: 1, height: 32, background: 'var(--line-strong)', animation: 'scroll-bar 2s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE #1 ───────────────────────────────────────────────────── */}
      <MarqueeStrip />

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      <section id="about" ref={aboutRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 40px' }}>
        <div className="about-inner">
          <div style={{ position: 'relative' }}>
            <div style={{ aspectRatio: '3/4', borderRadius: 24, overflow: 'hidden', background: 'var(--surface-2)', boxShadow: '0 24px 80px rgba(28,25,20,.1)' }}>
              <img src="/gregory.jpg" alt="Григорий Котляревский" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
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
              Я Григорий Котляревский — психолог, веду практику в подходе схема-терапии. Работаю с людьми, которых преследуют повторяющиеся паттерны: в отношениях, самооценке, хронической тревоге.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 32px' }}>
              Меня интересует не только «что» происходит с человеком, но и «почему» — какие ранние убеждения и режимы стоят за сегодняшними трудностями. Работаю онлайн.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Схема-терапия', 'КПТ', 'Онлайн'].map(tag => (
                <span key={tag} style={{ padding: '8px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 100, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PULL QUOTE ──────────────────────────────────────────────────── */}
      <section ref={quoteRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '72px 40px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ width: 3, height: 44, background: 'var(--accent)', borderRadius: 2, marginBottom: 24 }} />
          <blockquote style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(22px, 3.2vw, 36px)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.4, color: 'var(--text)', margin: 0, letterSpacing: '-.01em' }}>
            «Паттерны не приговор. Они появились как защита — и могут измениться, когда появляется безопасный контакт и понимание того, откуда они взялись.»
          </blockquote>
        </div>
      </section>

      {/* ── MARQUEE #2 (reverse) ────────────────────────────────────────── */}
      <MarqueeStrip reverse bg="var(--bg)" italic />

      {/* ── APPROACH BENTO ──────────────────────────────────────────────── */}
      <section id="approach" ref={approachRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: 'var(--bg-rail)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Подход</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>Как я работаю</h2>
          <div className="bento-grid">
            <div className="bento-tall"><BentoCard num="01" title={'Схема-\nтерапия'} text="Работаем с глубинными убеждениями и режимами, которые сформировались задолго до сознательного возраста — и тихо управляют сегодняшними выборами." accent /></div>
            <div className="bento-wide"><BentoCard num="02" title="Тёплый контакт" text="Наши отношения — не нейтральный экран, а инструмент изменений. Я присутствую в сессии целиком и использую этот контакт как часть терапии." /></div>
            <div><BentoCard num="03" title="Доказательная база" text="Схема-терапия эффективна при хронических паттернах — это подтверждено рандомизированными исследованиями." /></div>
            <div><BentoCard num="04" title="Долгосрочный результат" text="Цель — изменить не симптом, а то, как вы воспринимаете себя. Глубоко, но устойчиво." /></div>
          </div>
        </div>
      </section>

      {/* ── PROCESS ─────────────────────────────────────────────────────── */}
      <section ref={processRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: '#1c1916', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(236,234,229,.4)', margin: '0 0 10px' }}>Как начать</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: '#eceae5', margin: '0 0 56px', letterSpacing: '-.01em' }}>Три шага до первой встречи</h2>
          <div className="process-grid">
            {[
              { n: '01', title: 'Оставьте заявку', sub: 'Имя и контакт — этого достаточно. Можно добавить пару слов о запросе.' },
              { n: '02', title: 'Знакомство 15 минут', sub: 'Бесплатная встреча: расскажете о ситуации, я — о подходе. Без давления.' },
              { n: '03', title: 'Начинаем работу', sub: 'Если подходим друг другу — назначаем регулярные сессии и двигаемся вглубь.' },
            ].map((s, i) => (
              <div key={i} style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,.08)' : 'none', padding: '0 40px 0 ' + (i > 0 ? '40px' : '0') }}>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 6vw, 80px)', fontWeight: 400, color: 'rgba(144,137,224,.3)', lineHeight: 1, margin: '0 0 16px', letterSpacing: '-.03em' }}>{s.n}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: '#eceae5', margin: '0 0 10px' }}>{s.title}</p>
                <p style={{ fontSize: 14, color: 'rgba(236,234,229,.5)', lineHeight: 1.7, margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEE #3 ───────────────────────────────────────────────────── */}
      <MarqueeStrip />

      {/* ── PRICES ──────────────────────────────────────────────────────── */}
      <section id="prices" ref={priceRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Формат и цены</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>Как устроена работа</h2>
        <div className="price-grid">
          {/* Free intro — PRIMARY */}
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
            <button onClick={scrollToBooking} style={{ padding: '15px 24px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 28px rgba(77,71,153,.3)', transition: 'transform .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
              Записаться бесплатно →
            </button>
          </div>
          {/* Session */}
          <div style={{ background: 'var(--text)', borderRadius: 24, padding: '40px', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.12)', padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>Основной</div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(236,234,229,.45)' }}>Сессия</span>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, color: '#eceae5', margin: '6px 0 0', letterSpacing: '-.03em', lineHeight: 1 }}>4 000 ₽</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['50 минут онлайн (видео)', 'Индивидуальная работа', 'Схема-терапия и КПТ', 'Регулярные встречи'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: 'rgba(144,137,224,.9)', fontSize: 15, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 15, color: 'rgba(236,234,229,.7)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={scrollToBooking} style={{ padding: '15px 24px', background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.2)', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#eceae5', cursor: 'pointer', transition: 'background .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; }}>
              Начать работу →
            </button>
          </div>
        </div>
      </section>

      {/* ── BOOKING ─────────────────────────────────────────────────────── */}
      <section id="booking" ref={bookingRef as any} style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)' }}>
        <section ref={formRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 660, margin: '0 auto', padding: '80px 40px 96px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Запись</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-.01em' }}>
            Записаться<br /><span style={{ fontStyle: 'italic' }}>на первую встречу</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 40px' }}>Оставьте имя и контакт — свяжусь в течение дня, договоримся о времени.</p>
          <BookingForm />
        </section>
      </section>

      {/* ── SCHEMALAB ───────────────────────────────────────────────────── */}
      <section id="schemalab" style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 40px' }}>
          <div className="app-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 100, marginBottom: 22 }}>
                <span style={{ fontSize: 14 }}>🧠</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>СхемаЛаб</span>
              </div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 18px', lineHeight: 1.1, letterSpacing: '-.01em' }}>
                Помоги себе сам.<br /><span style={{ fontStyle: 'italic' }}>Между сессиями.</span>
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 32px' }}>
                СхемаЛаб — бесплатное веб-приложение для самостоятельной работы в подходе схема-терапии. Ведите дневник состояний, отслеживайте потребности, делайте упражнения. Всё сохраняется — динамика всегда перед глазами.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href="/login" style={{ padding: '13px 26px', background: 'var(--accent)', color: 'white', borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 24px rgba(77,71,153,.28)', transition: 'transform .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
                  Попробовать бесплатно
                </a>
                <a href="https://t.me/SchemaLabBot" target="_blank" rel="noopener noreferrer" style={{ padding: '13px 22px', background: 'transparent', border: '1.5px solid var(--line-strong)', borderRadius: 100, fontSize: 14, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none' }}>
                  Telegram-бот
                </a>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {APP_FEATURES.map((f, i) => <AppFeatureCard key={i} f={f} accent={i === 0} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE #4 ───────────────────────────────────────────────────── */}
      <MarqueeStrip reverse bg="var(--bg-rail)" />

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>© {new Date().getFullYear()} Григорий Котляревский</span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/privacy" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Политика конфиденциальности</a>
            <a href="/offer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Оферта</a>
            <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Telegram</a>
            <a href="/login" style={{ fontSize: 13, color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600 }}>Открыть СхемаЛаб →</a>
          </div>
        </div>
      </footer>

      {/* ── GLOBAL STYLES ───────────────────────────────────────────────── */}
      <style>{`
        html { scroll-behavior: smooth; }

        @keyframes hero-in    { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
        @keyframes line-in    { from { transform:translateY(110%) } to { transform:none } }
        @keyframes blob-float { 0%,100% { transform:translate(0,0) scale(1) } 50% { transform:translate(2%,2%) scale(1.03) } }
        @keyframes scroll-bar { 0%,100% { opacity:.3; transform:scaleY(.5) } 50% { opacity:1; transform:scaleY(1) } }
        @keyframes pulse-dot  { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(.65) } }
        @keyframes marquee-fwd { from { transform:translateX(0) } to { transform:translateX(-100%) } }
        @keyframes marquee-rev { from { transform:translateX(-100%) } to { transform:translateX(0) } }

        .reveal-section { opacity:0; transform:translateY(28px); transition:opacity .75s ease, transform .75s ease; }
        .reveal-section.revealed { opacity:1; transform:none; }

        /* Hero */
        .hero-wrap  { max-width:1100px; width:100%; margin:0 auto; padding:0 40px; display:flex; flex-direction:column; min-height:100dvh; box-sizing:border-box; }
        .hero-body  { display:grid; grid-template-columns:1fr 1fr; gap:56px; flex:1; align-items:center; padding-bottom:24px; }

        /* Grids */
        .about-inner  { display:grid; grid-template-columns:2fr 3fr; gap:48px; align-items:start; }
        .bento-grid   { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:auto auto; gap:16px; }
        .bento-tall   { grid-row:1/3; }
        .bento-wide   { grid-column:2/4; }
        .process-grid { display:grid; grid-template-columns:repeat(3,1fr); }
        .price-grid   { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .app-grid     { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; }
        .form-grid    { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

        input:focus, textarea:focus { border-color:var(--accent) !important; box-shadow:0 0 0 4px var(--accent-soft); }

        @media (max-width:900px) {
          .hero-body    { grid-template-columns:1fr; gap:32px; padding-bottom:16px; }
          .hero-cards   { display:none; }
          .about-inner  { grid-template-columns:1fr; }
          .bento-grid   { grid-template-columns:1fr; }
          .bento-tall   { grid-row:auto; }
          .bento-wide   { grid-column:auto; }
          .process-grid { grid-template-columns:1fr; gap:32px; }
          .process-grid > div { border-left:none !important; padding:0 !important; }
          .price-grid   { grid-template-columns:1fr; }
          .app-grid     { grid-template-columns:1fr; }
        }
        @media (max-width:600px) {
          .form-grid { grid-template-columns:1fr; }
          .hero-wrap, section, footer { padding-left:20px !important; padding-right:20px !important; }
        }
      `}</style>
    </div>
  );
}
