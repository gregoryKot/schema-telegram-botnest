import { useState } from 'react';
import { api, reportClientError } from '../../api';
import { Btn } from '../../components/landing-kit';
import { leadSource } from '../../utils/leadSource';
import { TG_URL } from './constants';
import { trackGoal } from '../../lib/metrika';
import { ContactChannelField } from '../../components/booking/ContactChannelField';
import { RequestField } from '../../components/booking/RequestField';
import { BookingCrisisNote } from '../../components/booking/BookingCrisisNote';
import type { ContactChannel } from '../../../../shared/src/booking/contactChannel';
import { BOOKING_MESSAGE_MAX, BOOKING_NAME_MAX } from '../../../../shared/src/limits/textLimits';
// ─── Простая заявка «напишите мне» — основной путь записи на визитке ─────────
export function BookingForm() {
  const [name, setName]       = useState('');
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('telegram');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !consent) return;
    setStatus('loading');
    try {
      await api.submitBooking({ name: name.trim(), contact: contact.trim(), message: message.trim() || undefined, source: leadSource(), channel });
      setStatus('done');
      trackGoal('booking_submit'); trackGoal('lead_submit', { channel }); // booking_submit — все заявки; lead_submit — только простая форма (слоты: booking_intro/session)
    } catch (err) { const st = (err as { status?: number } | null)?.status; reportClientError({ message: `lead submit failed: ${st ? `HTTP ${st}` : String(err)}`, section: 'booking' }); setStatus('error'); } // №14: тупик сообщает наверх
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '14px 16px', fontSize: 15, background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
    borderRadius: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
  };
  const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 };

  if (status === 'done') return (
    <div style={{ textAlign: 'center', padding: '56px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>✉️</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Заявка отправлена</h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7 }}>Свяжусь с вами в течение дня – обсудим время для знакомства. Если написали вечером, отвечу утром.</p>
      <BookingCrisisNote text={message} />
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-grid">
        <div><label htmlFor="booking-name" style={labelSt}>Имя *</label><input id="booking-name" className="ym-disable-keys" style={field} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} required maxLength={BOOKING_NAME_MAX} /></div>
        <ContactChannelField id="booking-contact" channel={channel} onChannelChange={setChannel} value={contact} onChange={setContact} labelStyle={labelSt} fieldStyle={field} />
      </div>
      <RequestField value={message} onChange={setMessage} labelStyle={labelSt} fieldStyle={field} minHeight={96} max={BOOKING_MESSAGE_MAX} />
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
        <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Я принимаю{' '}<a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Политику конфиденциальности</a>{' '}и даю согласие на обработку данных
        </span>
      </label>
      {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>Что-то не отправилось. Напишите мне напрямую в Telegram – отвечу лично: <a href={TG_URL} style={{ color: 'inherit' }}>@kotlarewski</a></p>}
      <Btn type="submit" size="lg" radius="btn" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent} style={{ alignSelf: 'flex-start' }}>
        {status === 'loading' ? 'Отправляю…' : 'Написать →'}
      </Btn>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Первая встреча 15 минут – бесплатно. Никаких обязательств.</p>
    </form>
  );
}
