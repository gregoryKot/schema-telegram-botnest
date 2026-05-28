import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('revealed'); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
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

  if (status === 'done') return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>✉️</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>
        Заявка отправлена
      </h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7 }}>
        Свяжусь в течение дня. Договоримся о времени.
      </p>
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Имя *</label>
          <input style={field} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Telegram / телефон *</label>
          <input style={field} placeholder="@username" value={contact} onChange={e => setContact(e.target.value)} required maxLength={100} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
        <textarea style={{ ...field, resize: 'vertical', minHeight: 96 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={e => setMessage(e.target.value)} maxLength={500} />
      </div>
      {/* Consent */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Я ознакомился(ась) с{' '}
          <a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Политикой конфиденциальности</a>
          {' '}и даю согласие на обработку персональных данных
        </span>
      </label>

      {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>Не вышло — напишите напрямую: <a href="https://t.me/kotlarewski" style={{ color: 'inherit' }}>@kotlarewski</a></p>}
      <button type="submit" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent} style={{
        padding: '16px 32px', background: 'var(--text)', color: 'var(--bg)',
        border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
        cursor: 'pointer', letterSpacing: '.02em',
        opacity: (status === 'loading' || !name.trim() || !contact.trim()) ? .5 : 1,
        transition: 'opacity .15s, transform .15s',
        alignSelf: 'flex-start',
      }}>
        {status === 'loading' ? 'Отправляю…' : 'Записаться →'}
      </button>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Первая встреча 15 минут — бесплатно. Никаких обязательств.</p>
    </form>
  );
}

// ─── Education items ──────────────────────────────────────────────────────────
const EDUCATION = [
  {
    year: '2024 —',
    title: 'МИП · Бакалавриат',
    sub: 'Московский институт психоанализа · Психология, психотерапия качества жизни',
  },
  {
    year: '2025',
    title: 'Практик схема-терапии',
    sub: '«Практик схема-терапии. Базовый курс» · 47 ак.ч. теории и практики · Лазарев М.А.',
  },
  {
    year: '2025–26',
    title: 'КПТ · 288 часов',
    sub: 'Когнитивно-поведенческая терапия · МАНП · 288 ак.ч. (с октября 2025 по июнь 2026)',
  },
];

// ─── App feature items ────────────────────────────────────────────────────────
const APP_FEATURES = [
  { num: '01', title: 'Дневник состояний', text: 'Каждый день — короткая оценка восьми базовых потребностей. Появляется картина того, что происходит.' },
  { num: '02', title: 'Схемы и режимы', text: 'Узнайте, какие ранние убеждения управляют реакциями. Инструмент диагностики прямо в телефоне.' },
  { num: '03', title: 'Практики', text: 'Упражнения из схема-терапии и КПТ: переоценка убеждений, письма, безопасное место, флэшкарточки.' },
  { num: '04', title: 'Динамика', text: 'История состояний за недели и месяцы. Видно, что меняется, а что стоит на месте.' },
];

