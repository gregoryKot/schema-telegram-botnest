import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { BookingPicker } from '../components/BookingPicker';

// ─── Design tokens (local to landing) ────────────────────────────────────────
const R = { pill: 100, card: 24, btn: 12, badge: 14 } as const;          // radius
const MOSS = '#4a6335';        // green status (passes WCAG AA on paper bg)
const DARK_BG = '#1c1916';     // intentional always-dark sections
const INK_ON_DARK = '#eceae5'; // text on dark sections
const TG_URL = 'https://t.me/kotlarewski';

// Hamburger button (mobile nav trigger) – shown only via .menu-btn CSS
const menuBtnStyle: React.CSSProperties = {
  display: 'none', flexDirection: 'column', justifyContent: 'center', gap: 4,
  width: 38, height: 38, borderRadius: 9, border: '1px solid var(--line)',
  background: 'transparent', cursor: 'pointer', padding: 0, alignItems: 'center',
};
const burgerLine: React.CSSProperties = { width: 16, height: 1.6, background: 'var(--text)', borderRadius: 2, display: 'block' };

// ─── Button – single source for all CTAs ─────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'dark';
type BtnSize = 'sm' | 'md' | 'lg';
const BTN_PAD: Record<BtnSize, string> = { sm: '8px 18px', md: '13px 24px', lg: '15px 30px' };
const BTN_FS:  Record<BtnSize, number> = { sm: 13, md: 14, lg: 15 };

function Btn({
  children, variant = 'primary', size = 'md', radius = 'pill',
  href, onClick, type = 'button', full = false, disabled = false, style, newTab,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  radius?: 'pill' | 'btn';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  full?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  /** Override new-tab behaviour. Defaults to true for http links, false for relative. */
  newTab?: boolean;
}) {
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 28px rgba(77,71,153,.28)' },
    ghost:   { background: 'transparent', borderColor: 'var(--line-strong)', color: 'var(--text-sub)', fontWeight: 500 },
    dark:    { background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.2)', color: INK_ON_DARK },
  };
  const css: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: BTN_PAD[size], fontSize: BTN_FS[size], fontWeight: 700, fontFamily: 'inherit',
    borderRadius: radius === 'pill' ? R.pill : R.btn,
    border: '1.5px solid transparent', boxSizing: 'border-box',
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, opacity: disabled ? 0.4 : 1,
    transition: 'transform .15s, box-shadow .15s, background .15s, border-color .15s, color .15s',
    ...variants[variant], ...style,
  };
  const enter = (e: React.MouseEvent) => {
    if (disabled) return;
    const el = e.currentTarget as HTMLElement;
    if (variant === 'primary') { el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 40px rgba(77,71,153,.4)'; }
    else if (variant === 'ghost') { el.style.borderColor = 'var(--text)'; el.style.color = 'var(--text)'; }
    else { el.style.background = 'rgba(255,255,255,.18)'; }
  };
  const leave = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transform = '';
    el.style.boxShadow = variant === 'primary' ? '0 8px 28px rgba(77,71,153,.28)' : '';
    if (variant === 'ghost') { el.style.borderColor = 'var(--line-strong)'; el.style.color = 'var(--text-sub)'; }
    if (variant === 'dark') { el.style.background = 'rgba(255,255,255,.1)'; }
  };
  if (href) {
    const ext = href.startsWith('http');
    const openNewTab = newTab !== undefined ? newTab : ext;
    return <a href={href} target={openNewTab ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined}
      style={css} onMouseEnter={enter} onMouseLeave={leave}>{children}</a>;
  }
  return <button type={type} onClick={onClick} disabled={disabled} style={css} onMouseEnter={enter} onMouseLeave={leave}>{children}</button>;
}

