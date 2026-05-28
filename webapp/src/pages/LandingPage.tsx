import { useState, useRef } from 'react';
import { api } from '../api';

// ─── Sections ────────────────────────────────────────────────────────────────
const APPROACH_ITEMS = [
  {
    icon: '🗺️',
    title: 'Схема-терапия',
    text: 'Работаем с глубинными убеждениями и паттернами, которые сформировались в детстве и продолжают влиять на твою жизнь сегодня.',
  },
  {
    icon: '🤝',
    title: 'Тёплый контакт',
    text: 'Отношения с терапевтом — это не нейтральный экран. Я присутствую в сессии целиком и использую наш контакт как инструмент изменений.',
  },
  {
    icon: '🔬',
    title: 'Доказательная база',
    text: 'Схема-терапия — один из наиболее исследованных методов для работы с хроническими проблемами в отношениях и идентичности.',
  },
  {
    icon: '🌱',
    title: 'Долгосрочный результат',
    text: 'Цель — не просто снять симптом, а изменить то, как ты воспринимаешь себя и строишь отношения. Это требует времени, но изменения устойчивы.',
  },
];

const FORMAT_ITEMS = [
  { label: 'Формат', value: 'Онлайн (видео)' },
  { label: 'Длительность', value: '50 минут' },
  { label: 'Стоимость', value: '4 000 ₽' },
  { label: 'Знакомство', value: 'Бесплатно · 15 минут' },
];

