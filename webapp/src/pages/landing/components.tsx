import { useState } from 'react';
import { api } from '../../api';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { Btn, useTilt } from '../../components/landing-kit';
import {
  MOSS, TG_URL, NAV_LINKS, MOBILE_LINKS, TOPICS_A, APP_FEATURES, FAQ_ITEMS,
} from './data';

// ─── Telegram link – quiet editorial text link (matches nav "Написать ↗") ────
export function TgLink({ label, size = 'sm', style }: { label: string; size?: 'lg' | 'sm'; style?: React.CSSProperties }) {
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

export function SectionNav({ className, color = 'var(--text-sub)', active = '' }: { className?: string; color?: string; active?: string }) {
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

export function MobileMenu({ onClose, active, onBook }: { onClose: () => void; active: string; onBook: () => void }) {
  const goBack = useHistorySheet(onClose);
  const go = (href: string) => {
    if (href.startsWith('#')) {
      goBack();
      setTimeout(() => document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      // eslint-disable-next-line react-hooks/immutability -- редирект вне React-состояния, паттерн намеренный
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

export function MarqueeStrip({ reverse = false, bg = 'var(--bg-rail)', italic = false, topics = TOPICS_A }: {
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
export function BookingForm() {
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

// ─── App feature card (needs own component for useTilt hook) ─────────────────
export function AppFeatureCard({ f, accent }: { f: typeof APP_FEATURES[0]; accent: boolean }) {
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
export function BentoCard({ num, title, text, accent = false }: { num: string; title: string; text: string; accent?: boolean }) {
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

export function FaqList({ price }: { price: string }) {
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