// ─── Telegram link – quiet editorial text link (matches nav "Написать ↗") ────
function TgLink({ label, size = 'sm', style }: { label: string; size?: 'lg' | 'sm'; style?: React.CSSProperties }) {
  const lg = size === 'lg';
  return (
    <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontSize: lg ? 15 : 14, fontWeight: 600, fontFamily: 'inherit',
      color: 'var(--text-sub)', textDecoration: 'none',
      transition: 'color .15s', ...style,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
      <svg width={lg ? 16 : 14} height={lg ? 16 : 14} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ opacity: .7 }}><path d="M11.944 0A12 12 0 1 0 24 12 12 12 0 0 0 11.944 0ZM18.33 7.67l-2.3 10.84c-.165.73-.6.91-1.22.57l-3.36-2.47-1.62 1.56a.85.85 0 0 1-.68.33l.24-3.4 6.2-5.6c.27-.24-.06-.37-.41-.13L6.27 13.9 3 13.01c-.73-.2-.74-.73.15-1.08l13.93-5.37c.61-.22 1.14.15.95 1.11Z"/></svg>
      {label}
    </a>
  );
}

// ─── Theme toggle icon – crisp sun/moon (no unicode glyph rendering issues) ──
function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// ─── Section nav – compact desktop set (≤5 per 2026 nav guidance) ─────────────
const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Обо мне', href: '#about' },
  { label: 'Подход',  href: '#approach' },
  { label: 'Цены',    href: '#prices' },
  { label: 'Запись',  href: '#booking' },
  { label: 'Вопросы', href: '#faq' },
];

