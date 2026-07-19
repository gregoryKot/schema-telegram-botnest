import { useState } from 'react';
import { api } from '../../api';
import { Btn } from '../../components/landing-kit';
import { TG_URL } from './constants';

// ─── Booking form (fallback when slot picker unavailable) ────────────────────
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
        <div><label htmlFor="booking-name" style={labelSt}>Имя *</label><input id="booking-name" style={field} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></div>
        <div><label htmlFor="booking-contact" style={labelSt}>Telegram / телефон *</label><input id="booking-contact" style={field} placeholder="@username или телефон" value={contact} onChange={e => setContact(e.target.value)} required maxLength={100} /></div>
      </div>
      <div>
        <label htmlFor="booking-message" style={labelSt}>Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
        <textarea id="booking-message" style={{ ...field, resize: 'vertical', minHeight: 96 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={e => setMessage(e.target.value)} maxLength={500} />
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
