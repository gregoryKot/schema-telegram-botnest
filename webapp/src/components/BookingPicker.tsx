import { useState, useEffect, useRef } from 'react';
import { api, type BookingSlot, type SessionOption } from '../api';
import { BookingErrorNote } from './BookingErrorNote';
import { handleBookingFailure } from './bookingFailure';
import { leadSource } from '../utils/leadSource';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { trackBookingSubmit, trackGoal, trackGoalOnce } from '../lib/metrika';
import { useClientTimeZone } from './booking/useClientTimeZone';
import { WriteInsteadNote } from './booking/WriteInsteadNote';
import { IntroConfirmNotice } from './booking/IntroConfirmNotice';
import { ReturningVisitField } from './booking/ReturningVisitField';
import { FIELD_HINTS, type InvalidField } from './booking/fieldHints';
import { ContactChannelField } from './booking/ContactChannelField';
import type { ContactChannel } from '../../../shared/src/booking/contactChannel';
import { BookingSlotsSection } from './booking/BookingSlotsSection';
import { AwaitPaymentScreen, PaymentFailScreen, DoneScreen } from './booking/BookingResultScreens';
import { localDayLabel, localTimeLabel, submitTimeSuffix } from '../../../shared/src/booking/clientTimeZone';

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));

const field: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: 15, background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
  borderRadius: 'var(--r-12)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
};
const hintSt: React.CSSProperties = { fontSize: 12, color: 'var(--accent-red)', margin: '6px 0 0' };