function SectionNav({ className, color = 'var(--text-sub)', active = '' }: { className?: string; color?: string; active?: string }) {
  return (
    <nav className={className} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {NAV_LINKS.map(l => {
        const isActive = active === l.href.slice(1);
        return (
          <a key={l.href} href={l.href}
            style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--accent)' : color, textDecoration: 'none', padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap', transition: 'color .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isActive ? 'var(--accent)' : color; }}>
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}

// ─── Mobile menu – fullscreen overlay (uses useHistorySheet per project rule) ─
// Fuller list than the compact desktop nav – the dedicated menu has room.
const MOBILE_LINKS: { label: string; href: string }[] = [
  { label: 'Обо мне',      href: '#about' },
  { label: 'С чем работаю', href: '#work' },
  { label: 'Подход',       href: '#approach' },
  { label: 'Как начать',   href: '#process' },
  { label: 'Цены',         href: '#prices' },
  { label: 'Запись',       href: '#booking' },
  { label: 'Всё по схеме', href: '#app' },
  { label: 'Вопросы',      href: '#faq' },
  { label: 'Отзывы',       href: '/reviews' },
  { label: 'Статьи',       href: '/articles' },
];

function MobileMenu({ onClose, active, onBook }: { onClose: () => void; active: string; onBook: () => void }) {
  const goBack = useHistorySheet(onClose);
  const go = (href: string) => {
    if (href.startsWith('#')) {
      goBack();
      setTimeout(() => document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      window.location.href = href;
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Меню" style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', padding: '20px 24px calc(28px + env(safe-area-inset-bottom,0px))',
      animation: 'menu-in .28s cubic-bezier(.16,1,.3,1) both',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>Меню</span>
        <button onClick={goBack} aria-label="Закрыть меню" style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {MOBILE_LINKS.map((l, i) => {
          const isActive = active === l.href.slice(1);
          return (
            <button key={l.href} onClick={() => go(l.href)} style={{
              textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
              padding: '16px 0', borderBottom: i === MOBILE_LINKS.length - 1 ? 'none' : '1px solid var(--line)',
              fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
              color: isActive ? 'var(--accent)' : 'var(--text)',
              fontStyle: isActive ? 'italic' : 'normal',
              display: 'flex', alignItems: 'center', gap: 12,
              animation: `menu-item-in .32s cubic-bezier(.16,1,.3,1) ${i * 35}ms both`,
            }}>
              {isActive && <span aria-hidden style={{ width: 3, height: 22, borderRadius: 2, background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />}
              {l.label}
            </button>
          );
        })}
      </nav>
      <div style={{ animation: `menu-item-in .32s cubic-bezier(.16,1,.3,1) ${MOBILE_LINKS.length * 35}ms both` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', marginBottom: 12, borderTop: '1px solid var(--line)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOSS, flexShrink: 0, display: 'inline-block', animation: 'pulse-dot 2.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Принимаю клиентов · </span>
          <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>@kotlarewski</a>
        </div>
        <Btn full size="lg" radius="btn" onClick={() => { goBack(); setTimeout(onBook, 60); }}>Записаться на знакомство →</Btn>
      </div>
    </div>
  );
}

// ─── Scroll reveal – IntersectionObserver with deep-link / in-view failsafe ──
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Failsafe: if we loaded via a hash (deep link jumps past sections) or the
    // section is already on screen, reveal now. Otherwise the observer's first
    // callback can fail to arrive until the user scrolls, leaving content hidden.
    const r = el.getBoundingClientRect();
    if (window.location.hash || (r.top < window.innerHeight && r.bottom > 0)) {
      el.classList.add('revealed');
      return;
    }
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

// ─── Marquee strips – two different sets ─────────────────────────────────────
const TOPICS_A: { label: string; href: string }[] = [
  { label: 'Схема-терапия',       href: '#approach' },
  { label: 'Паттерны',            href: '#approach' },
  { label: 'Отношения',           href: '#booking'  },
  { label: 'Самооценка',          href: '#booking'  },
  { label: 'Тревога',             href: '#booking'  },
  { label: 'Идентичность',        href: '#approach' },
  { label: 'КПТ',                 href: '#approach' },
  { label: 'Бесплатное знакомство', href: '#booking' },
  { label: 'Онлайн-сессии',       href: '#prices'  },
  { label: 'Отзывы',              href: '/reviews' },
];
const TOPICS_B: { label: string; href: string }[] = [
  { label: 'Безопасная среда',         href: '#about'    },
  { label: 'Глубинная работа',         href: '#approach' },
  { label: 'Ранние убеждения',         href: '#approach' },
  { label: 'Режимы и схемы',           href: '#approach' },
  { label: 'Устойчивые изменения',     href: '#approach' },
  { label: 'Первая встреча бесплатно', href: '#booking'  },
  { label: 'Доказательный метод',      href: '#approach' },
  { label: 'Индивидуально',            href: '#prices'   },
  { label: 'Работаю онлайн',           href: '#prices'   },
  { label: 'Почему нет отзывов',       href: '/reviews' },
];

function MarqueeStrip({ reverse = false, bg = 'var(--bg-rail)', italic = false, topics = TOPICS_A }: {
  reverse?: boolean; bg?: string; italic?: boolean; topics?: typeof TOPICS_A;
}) {
  const dur = reverse ? '40s' : '32s';
  const anim = reverse ? 'marquee-rev' : 'marquee-fwd';
  return (
    <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', overflow: 'hidden', padding: '14px 0', background: bg }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>
        {[0, 1, 2].map(i => (
          <span key={i} aria-hidden={i > 0} style={{ display: 'inline-flex', flexShrink: 0, animation: `${anim} ${dur} linear infinite` }}>
            {topics.map(w => (
              <a key={w.label} href={w.href} tabIndex={i > 0 ? -1 : undefined}
                style={{ fontSize: 14, fontWeight: 500, fontStyle: italic ? 'italic' : 'normal', color: 'var(--text-sub)', padding: '8px 20px', textDecoration: 'none', transition: 'color .15s', display: 'inline-flex', alignItems: 'center' }}
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
      (window as Window & { ym?: (...a: unknown[]) => void }).ym?.(109568051, 'reachGoal', 'booking_submit');
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
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7 }}>Свяжусь с вами в течение дня – обсудим время для знакомства. Если написали вечером, отвечу утром.</p>
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-grid">
        <div><label style={labelSt}>Имя *</label><input style={field} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></div>
        <div><label style={labelSt}>Telegram / телефон *</label><input style={field} placeholder="@username или телефон" value={contact} onChange={e => setContact(e.target.value)} required maxLength={100} /></div>
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
      {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>Что-то не отправилось. Напишите мне напрямую в Telegram – отвечу лично: <a href={TG_URL} style={{ color: 'inherit' }}>@kotlarewski</a></p>}
      <Btn type="submit" size="lg" radius="btn" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent} style={{ alignSelf: 'flex-start' }}>
        {status === 'loading' ? 'Отправляю…' : 'Записаться на знакомство →'}
      </Btn>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Первая встреча 15 минут – бесплатно. Никаких обязательств.</p>
    </form>
  );
}

// ─── Education ───────────────────────────────────────────────────────────────
const EDUCATION: { year: string; title: string; place: string; placeUrl?: string; note: string }[] = [
  {
    year: 'с 2024',
    title: 'Психология · бакалавриат',
    place: 'Московский институт психоанализа',
    placeUrl: 'https://inpsycho.ru',
    note: 'профиль «Психотерапия качества жизни»',
  },
  {
    year: '2025',
    title: 'Схема-терапия',
    place: 'Базовый курс «Практик схема-терапии»',
    placeUrl: 'https://psylaz.ru/pst/',
    note: '47 часов · преп. М. А. Лазарев',
  },
  {
    year: '2025–26',
    title: 'Когнитивно-поведенческая терапия',
    place: 'МАНП',
    placeUrl: 'https://manp.academy/',
    note: 'расширенный курс, 288 часов · преп. Юлия Горячева, президент АДБТ',
  },
  {
    year: '2026',
    title: 'Майндфулнесс и медитация',
    place: 'Школа Осознанности',
    placeUrl: 'https://mindfulness-school.ru',
    note: 'инструкторская программа MMTTP, 275 часов · в процессе',
  },
];

// ─── Work themes (что приносят на сессии) ────────────────────────────────────
const WORK_THEMES: { title: string; text: string }[] = [
  { title: 'Отношения', text: 'Снова и снова один сценарий: выбираю недоступных, боюсь близости, растворяюсь в партнёре или держу всех на расстоянии.' },
  { title: 'Самооценка', text: 'Внутренний критик, ощущение «со мной что-то не так», обесценивание своих успехов, перфекционизм, который не даёт выдохнуть.' },
  { title: 'Тревога и контроль', text: 'Хроническое напряжение, тревога о будущем, гиперконтроль и невозможность просто расслабиться и быть.' },
  { title: 'Чувства', text: 'Эмоции будто отключены – или, наоборот, захлёстывают. Трудно понять, что я чувствую и что с этим делать.' },
  { title: 'Идентичность', text: '«Кто я и чего хочу на самом деле» – за чужими ожиданиями и ролями потерялся собственный голос.' },
  { title: 'Повторяющиеся паттерны', text: 'Понимаю умом, но всё равно наступаю на те же грабли. Хочу добраться до корня, а не бороться с симптомом.' },
];

// ─── Boundaries (когда нужен другой специалист) ──────────────────────────────
const BOUNDARIES: string[] = [
  'Острое состояние, мысли о причинении вреда себе, самоповреждение – это повод за неотложной помощью, а не за консультацией.',
  'Подозрение на психическое расстройство (тяжёлая депрессия, биполярное, РПП, психоз) – нужна диагностика и, возможно, медикаменты у врача-психиатра.',
  'Зависимости (алкоголь, ПАВ) – здесь эффективнее профильная помощь.',
];

// ─── Trust (этика и качество практики) ───────────────────────────────────────
const TRUST: { title: string; text: string }[] = [
  { title: 'Работаю под супервизией', text: 'Регулярно разбираю свою работу с супервизором. Это профессиональная норма и гарантия, что метод применяется корректно и в ваших интересах.' },
  { title: 'Личная терапия с 2021 года', text: 'Сам постоянно в личной терапии – для меня это часть профессиональной гигиены и условие, без которого не берусь сопровождать других.' },
  { title: 'Конфиденциальность', text: 'Всё, что вы рассказываете, остаётся между нами. Поэтому на сайте нет отзывов клиентов – это вопрос этики, а не отсутствия практики.' },
];

// ─── App features ─────────────────────────────────────────────────────────────
const APP_FEATURES = [
  { num: '01', title: 'Дневник состояний', text: 'Каждый день – короткая оценка восьми базовых потребностей. Появляется картина того, что происходит.' },
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
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: accent ? 28 : 21, fontWeight: 400, lineHeight: 1.2, margin: 0, color: accent ? 'white' : 'var(--text)', whiteSpace: 'pre-line' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, opacity: accent ? .85 : 1, color: accent ? 'white' : 'var(--text-sub)' }}>{text}</p>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Что такое схема-терапия?',
    a: 'Схема-терапия – доказательный интегративный метод, разработанный Джеффри Янгом. Он объединяет элементы КПТ, психоанализа, гештальт-терапии и теории привязанности и работает с глубинными убеждениями (схемами), которые формируются в детстве и управляют нашими реакциями во взрослом возрасте. Особенно эффективна при хронических, повторяющихся трудностях в отношениях, самооценке и эмоциональной регуляции – это подтверждено рандомизированными клиническими исследованиями.',
  },
  {
    q: 'Кому подходит схема-терапия?',
    a: 'Тем, кто замечает повторяющиеся паттерны – в отношениях, самооценке, тревоге, хронической неудовлетворённости. Она особенно эффективна, когда «поверхностная» работа не давала устойчивого результата, и когда хочется понять глубинные причины реакций, а не только снять симптом.',
  },
  {
    q: 'Как проходит онлайн-сессия?',
    a: 'Видеозвонок (Zoom или Google Meet), 50 минут. Нужны стабильный интернет, камера и микрофон. Вы находитесь там, где вам комфортно – качество работы от формата не зависит. Дата и время согласовываются в Telegram.',
  },
  {
    q: 'Сколько стоит и как оплатить?',
    a: 'Вводная встреча (15 минут) – бесплатно. Каждая следующая сессия (50 минут) – {PRICE} ₽. Оплата картой или СБП при записи. После оплаты вы получаете чек самозанятого через приложение «Мой налог».',
  },
  {
    q: 'Это то же самое, что психотерапия?',
    a: 'Нет. Психологическое консультирование – отдельный вид помощи, не требующий медицинского образования и лицензии. Это не медицинская психотерапия по ФЗ-323. Если у вас есть симптомы психического расстройства – я порекомендую обратиться к врачу-психиатру или психотерапевту с медицинским дипломом.',
  },
  {
    q: 'Что такое «Всё по схеме» и зачем оно нужно?',
    a: '«Всё по схеме» – бесплатное веб-приложение, которое я создал для самостоятельной работы между сессиями. Дневник состояний, диагностика схем (тест ЯСО), упражнения из схема-терапии и КПТ, отслеживание динамики. Работает в браузере и через Telegram-бот @SchemaLabBot.',
  },
];

function FaqList({ price }: { price: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderTop: '1px solid var(--line)', borderBottom: i === FAQ_ITEMS.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 16, padding: '22px 0', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', transition: 'opacity .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{item.q}</span>
              <span style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                background: isOpen ? 'var(--accent)' : 'rgba(var(--fg-rgb),.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: isOpen ? 'white' : 'var(--text-sub)',
                transition: 'background .2s, transform .2s',
                transform: isOpen ? 'rotate(45deg)' : 'none',
              }}>+</span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .32s ease', overflow: 'hidden' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 22px', maxWidth: 660 }}>
                  {item.a.replace('{PRICE}', price)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('app_theme') === 'dark' ? 'dark' : 'light';
  });
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    localStorage.setItem('app_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }, [theme]);
  return { theme, toggle };
}

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
      <section id="booking" ref={bookingRef as any} style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)' }}>
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
                <Btn variant="ghost" href="https://t.me/SchemaLabBot">Telegram-бот</Btn>
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
      <style>{`
        html { scroll-behavior: smooth; }

        /* Sections already carry 64–88px of top padding which clears the
           58px sticky bar; only a small margin is needed so the heading
           isn't flush against the bar. */
        section[id] { scroll-margin-top: 12px; }

        /* Section nav (desktop) ⇄ hamburger (mobile/tablet) */
        .sticky-nav, .hero-nav { display: flex; }
        .menu-btn { display: none !important; }
        @media (max-width: 1200px) {
          .sticky-nav, .hero-nav { display: none !important; }
          .menu-btn { display: flex !important; }
          .desktop-inline { display: none !important; }
          .nav-tg { display: none !important; }
        }
        @keyframes menu-in      { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes menu-item-in { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }

        /* Respect reduced-motion: kill looping/entrance animation, keep content visible */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .15s !important;
            scroll-behavior: auto !important;
          }
          .reveal-section { opacity: 1 !important; transform: none !important; }
        }

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
        .hero-wrap    { max-width:1100px; width:100%; margin:0 auto; padding:0 40px; display:flex; flex-direction:column; justify-content:space-between; min-height:100dvh; box-sizing:border-box; }
        @media (max-height:820px) {
          .hero-h1   { font-size:clamp(36px, 7vh, 80px) !important; }
          .hero-wrap { min-height:100dvh; }
        }


        /* Grids */
        .about-inner  { display:grid; grid-template-columns:2fr 3fr; gap:48px; align-items:start; }
        .bento-grid   { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:auto auto; gap:16px; }
        .bento-tall   { grid-row:1/3; }
        .bento-wide   { grid-column:2/4; }
        .process-grid { display:grid; grid-template-columns:repeat(3,1fr); }
        .price-grid   { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .app-grid     { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; }
        .form-grid    { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .edu-grid     { display:grid; grid-template-columns:1fr 2fr; gap:60px; align-items:start; }
        .work-grid    { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .trust-grid   { display:grid; grid-template-columns:repeat(3,1fr); gap:40px; }
        .bound-grid   { display:grid; grid-template-columns:1fr 1.2fr; gap:48px; align-items:start; }

        input:focus, textarea:focus { border-color:var(--accent) !important; box-shadow:0 0 0 4px var(--accent-soft); }

        @media (max-width:600px) {
          .nav-tg     { font-size:12px; }
        }

        @media (max-width:900px) {
          .about-inner  { grid-template-columns:1fr; }
          .bento-grid   { grid-template-columns:1fr; }
          .bento-tall   { grid-row:auto; }
          .bento-wide   { grid-column:auto; }
          .process-grid { grid-template-columns:1fr; gap:32px; }
          .process-grid > div { border-left:none !important; padding:0 !important; }
          .price-grid   { grid-template-columns:1fr; }
          .app-grid     { grid-template-columns:1fr; }
          .edu-grid     { grid-template-columns:1fr; gap:28px; }
          .work-grid    { grid-template-columns:1fr; }
          .trust-grid   { grid-template-columns:1fr; gap:32px; }
          .bound-grid   { grid-template-columns:1fr; gap:28px; }
        }
        @media (min-width:601px) and (max-width:900px) {
          .work-grid    { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:600px) {
          .form-grid  { grid-template-columns:1fr; }
          .hero-wrap, section, footer { padding-left:20px !important; padding-right:20px !important; }
        }
      `}</style>
    </div>
  );
}