// ─── Main landing ─────────────────────────────────────────────────────────────
export function LandingPage() {
  const bookingRef    = useRef<HTMLElement>(null);
  const [showCta, setShowCta] = useState(false);
  const aboutRef    = useReveal() as React.RefObject<HTMLElement>;
  const approachRef = useReveal() as React.RefObject<HTMLElement>;
  const statsRef    = useReveal() as React.RefObject<HTMLElement>;
  const appRef      = useReveal() as React.RefObject<HTMLElement>;
  const priceRef    = useReveal() as React.RefObject<HTMLElement>;
  const formRef     = useReveal() as React.RefObject<HTMLElement>;

  const scrollToBooking = useCallback(() => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const onScroll = () => setShowCta(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>

      {/* ── Sticky App CTA bar ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        transform: showCta ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform .35s cubic-bezier(.4,0,.2,1)',
        background: 'rgba(245,242,235,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 60, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <span style={{ fontSize: 14, color: 'var(--text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <b style={{ color: 'var(--text)', fontWeight: 700 }}>СхемаЛаб</b>
            <span style={{ color: 'var(--text-faint)', marginLeft: 8 }}>— дневник состояний и работа со схемами</span>
          </span>
        </div>
        <a href="/login" style={{
          padding: '8px 20px', background: 'var(--accent)', color: 'white',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          Попробовать бесплатно →
        </a>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        padding: '0 40px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div className="blob-1" style={{
            position: 'absolute', width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(77,71,153,.12) 0%, transparent 70%)',
            top: '-15%', right: '-10%', animation: 'blob-float 18s ease-in-out infinite',
          }} />
          <div className="blob-2" style={{
            position: 'absolute', width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(176,111,74,.1) 0%, transparent 70%)',
            bottom: '5%', left: '-8%', animation: 'blob-float 24s ease-in-out infinite reverse',
          }} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '28px 0', position: 'relative', zIndex: 1,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 500 }}>schemalab.ru</span>
          <a href="#schemalab" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', background: 'var(--bg-elev)',
            border: '1px solid var(--line)', borderRadius: 100,
            fontSize: 13, fontWeight: 600, color: 'var(--text-sub)',
            textDecoration: 'none', transition: 'border-color .15s, color .15s',
          }}>
            <span style={{ fontSize: 15 }}>🧠</span>
            СхемаЛаб — приложение
          </a>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)', borderRadius: 100,
            fontSize: 13, fontWeight: 600, color: 'var(--accent)',
          }}>
            <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Знакомство · бесплатно
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1, paddingBottom: 80 }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 28px', animation: 'hero-in .6s .1s both' }}>
            Схема-терапия · Онлайн
          </p>
          <h1 className="hero-headline" style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(52px, 9vw, 108px)',
            fontWeight: 400, lineHeight: 1.02,
            letterSpacing: '-.02em',
            color: 'var(--text)', margin: '0 0 36px',
          }}>
            <span className="hero-line" style={{ display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', animation: 'line-in .7s .2s both' }}>Работа с теми</span>
            </span>
            <span className="hero-line" style={{ display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', animation: 'line-in .7s .35s both', fontStyle: 'italic', color: 'var(--accent)' }}>паттернами,</span>
            </span>
            <span className="hero-line" style={{ display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', animation: 'line-in .7s .5s both' }}>которые мешают</span>
            </span>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-sub)', lineHeight: 1.7, maxWidth: 520, margin: '0 0 48px', animation: 'hero-in .6s .65s both' }}>
            Мы снова и снова попадаем в одни и те же ситуации — в отношениях, самооценке, тревоге. Схема-терапия объясняет почему и даёт выход.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: 'hero-in .6s .8s both' }}>
            <button onClick={scrollToBooking} style={{
              padding: '16px 36px', background: 'var(--text)', color: 'var(--bg)',
              border: 'none', borderRadius: 100, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '.01em',
              boxShadow: '0 8px 32px rgba(28,25,20,.18)',
            }}>
              Записаться на встречу
            </button>
            <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '16px 28px', background: 'transparent',
              border: '1.5px solid var(--line-strong)', borderRadius: 100,
              fontSize: 16, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none',
            }}>
              Написать в Telegram ↗
            </a>
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          paddingBottom: 32, position: 'relative', zIndex: 1,
          animation: 'hero-in .6s 1s both',
        }}>
          <div>
            <p style={{ fontSize: 22, fontFamily: 'var(--serif)', fontWeight: 400, margin: '0 0 4px' }}>Григорий Котляревский</p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Практик схема-терапии</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Далее</span>
            <div style={{ width: 1, height: 36, background: 'var(--line-strong)', animation: 'scroll-bar 2s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', overflow: 'hidden', padding: '18px 0', background: 'var(--bg-rail)' }}>
        <div className="marquee-track" style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
          {[...Array(3)].map((_, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 0, animation: 'marquee 28s linear infinite' }}>
              {['Схема-терапия', 'Паттерны', 'Отношения', 'Самооценка', 'Тревога', 'Идентичность', 'Онлайн', 'Бесплатное знакомство'].map(w => (
                <span key={w} style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-sub)', padding: '0 28px' }}>
                  {w} <span style={{ color: 'var(--accent)', marginLeft: 28 }}>·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      <section ref={aboutRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 48, alignItems: 'start' }}>
          {/* Photo */}
          <div style={{ position: 'relative' }}>
            <div style={{
              aspectRatio: '3/4',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(28,25,20,.1)',
              background: 'var(--surface-2)',
            }}>
              <img
                src="/gregory.jpg"
                alt="Григорий Котляревский"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={{
              position: 'absolute', bottom: 24, left: -20,
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: 16, padding: '14px 20px',
              boxShadow: '0 8px 32px rgba(28,25,20,.12)',
            }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>50 мин</p>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>онлайн · сессия</p>
            </div>
          </div>

          {/* Text */}
          <div style={{ paddingTop: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 20px' }}>Обо мне</p>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 4vw, 54px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text)', margin: '0 0 32px', letterSpacing: '-.01em' }}>
              Практик,<br /><span style={{ fontStyle: 'italic' }}>который присутствует</span>
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 20px' }}>
              Я Григорий Котляревский — практик в подходе схема-терапии. Работаю с людьми, которых преследуют повторяющиеся паттерны: в отношениях, самооценке, хронической тревоге.
            </p>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 36px' }}>
              Меня интересует не только «что» происходит с человеком, но и «почему» — какие ранние убеждения и режимы стоят за сегодняшними трудностями. Работаю онлайн.
            </p>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
              {['Схема-терапия', 'КПТ', 'Онлайн'].map(tag => (
                <span key={tag} style={{
                  padding: '8px 16px', background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)', borderRadius: 100,
                  fontSize: 13, fontWeight: 600, color: 'var(--accent)',
                }}>{tag}</span>
              ))}
            </div>

            {/* Education */}
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 16px' }}>Образование и обучение</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {EDUCATION.map((item, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '72px 1fr',
                  gap: '0 16px', padding: '14px 0',
                  borderBottom: i < EDUCATION.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', paddingTop: 2, whiteSpace: 'nowrap' }}>{item.year}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 3px' }}>{item.title}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0, lineHeight: 1.5 }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── APPROACH BENTO ──────────────────────────────────────────────── */}
      <section ref={approachRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: 'var(--bg-rail)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Подход</p>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 4vw, 50px)', fontWeight: 400, color: 'var(--text)', margin: 0, letterSpacing: '-.01em' }}>
                Как я работаю
              </h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto auto', gap: 16 }}>
            <div className="bento-card" style={{
              gridRow: '1 / 3', background: 'var(--accent)', color: 'white',
              borderRadius: 20, padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              minHeight: 320, cursor: 'default', transition: 'transform .25s, box-shadow .25s',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', opacity: .7 }}>01</span>
              <div>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, lineHeight: 1.15, margin: '0 0 16px' }}>
                  Схема-<br />терапия
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, opacity: .85, margin: 0 }}>
                  Работаем с глубинными убеждениями и режимами, которые сформировались задолго до сознательного возраста — и тихо управляют сегодняшними выборами.
                </p>
              </div>
            </div>
            <div className="bento-card" style={{ gridColumn: '2 / 4', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px', transition: 'transform .25s, box-shadow .25s', cursor: 'default' }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', color: 'var(--text-faint)' }}>02</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, color: 'var(--text)', margin: '12px 0 10px' }}>Тёплый контакт</h3>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>
                Наши отношения — не нейтральный экран, а инструмент изменений. Я присутствую в сессии целиком и использую этот контакт как часть терапии.
              </p>
            </div>
            <div className="bento-card" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px', transition: 'transform .25s, box-shadow .25s', cursor: 'default' }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', color: 'var(--text-faint)' }}>03</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--text)', margin: '12px 0 10px' }}>Доказательная база</h3>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>
                Схема-терапия эффективна при хронических паттернах — это подтверждено рандомизированными исследованиями.
              </p>
            </div>
            <div className="bento-card" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px', transition: 'transform .25s, box-shadow .25s', cursor: 'default' }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', color: 'var(--text-faint)' }}>04</span>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--text)', margin: '12px 0 10px' }}>Долгосрочный результат</h3>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>
                Цель — изменить не симптом, а то, как человек воспринимает себя. Глубоко, но устойчиво.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DARK STATS ──────────────────────────────────────────────────── */}
      <section ref={statsRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ background: '#1c1916', padding: '80px 40px', color: '#eceae5' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {[
            { num: '4 000 ₽', label: 'Стоимость сессии', sub: '50 минут онлайн' },
            { num: '15 мин', label: 'Первая встреча', sub: 'Бесплатно · без обязательств' },
            { num: '1 на 1', label: 'Формат работы', sub: 'Индивидуальные сессии' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '48px 40px',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,.08)' : 'none',
            }}>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 400, lineHeight: 1, margin: '0 0 12px', letterSpacing: '-.02em', color: '#eceae5' }}>{s.num}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(236,234,229,.8)', margin: '0 0 6px' }}>{s.label}</p>
              <p style={{ fontSize: 14, color: 'rgba(236,234,229,.4)', margin: 0 }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCHEMALAB APP SECTION ────────────────────────────────────────── */}
      <section id="schemalab" ref={appRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Left: text */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 100, marginBottom: 24 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>СхемаЛаб</span>
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 4vw, 50px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-.01em' }}>
              Помоги себе сам.<br /><span style={{ fontStyle: 'italic' }}>Между сессиями.</span>
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 32px' }}>
              СхемаЛаб — бесплатное веб-приложение для самостоятельной работы в подходе схема-терапии. Ведите дневник состояний, отслеживайте потребности, делайте упражнения. Всё сохраняется — динамика всегда перед глазами.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="/login" style={{
                padding: '14px 28px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 100, fontSize: 15, fontWeight: 700,
                textDecoration: 'none', display: 'inline-block',
                boxShadow: '0 6px 24px rgba(99,89,220,.3)',
              }}>
                Попробовать бесплатно
              </a>
              <a href="https://t.me/SchemaLabBot" target="_blank" rel="noopener noreferrer" style={{
                padding: '14px 24px', background: 'transparent',
                border: '1.5px solid var(--line-strong)', borderRadius: 100,
                fontSize: 15, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none',
              }}>
                Telegram-бот
              </a>
            </div>
          </div>

          {/* Right: feature cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {APP_FEATURES.map((f, i) => (
              <div key={i} style={{
                background: i === 0 ? 'var(--accent)' : 'var(--bg-elev)',
                border: i === 0 ? 'none' : '1px solid var(--line)',
                borderRadius: 16, padding: '24px 20px',
                color: i === 0 ? 'white' : 'var(--text)',
                transition: 'transform .2s, box-shadow .2s',
                display: 'flex', flexDirection: 'column', gap: 10,
              }} className="bento-card">
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', opacity: i === 0 ? .7 : 1, color: i === 0 ? 'white' : 'var(--accent)' }}>{f.num}</span>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: i === 0 ? 'white' : 'var(--text)' }}>{f.title}</p>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: i === 0 ? 'rgba(255,255,255,.8)' : 'var(--text-sub)' }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PULL QUOTE ──────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 40px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ width: 3, height: 48, background: 'var(--accent)', borderRadius: 2, marginBottom: 28 }} />
          <blockquote style={{
            fontFamily: 'var(--serif)', fontSize: 'clamp(24px, 4vw, 40px)',
            fontWeight: 400, fontStyle: 'italic', lineHeight: 1.35,
            color: 'var(--text)', margin: 0, letterSpacing: '-.01em',
          }}>
            «Паттерны не приговор. Они появились как защита — и могут измениться, когда появляется безопасный контакт и понимание того, откуда они взялись.»
          </blockquote>
        </div>
      </section>

      {/* ── PRICES ──────────────────────────────────────────────────────── */}
      <section ref={priceRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Формат и цены</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 48px', letterSpacing: '-.01em' }}>
          Как устроена работа
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 24, padding: '40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Знакомство</span>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 52, fontWeight: 400, color: 'var(--text)', margin: '8px 0 0', letterSpacing: '-.02em', lineHeight: 1 }}>0 ₽</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['15 минут онлайн', 'Рассказываете о запросе', 'Я рассказываю о подходе', 'Никаких обязательств'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>
                  <span style={{ fontSize: 15, color: 'var(--text-sub)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={scrollToBooking} style={{
              padding: '14px 24px', background: 'transparent', border: '1.5px solid var(--line-strong)',
              borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--text)', cursor: 'pointer',
            }}>
              Записаться бесплатно
            </button>
          </div>
          <div style={{ background: 'var(--text)', border: '1px solid transparent', borderRadius: 24, padding: '40px', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, background: 'var(--accent)', padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, color: 'white' }}>
              Основной
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(236,234,229,.5)' }}>Сессия</span>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 52, fontWeight: 400, color: '#eceae5', margin: '8px 0 0', letterSpacing: '-.02em', lineHeight: 1 }}>4 000 ₽</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['50 минут онлайн (видео)', 'Индивидуальная работа', 'Схема-терапия', 'Регулярные встречи'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: 'rgba(144,137,224,1)', fontSize: 16 }}>✓</span>
                  <span style={{ fontSize: 15, color: 'rgba(236,234,229,.75)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={scrollToBooking} style={{
              padding: '14px 24px', background: 'var(--accent)', border: 'none',
              borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer',
            }}>
              Начать работу →
            </button>
          </div>
        </div>
      </section>

      {/* ── BOOKING ─────────────────────────────────────────────────────── */}
      <section ref={bookingRef as any} style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)' }}>
        <section ref={formRef as React.RefObject<HTMLElement>} className="reveal-section" style={{ maxWidth: 680, margin: '0 auto', padding: '80px 40px 96px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Запись</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-.01em' }}>
            Записаться<br /><span style={{ fontStyle: 'italic' }}>на первую встречу</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 40px' }}>
            Оставьте имя и контакт — свяжусь в течение дня, договоримся о времени.
          </p>
          <BookingForm />
        </section>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '32px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>© {new Date().getFullYear()} Григорий Котляревский</span>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/privacy" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Политика конфиденциальности</a>
            <a href="/offer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Оферта</a>
            <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Telegram</a>
            <a href="/login" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' }}>Войти в приложение</a>
          </div>
        </div>
      </footer>

      {/* ── Global styles ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes hero-in    { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:none } }
        @keyframes line-in    { from { transform:translateY(110%) } to { transform:none } }
        @keyframes blob-float { 0%,100% { transform:translate(0,0) scale(1) } 50% { transform:translate(3%,2%) scale(1.04) } }
        @keyframes scroll-bar { 0%,100% { opacity:.3; transform:scaleY(.6) } 50% { opacity:1; transform:scaleY(1) } }
        @keyframes marquee    { from { transform:translateX(0) } to { transform:translateX(-100%) } }
        @keyframes pulse-dot  { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.5; transform:scale(.7) } }

        .reveal-section { opacity:0; transform:translateY(32px); transition: opacity .7s ease, transform .7s ease; }
        .reveal-section.revealed { opacity:1; transform:none; }

        .bento-card:hover { transform:translateY(-4px); box-shadow:0 16px 48px rgba(28,25,20,.12); }

        input:focus, textarea:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 4px var(--accent-soft);
        }

        @media (max-width: 768px) {
          section[style*="grid-template-columns: 2fr 3fr"] > div { grid-template-columns: 1fr !important; }
          section[style*="repeat(3, 1fr)"] > div { grid-template-columns: 1fr !important; }
          section[style*="1fr 1fr"] > div { grid-template-columns: 1fr !important; }
          .bento-card[style*="grid-row"] { grid-row: auto !important; }
          .bento-card[style*="grid-column"] { grid-column: auto !important; }
        }
      `}</style>
    </div>
  );
}
