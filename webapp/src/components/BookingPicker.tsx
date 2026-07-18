import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import type { BookingSlot, SessionOption } from '../api';

const MSK = 'Europe/Moscow';
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: MSK, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayLblFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt   = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, hour: '2-digit', minute: '2-digit' });

const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
const timeLabel = (iso: string) => timeFmt.format(new Date(iso));

function dayLabel(iso: string): string {
  const todayKey = dayKeyFmt.format(new Date());
  const tomorrowKey = dayKeyFmt.format(new Date(Date.now() + 86_400_000));
  const k = dayKey(iso);
  if (k === todayKey) return 'Сегодня';
  if (k === tomorrowKey) return 'Завтра';
  return dayLblFmt.format(new Date(iso));
}

const field: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: 15,
  background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
  borderRadius: 12, color: 'var(--text)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      borderRadius: 100, whiteSpace: 'nowrap', transition: 'all .15s',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-sub)',
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
    }}>{children}</button>
  );
}

/** Slot-based booking widget. Falls back to `fallback` when no slots are open. */
export function BookingPicker({ fallback }: { fallback?: React.ReactNode }) {
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [returning, setReturning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'not_found' | 'payment_fail' | 'await_payment'>('idle');
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<SessionOption[]>([]);
  const [sessionType, setSessionType] = useState<'INTRO_15' | 'SESSION_50'>('INTRO_15');
  const [website, setWebsite] = useState(''); // honeypot — stays empty for humans

  // Handle ?payment=ok / ?payment=fail redirect back from Robokassa
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'ok') { setStatus('done'); window.history.replaceState({}, '', window.location.pathname + window.location.hash); }
    if (p.get('payment') === 'fail') { setStatus('payment_fail'); window.history.replaceState({}, '', window.location.pathname + window.location.hash); }
  }, []);

  useEffect(() => {
    api.getSlots()
      .then((s) => { setSlots(s); if (s.length) setDay(dayKey(s[0].startsAt)); })
      .catch(() => setLoadFailed(true));
    api.getBookingOptions().then(setOptions).catch(() => setOptions([]));
  }, []);

  const chosen = options.find((o) => o.type === sessionType);

  // On a terminal screen (done / payment failed), scroll it into view — on mobile
  // the result renders above the submit button and was easy to miss.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'done' || status === 'payment_fail' || status === 'await_payment') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [status]);

  // Group slots by MSK day, preserving chronological order.
  const days = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s.startsAt);
      (map.get(k) ?? map.set(k, []).get(k)!).push(s);
    }
    return map;
  }, [slots]);

  if (slots === null && !loadFailed) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 15, padding: '24px 0' }}>Загружаю свободное время…</p>;
  }
  // No availability configured (or load failed): keep the request channel open.
  if (loadFailed || slots!.length === 0) {
    return <>{fallback}</>;
  }

  if (status === 'await_payment') return (
    <div ref={resultRef} style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>⏳</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Слот зарезервирован</h3>
      {slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 6px' }}>
          {dayLabel(slot.startsAt)}, {timeLabel(slot.startsAt)} МСК — держу за вами 15 минут.
        </p>
      )}
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
        Для подтверждения нужна оплата{chosen && chosen.price > 0 ? ` ${chosen.price.toLocaleString('ru-RU')} ₽` : ''}.
      </p>
      <a href={payUrl ?? '#'} style={{ display: 'inline-block', padding: '15px 32px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', borderRadius: 12, textDecoration: 'none', boxShadow: '0 8px 28px rgba(77,71,153,.28)' }}>
        Перейти к оплате →
      </a>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '20px auto 0', maxWidth: 420 }}>
        Если оплата не открылась или возникла ошибка — не волнуйтесь: я уже вижу вашу заявку и свяжусь с вами в Telegram. Можно также написать напрямую: <a href="https://t.me/kotlarewski" style={{ color: 'var(--accent)' }}>@kotlarewski</a>.
      </p>
    </div>
  );

  if (status === 'payment_fail') return (
    <div ref={resultRef} style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>😕</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Оплата не прошла</h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>Слот был освобождён. Попробуйте выбрать время снова или напишите напрямую.</p>
      <button type="button" onClick={() => setStatus('idle')} style={{ padding: '13px 28px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
        Выбрать другое время
      </button>
    </div>
  );

  if (status === 'done') return (
    <div ref={resultRef} style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>{cancelled ? '🗓' : '✅'}</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>
        {cancelled ? 'Запись отменена' : 'Время забронировано'}
      </h3>
      {!cancelled && slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 8px' }}>
          {dayLabel(slot.startsAt)}, {timeLabel(slot.startsAt)} МСК.
        </p>
      )}
      {!cancelled && meetingUrl && (
        <div style={{ margin: '14px auto 4px', maxWidth: 420, padding: '14px 16px', background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 6px' }}>Ваша персональная ссылка на встречу — она же для всех будущих сессий:</p>
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 15, fontWeight: 600, wordBreak: 'break-all', textDecoration: 'none' }}>{meetingUrl}</a>
        </div>
      )}
      {!cancelled && !meetingUrl && (
        <p style={{ color: 'var(--text-faint)', fontSize: 14, margin: '0 0 8px' }}>Пришлю ссылку на встречу до начала сессии.</p>
      )}
      {!cancelled && cancelToken && (
        <button type="button" onClick={async () => { try { await api.cancelBooking(cancelToken); setCancelled(true); } catch { /* ignore */ } }}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
          Отменить запись
        </button>
      )}
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot || !name.trim() || !contact.trim() || !consent) return;
    setStatus('loading');
    try {
      const res = await api.bookSlot({
        startsAt: slot.startsAt, durationMin: slot.durationMin, type: sessionType,
        clientName: name.trim(), clientContact: contact.trim(), message: message.trim() || undefined,
        returning, acceptedOffer: consent, website,
      });
      setCancelToken(res.cancelToken);
      (window as Window & { ym?: (...a: unknown[]) => void }).ym?.(109568051, 'reachGoal', 'booking_submit');
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
      setStatus(err instanceof Error && err.message === 'CLIENT_NOT_FOUND' ? 'not_found' : 'error');
    }
  };

  const dayList = [...days.keys()];

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {options.length > 1 && (
        <div>
          <div style={labelSt}>Формат встречи</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {options.map((o) => {
              const active = o.type === sessionType;
              return (
                <button key={o.type} type="button" onClick={() => setSessionType(o.type)} style={{
                  flex: '1 1 180px', textAlign: 'left', padding: '14px 16px', cursor: 'pointer',
                  borderRadius: 12, fontFamily: 'inherit', transition: 'all .15s',
                  background: active ? 'rgba(var(--accent-rgb,77,71,153),0.08)' : 'transparent',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    {o.label} {o.price > 0 ? `· ${o.price.toLocaleString('ru-RU')} ₽` : '· бесплатно'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 2 }}>{o.note}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <div style={labelSt}>Выберите день</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          {dayList.map((k) => (
            <Chip key={k} active={k === day} onClick={() => { setDay(k); setSlot(null); }}>
              {dayLabel(days.get(k)![0].startsAt)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div style={labelSt}>Время · МСК</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(days.get(day) ?? []).map((s) => (
            <Chip key={s.startsAt} active={slot?.startsAt === s.startsAt} onClick={() => setSlot(s)}>
              {timeLabel(s.startsAt)}
            </Chip>
          ))}
        </div>
      </div>

      {slot && (
        <>
          <div className="form-grid">
            <div><label style={labelSt} htmlFor="bp-name">Имя *</label><input id="bp-name" style={field} placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
            <div><label style={labelSt} htmlFor="bp-contact">Telegram / телефон *</label><input id="bp-contact" style={field} placeholder="@username или телефон" value={contact} onChange={(e) => setContact(e.target.value)} required maxLength={100} /></div>
          </div>
          {/* Honeypot: hidden from users, bots tend to fill it → server rejects */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}
            aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={returning} onChange={(e) => { setReturning(e.target.checked); if (status === 'not_found') setStatus('idle'); }} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Мы уже занимались — это повторная встреча
            </span>
          </label>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '-8px 0 0' }}>
            {returning
              ? 'Хорошо! Укажите, пожалуйста, тот же контакт, что и в прошлый раз — я узнаю вас и открою вашу постоянную комнату для встречи, ту же, что и всегда. Если контакт не совпадёт, я не смогу вас найти и попрошу проверить.'
              : 'Если занимаемся впервые — я заведу для вас персональную комнату для встреч. Она будет одна и та же для всех наших будущих сессий, чтобы не искать новую ссылку каждый раз. 🙂'}
          </p>
          <div>
            <label style={labelSt} htmlFor="bp-message">Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
            <textarea id="bp-message" style={{ ...field, resize: 'vertical', minHeight: 84 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Я принимаю условия <a href="/offer" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Публичной оферты</a>{chosen && chosen.price > 0 ? ' (договора оказания услуг)' : ''} и <a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Политики конфиденциальности</a>, даю согласие на обработку данных
            </span>
          </label>
          {status === 'not_found' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>Не нашёл вас по этому контакту. Проверьте, что ввели тот же Telegram или телефон, что и в прошлый раз. Если занимаетесь впервые — снимите галочку «повторная встреча».</p>}
          {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>Не удалось забронировать — возможно, время только что заняли. Обновите страницу или напишите в Telegram: <a href="https://t.me/kotlarewski" style={{ color: 'inherit' }}>@kotlarewski</a></p>}
          <button type="submit" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent}
            style={{
              alignSelf: 'flex-start', padding: '15px 30px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', opacity: status === 'loading' || !name.trim() || !contact.trim() || !consent ? 0.4 : 1,
              boxShadow: '0 8px 28px rgba(77,71,153,.28)',
            }}>
            {status === 'loading'
              ? (chosen && chosen.price > 0 ? 'Перехожу к оплате…' : 'Бронирую…')
              : chosen && chosen.price > 0
                ? `Оплатить ${chosen.price.toLocaleString('ru-RU')} ₽ и записаться →`
                : `Записаться на ${dayLabel(slot.startsAt).toLowerCase()}, ${timeLabel(slot.startsAt)} →`}
          </button>
          {(!name.trim() || !contact.trim() || !consent) ? (
            <p style={{ fontSize: 13, color: 'var(--accent-red)', margin: 0 }}>
              Чтобы записаться, заполните: {[
                !name.trim() && 'имя',
                !contact.trim() && 'Telegram или телефон',
                !consent && 'согласие с офертой',
              ].filter(Boolean).join(', ')}.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>
              {chosen && chosen.price > 0
                ? 'Оплата картой или СБП через Robokassa. Чек придёт автоматически.'
                : 'Первая встреча 15 минут — бесплатно. Никаких обязательств.'}
            </p>
          )}
        </>
      )}
    </form>
  );
}