/** Slot-based booking widget. Falls back to `fallback` when no slots are open; `onWriteInstead` — выход «напишите мне» под слотами. */
export function BookingPicker({ fallback, onWriteInstead }: { fallback?: React.ReactNode; onWriteInstead?: () => void }) {
  const [tz, setTz] = useClientTimeZone();
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('telegram');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(false); // переживает переключение формата: ответ на тот же текст
  const [returning, setReturning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'taken' | 'not_found' | 'payment_fail' | 'await_payment'>(() => {
    // Начальный статус выводится из ?payment= на маунте (lazy-init), а не через
    // setState в эффекте (react-hooks/set-state-in-effect). Чистка URL —
    // в эффекте ниже (побочный эффект).
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'ok') return 'done';
    if (p.get('payment') === 'fail') return 'payment_fail';
    return 'idle';
  });
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<SessionOption[]>([]);
  const [sessionType, setSessionType] = useState<'INTRO_15' | 'SESSION_50'>('INTRO_15');
  const [website, setWebsite] = useState(''); // honeypot — stays empty for humans
  const formFocused = useRef(false);
  const [invalidField, setInvalidField] = useState<InvalidField | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // Handle ?payment=ok / ?payment=fail redirect back from Robokassa
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'ok' || p.get('payment') === 'fail') {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    api.getSlots()
      .then((raw) => { const s = raw.filter((x, i) => raw.findIndex((y) => y.startsAt === x.startsAt) === i); /* дубли startsAt, инцидент 2026-09-29 */ setSlots(s); if (s.length) setDay(dayKey(s[0].startsAt)); })
      .catch(() => setLoadFailed(true));
    api.getBookingOptions().then(setOptions).catch(() => setLoadFailed(true)); // сбой ≠ пусто: без опций не собрать цену — та же loadFailed, что у слотов
  }, []);

  const chosen = options.find((o) => o.type === sessionType);

  // On a terminal screen (done / payment failed), scroll it into view — on mobile
  // the result renders above the submit button and was easy to miss.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'done' || status === 'payment_fail' || status === 'await_payment') {
      scrollIntoViewSafe(resultRef.current, { block: 'center' });
    }
  }, [status]);

  if (slots === null && !loadFailed) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 15, padding: '24px 0' }}>Загружаю свободное время…</p>;
  }
  // No availability configured (or load failed): keep the request channel open.
  if (loadFailed || slots!.length === 0) {
    return <>{fallback}</>;
  }

  if (status === 'await_payment') return <AwaitPaymentScreen resultRef={resultRef} slot={slot} tz={tz} chosen={chosen} payUrl={payUrl} />;
  if (status === 'payment_fail') return <PaymentFailScreen resultRef={resultRef} onRetry={() => setStatus('idle')} />;
  if (status === 'done') return (
    <DoneScreen
      resultRef={resultRef} slot={slot} tz={tz} cancelled={cancelled} meetingUrl={meetingUrl} cancelToken={cancelToken}
      sessionType={sessionType} onCancelled={() => setCancelled(true)}
    />
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    trackGoalOnce('booking_submit_click');
    if (!slot) return; // форма скрыта без выбранного слота — сюда не дойти
    const needConfirm = sessionType === 'INTRO_15' && !confirmNotice;
    const missing: InvalidField | null = !name.trim() ? 'name' : !contact.trim() ? 'contact' : needConfirm ? 'confirmNotice' : !consent ? 'consent' : null;
    if (missing) {
      trackGoal('booking_error', { reason: 'validation', field: missing });
      setInvalidField(missing);
      ({ name: nameRef, contact: contactRef, confirmNotice: confirmRef, consent: consentRef })[missing].current?.focus();
      return;
    }
    setInvalidField(null);
    setStatus('loading');
    try {
      const res = await api.bookSlot({
        startsAt: slot.startsAt, durationMin: slot.durationMin, type: sessionType,
        clientName: name.trim(), clientContact: contact.trim(), message: message.trim() || undefined,
        returning: sessionType === 'SESSION_50' && returning, acceptedOffer: consent, website, source: leadSource(), clientTimeZone: tz, clientChannel: channel,
      });
      setCancelToken(res.cancelToken);
      trackBookingSubmit(sessionType);
      if (res.paymentUrl) {
        // Paid session: show a "reserved, go to pay" screen first (so the client
        // always sees the booking is registered even if Robokassa fails), then
        // they tap through to payment.
        setPayUrl(res.paymentUrl);
        setStatus('await_payment');
        return;
      }
      setMeetingUrl(res.meetingUrl ?? null);
      setStatus('done');
    } catch (err) {
      trackGoal('booking_error', { reason: 'server' });
      setStatus(handleBookingFailure(err));
    }
  };

  const onFieldFocus = () => {
    if (!formFocused.current) {
      formFocused.current = true;
      trackGoalOnce('booking_form_focus');
    }
  };

  return (
    // noValidate: поля несут `required` для скринридеров/семантики, но
    // нативная HTML5-валидация браузера должна её не блокировать сабмит
    // молча (без наших trackGoal/подсказок) — обработчик submit сам решает,
    // что показать и куда поставить фокус.
    <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {options.length > 1 && (
        <div>
          <div style={labelSt}>Формат встречи</div>
          <div style={{ display: 'flex', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
            {options.map((o) => {
              const active = o.type === sessionType;
              return (
                <button key={o.type} type="button" onClick={() => {
                  setSessionType(o.type);
                  if (o.type === 'INTRO_15') { setReturning(false); if (status === 'not_found') setStatus('idle'); } // знакомство — всегда первая встреча
                  trackGoalOnce('booking_format', { format: o.type === 'SESSION_50' ? 'session' : 'intro' });
                }} style={{
                  flex: '1 1 180px', textAlign: 'left', padding: '14px 16px', cursor: 'pointer',
                  borderRadius: 'var(--r-12)', fontFamily: 'inherit', transition: 'all .15s',
                  background: active ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}>
                  <div className="u-h15">
                    {o.label} {o.price > 0 ? `· ${o.price.toLocaleString('ru-RU')} ₽` : '· бесплатно'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 2 }}>{o.note}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <BookingSlotsSection
        slots={slots!} tz={tz} onTzChange={setTz}
        day={day} onDayChange={setDay}
        slot={slot} onSlotChange={setSlot}
      />
      {!slot && onWriteInstead && <WriteInsteadNote onClick={() => { trackGoal('booking_write_instead'); onWriteInstead(); }} />}

      {slot && (
        <>
          <div className="form-grid">
            {/* ym-disable-keys: Вебвизор (визитка, см. metrika.ts shouldRecordSession)
                не пишет ввод в этих полях — имя и контакт клиента. */}
            <div>
              <label style={labelSt} htmlFor="bp-name">Имя *</label>
              <input
                id="bp-name" ref={nameRef} className="ym-disable-keys" style={field} placeholder="Ваше имя"
                value={name} onChange={(e) => { setName(e.target.value); if (invalidField === 'name') setInvalidField(null); }}
                onFocus={onFieldFocus} required maxLength={100}
                aria-invalid={invalidField === 'name' || undefined}
                aria-describedby={invalidField === 'name' ? 'bp-name-hint' : undefined}
              />
              {invalidField === 'name' && <p id="bp-name-hint" style={hintSt}>{FIELD_HINTS.name}</p>}
            </div>
            <ContactChannelField
              id="bp-contact" channel={channel} onChannelChange={setChannel} inputRef={contactRef} onFocus={onFieldFocus}
              value={contact} onChange={(v) => { setContact(v); if (invalidField === 'contact') setInvalidField(null); }}
              invalid={invalidField === 'contact'} hint={invalidField === 'contact' ? FIELD_HINTS.contact : null}
              labelStyle={labelSt} fieldStyle={field}
            />
          </div>
          {sessionType === 'INTRO_15' && (
            <IntroConfirmNotice
              checked={confirmNotice} invalid={invalidField === 'confirmNotice'} inputRef={confirmRef}
              onChange={(v) => { setConfirmNotice(v); if (invalidField === 'confirmNotice') setInvalidField(null); }}
            />
          )}
          {/* Honeypot: hidden from users, bots tend to fill it → server rejects */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}
            aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
          {sessionType === 'SESSION_50' && (
            <ReturningVisitField returning={returning} onChange={(v) => { setReturning(v); if (status === 'not_found') setStatus('idle'); }} />
          )}
          <div>
            <label style={labelSt} htmlFor="bp-message">Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
            <textarea id="bp-message" className="ym-disable-keys" style={{ ...field, resize: 'vertical', minHeight: 84 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', cursor: 'pointer' }}>
            <input
              type="checkbox" ref={consentRef} checked={consent}
              onChange={(e) => { setConsent(e.target.checked); if (invalidField === 'consent') setInvalidField(null); }}
              style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }}
              aria-invalid={invalidField === 'consent' || undefined}
              aria-describedby={invalidField === 'consent' ? 'bp-consent-hint' : undefined}
            />
            <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Я принимаю условия <a href="/offer" target="_blank" className="u-link">Публичной оферты</a>{chosen && chosen.price > 0 ? ' (договора оказания услуг)' : ''} и <a href="/privacy" target="_blank" className="u-link">Политики конфиденциальности</a>, даю согласие на обработку данных
            </span>
          </label>
          {invalidField === 'consent' && <p id="bp-consent-hint" style={{ ...hintSt, margin: '-8px 0 0' }}>{FIELD_HINTS.consent}</p>}
          {sessionType === 'SESSION_50' && status === 'not_found' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>Не нашёл вас по этому контакту. Проверьте, что ввели тот же Telegram или телефон, что и в прошлый раз. Если занимаетесь впервые — снимите галочку «повторная встреча».</p>}
          {(status === 'error' || status === 'taken') && <BookingErrorNote kind={status} />}
          {chosen && chosen.price > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '-8px 0 0' }}>
              {localDayLabel(slot.startsAt, tz)}, {localTimeLabel(slot.startsAt, tz)} {submitTimeSuffix(tz)}
            </p>
          )}
          <button type="submit" disabled={status === 'loading'}
            style={{
              alignSelf: 'flex-start', padding: '15px 30px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-12)',
              cursor: status === 'loading' ? 'default' : 'pointer',
              opacity: status === 'loading' ? 0.4 : (!name.trim() || !contact.trim() || !consent || (sessionType === 'INTRO_15' && !confirmNotice)) ? 0.7 : 1,
            }}>
            {status === 'loading'
              ? (chosen && chosen.price > 0 ? 'Перехожу к оплате…' : 'Бронирую…')
              : chosen && chosen.price > 0
                ? `Оплатить ${chosen.price.toLocaleString('ru-RU')} ₽ и записаться →`
                : `Записаться на ${localDayLabel(slot.startsAt, tz).toLowerCase()}, ${localTimeLabel(slot.startsAt, tz)} ${submitTimeSuffix(tz)} →`}
          </button>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>
            {chosen && chosen.price > 0
              ? 'Оплата картой или СБП через Robokassa. Чек придёт автоматически.'
              : 'Первая встреча 15 минут — бесплатно. Никаких обязательств.'}
          </p>
        </>
      )}
    </form>
  );
}