// ─── Booking form ─────────────────────────────────────────────────────────────
function BookingForm() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) return;
    setStatus('loading');
    try {
      await api.submitBooking({ name: name.trim(), contact: contact.trim(), message: message.trim() || undefined });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    background: 'var(--bg-elev)',
    border: '1.5px solid var(--line)',
    borderRadius: 10,
    fontSize: 15,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  if (status === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
          Заявка отправлена
        </h3>
        <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.6 }}>
          Я свяжусь с тобой в ближайшее время, чтобы договориться о первой встрече.
        </p>
      </div>
    );
  }

  return (
    <div ref={formRef}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-sub)', marginBottom: 6, fontWeight: 500 }}>
            Имя *
          </label>
          <input
            style={inputStyle}
            placeholder="Как тебя зовут"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={100}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-sub)', marginBottom: 6, fontWeight: 500 }}>
            Telegram или телефон *
          </label>
          <input
            style={inputStyle}
            placeholder="@username или +7 999 000 00 00"
            value={contact}
            onChange={e => setContact(e.target.value)}
            required
            maxLength={100}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-sub)', marginBottom: 6, fontWeight: 500 }}>
            С чем хочешь поработать? <span style={{ color: 'var(--text-faint)' }}>(необязательно)</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
            placeholder="Пара слов о запросе — это поможет мне лучше подготовиться"
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={500}
          />
        </div>
        {status === 'error' && (
          <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>
            Что-то пошло не так. Напиши мне напрямую: <a href="https://t.me/kotlarewski" style={{ color: 'var(--accent-red)' }}>@kotlarewski</a>
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'loading' || !name.trim() || !contact.trim()}
          style={{
            padding: '14px 28px',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: (status === 'loading' || !name.trim() || !contact.trim()) ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {status === 'loading' ? 'Отправляю…' : 'Записаться на встречу →'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, lineHeight: 1.5 }}>
          Отвечу в течение дня. Первая встреча — бесплатное знакомство 15 минут, без обязательств.
        </p>
      </form>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LandingPage() {
  const bookingRef = useRef<HTMLElement>(null);

  const scrollToBooking = () => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', color: 'var(--text)' }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60,
      }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--text)' }}>
          Григорий Котляревский
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/login" style={{ fontSize: 13, color: 'var(--text-sub)', textDecoration: 'none' }}>Войти</a>
          <button
            onClick={scrollToBooking}
            style={{
              padding: '8px 18px',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Записаться
          </button>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px 64px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>
          Схема-терапевт · онлайн
        </p>
        <h1 style={{
          fontFamily: 'var(--serif)',
          fontSize: 'clamp(42px, 7vw, 68px)',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--text)',
          margin: '0 0 28px',
        }}>
          Работа с теми паттернами,<br />
          <span style={{ fontStyle: 'italic' }}>которые мешают жить</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-sub)', lineHeight: 1.75, maxWidth: 540, margin: '0 0 40px' }}>
          Схема-терапия помогает разобраться, почему мы снова и снова попадаем в одни и те же ситуации — в отношениях, на работе, с самим собой — и найти выход.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={scrollToBooking}
            style={{
              padding: '14px 28px',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Записаться на знакомство →
          </button>
          <a
            href="https://t.me/kotlarewski"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 24px',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--text-sub)',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Написать в Telegram
          </a>
        </div>
      </section>

      <div style={{ height: 1, background: 'var(--line)', maxWidth: 720, margin: '0 auto 64px', marginLeft: 24, marginRight: 24 }} />

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 72px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 24 }}>
          Обо мне
        </p>
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Photo placeholder */}
          <div style={{
            width: 160, height: 200, flexShrink: 0,
            background: 'var(--surface-2)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48,
            border: '1px solid var(--line)',
          }}>
            👤
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, margin: '0 0 16px', color: 'var(--text)' }}>
              Григорий Котляревский
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.75, margin: '0 0 16px' }}>
              Психолог, схема-терапевт. Прошёл подготовку по схема-терапии и работаю с людьми, которых преследуют повторяющиеся паттерны: в отношениях, самооценке, тревоге.
            </p>
            <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.75, margin: 0 }}>
              Меня интересует не только «что» происходит с человеком, но и «почему» — какие ранние убеждения и режимы стоят за сегодняшними трудностями. Работаю онлайн, с постсоветским пространством, говорю на русском и украинском.
            </p>
          </div>
        </div>
      </section>

      {/* ── Approach ──────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--bg-rail)', padding: '64px 24px', marginBottom: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
            Подход
          </p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400, color: 'var(--text)', margin: '0 0 40px' }}>
            Как я работаю
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {APPROACH_ITEMS.map((item) => (
              <div key={item.title} style={{
                background: 'var(--bg-elev)',
                borderRadius: 14,
                padding: '24px',
                border: '1px solid var(--line)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Format & Prices ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '72px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
          Формат и цены
        </p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400, color: 'var(--text)', margin: '0 0 40px' }}>
          Как устроена работа
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {FORMAT_ITEMS.map((item) => (
            <div key={item.label} style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                {item.label}
              </p>
              <p style={{ fontSize: 18, color: 'var(--text)', fontWeight: 600, margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>
        <div style={{
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent-line)',
          borderRadius: 12,
          padding: '20px 24px',
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>🎁</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
              Первая встреча — бесплатно
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>
              15 минут, чтобы познакомиться, рассказать про свой запрос и понять, подходим ли мы друг другу. Никаких обязательств.
            </p>
          </div>
        </div>
      </section>

      {/* ── Booking ───────────────────────────────────────────────────────── */}
      <section
        ref={bookingRef}
        style={{ background: 'var(--bg-rail)', padding: '64px 24px 80px' }}
      >
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
            Запись
          </p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400, color: 'var(--text)', margin: '0 0 8px' }}>
            Записаться на встречу
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 36px' }}>
            Оставь имя и контакт — я напишу в течение дня и договоримся о времени.
          </p>
          <BookingForm />
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--line)',
        padding: '32px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>
          © {new Date().getFullYear()} Григорий Котляревский
        </span>
        <a
          href="https://t.me/kotlarewski"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'none' }}
        >
          @kotlarewski
        </a>
      </footer>

      <style>{`
        @keyframes land-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: none; }
        }
        input:focus, textarea:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        @media (max-width: 500px) {
          nav span { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
