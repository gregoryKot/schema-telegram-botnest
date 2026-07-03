import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DARK_BG, INK_ON_DARK, Btn, ThemeIcon, useReveal, useTilt, useTheme } from '../components/landing-kit';

// Продуктовый лендинг «Всё по схеме» — главная страница app-домена (schemehappens.ru).
// Стиль и паттерны — как у LandingPage (сайт терапевта): inline-стили, serif-заголовки,
// page-scoped <style>, reveal-анимации. Общие примитивы — в components/landing-kit.

const BOT_URL = 'https://t.me/SchemaLabBot';
const AUTHOR_SITE = 'https://kotlarewski.gr';

// ─── Логотип ──────────────────────────────────────────────────────────────────
function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: size, height: size, borderRadius: size * 0.3, flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent-indigo, var(--accent)), var(--accent))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, boxShadow: '0 4px 14px rgba(77,71,153,.3)',
      }}>🧠</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>Всё по схеме</span>
    </span>
  );
}

// ─── Мокап приложения (чистый CSS/SVG — не устареет и живёт в обеих темах) ────
const MOCK_NEEDS = [
  { emoji: '🤝', name: 'Привязанность', v: 7, c: 'var(--c-teal, #4f8285)' },
  { emoji: '🚀', name: 'Автономия',     v: 8, c: 'var(--c-moss, #6b8156)' },
  { emoji: '⚖️', name: 'Границы',       v: 4, c: 'var(--c-rose, #c46b6b)' },
  { emoji: '🎉', name: 'Спонтанность',  v: 6, c: 'var(--c-amber, #c2862a)' },
];
const MOCK_SPARK = [4, 5, 3, 6, 5, 7, 6, 8, 7, 8, 6, 9];

function AppPreview() {
  return (
    <div className="pl-preview" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} aria-hidden>
      {/* Телефон */}
      <div style={{
        width: 300, boxSizing: 'border-box', padding: '22px 20px 20px',
        background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 34,
        boxShadow: '0 24px 70px rgba(28,25,20,.18)', animation: 'pl-float 7s ease-in-out infinite',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--text)' }}>Сегодня</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>минутный чек-ин</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: '0 0 16px' }}>Как ты? Отметь свои потребности</p>
        {MOCK_NEEDS.map((n) => (
          <div key={n.name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{n.emoji} {n.name}</span>
              <span style={{ color: 'var(--text-faint)', fontWeight: 700 }}>{n.v}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'rgba(var(--fg-rgb, 28,25,22),.07)' }}>
              <div style={{ width: `${n.v * 10}%`, height: '100%', borderRadius: 4, background: n.c, opacity: .85 }} />
            </div>
          </div>
        ))}
        {/* Спарклайн динамики */}
        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Динамика</span>
            <span style={{ color: 'var(--text-faint)' }}>2 недели</span>
          </div>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none">
            {MOCK_SPARK.map((v, i) => (
              <rect key={i} x={i * 18.5} y={42 - v * 4.2} width="11" height={v * 4.2} rx="3"
                fill="var(--accent)" opacity={0.25 + (v / 9) * 0.65} />
            ))}
          </svg>
        </div>
      </div>
      {/* Плавающие карточки-акценты */}
      <div className="pl-chip" style={{
        position: 'absolute', top: 34, right: -8, padding: '9px 14px', borderRadius: 12,
        background: 'var(--bg-elev)', border: '1px solid var(--line)', boxShadow: '0 10px 30px rgba(28,25,20,.14)',
        fontSize: 12, fontWeight: 600, color: 'var(--text)', animation: 'pl-float 6s ease-in-out .8s infinite',
      }}>
        🔍 Схема замечена
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-sub)', marginTop: 2 }}>Покинутость · 3-й раз за неделю</div>
      </div>
      <div className="pl-chip" style={{
        position: 'absolute', bottom: 48, left: -14, padding: '9px 14px', borderRadius: 12,
        background: 'var(--bg-elev)', border: '1px solid var(--line)', boxShadow: '0 10px 30px rgba(28,25,20,.14)',
        fontSize: 12, fontWeight: 600, color: 'var(--text)', animation: 'pl-float 8s ease-in-out 1.6s infinite',
      }}>
        🌱 Внутренний Критик — тише
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-sub)', marginTop: 2 }}>реже, чем месяц назад</div>
      </div>
    </div>
  );
}

// ─── «Как это работает» — 3 шага ─────────────────────────────────────────────
const STEPS = [
  {
    num: '01', title: 'Схемы родом из детства',
    text: 'Когда важные потребности — в безопасности, принятии, тепле — недополучены, психика достраивает «правила»: «меня оставят», «я недостаточно хорош». В схема-терапии их называют ранними дезадаптивными схемами.',
  },
  {
    num: '02', title: 'Они включаются незаметно',
    text: 'Во взрослой жизни схемы срабатывают автоматически: одни и те же ссоры, тревога, самокритика, прокрастинация. Кажется, что «такой характер» — на самом деле это выученный паттерн.',
  },
  {
    num: '03', title: 'Их можно замечать — и менять',
    text: 'Регулярное наблюдение — дневник, тест, упражнения — делает схемы видимыми. А то, что видно, уже можно менять: самостоятельно или вместе с терапевтом.',
  },
];

// ─── Возможности ──────────────────────────────────────────────────────────────
const FEATURES = [
  { num: '01', title: 'Дневник состояний', text: 'Минутный чек-ин: восемь базовых потребностей по шкале. Через пару недель видно, из чего складываются «плохие дни».' },
  { num: '02', title: 'Диагностика схем', text: 'Тест ЯСО: 20 ранних дезадаптивных схем в пяти доменах — с понятным разбором результатов, а не просто цифрами.' },
  { num: '03', title: 'Режимы', text: 'Внутренний Критик, Уязвимый ребёнок, Здоровый взрослый — отмечайте, кто «за рулём» прямо сейчас.' },
  { num: '04', title: 'Практики', text: 'Упражнения из схема-терапии и КПТ: переоценка убеждений, терапевтические письма, безопасное место, флэшкарточки.' },
  { num: '05', title: 'Динамика', text: 'История состояний за недели и месяцы: что меняется, а что стоит на месте. Удобно приносить на сессии.' },
  { num: '06', title: 'Кабинет терапевта', text: 'Работаете с психологом? Поделитесь динамикой — и сессии будут опираться на реальные данные, а не только на память.' },
];

function FeatureCard({ f, accent }: { f: typeof FEATURES[0]; accent: boolean }) {
  const ref = useTilt();
  return (
    <div ref={ref} style={{
      background: accent ? 'var(--accent)' : 'var(--bg-elev)',
      border: accent ? 'none' : '1px solid var(--line)',
      borderRadius: 20, padding: '26px 22px',
      display: 'flex', flexDirection: 'column', gap: 10,
      cursor: 'default', transition: 'transform .25s, box-shadow .25s', willChange: 'transform',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: accent ? 'rgba(255,255,255,.6)' : 'var(--accent)' }}>{f.num}</span>
      <p style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 400, margin: 0, color: accent ? '#fff' : 'var(--text)' }}>{f.title}</p>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, margin: 0, color: accent ? 'rgba(255,255,255,.8)' : 'var(--text-sub)' }}>{f.text}</p>
    </div>
  );
}

// ─── Доверие ──────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: '💛', title: 'Бесплатно', text: <>Без подписок и рекламы. Проект живёт на донаты — если он помогает, можно <a href="/donate" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>поддержать</a>.</> },
  { icon: '🔒', title: 'Записи зашифрованы', text: <>Дневники, письма и заметки хранятся в зашифрованном виде (AES-256). Прочитать их можете только вы.</> },
  { icon: '🚪', title: 'Уйти легко', text: <>Аккаунт удаляется в один клик — целиком, вместе со всеми данными. Никаких «мы сохраним копию».</> },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'Что такое схема-терапия?',
    a: 'Доказательный метод, разработанный Джеффри Янгом. Он объединяет КПТ, теорию привязанности и работу с эмоциями и помогает при повторяющихся трудностях: в отношениях, самооценке, тревоге. Схема-терапия работает с глубинными убеждениями — схемами, которые сформировались в детстве и незаметно управляют реакциями сейчас.',
  },
  {
    q: 'Это замена психотерапии?',
    a: 'Нет. «Всё по схеме» — инструмент самонаблюдения и самопомощи: он помогает замечать паттерны и бережно с ними работать, но не ставит диагнозов и не лечит. Если состояние тяжёлое — пожалуйста, обратитесь к специалисту. А если вы уже в терапии, приложение станет хорошим спутником между сессиями.',
  },
  {
    q: 'Сколько это стоит?',
    a: 'Нисколько. Все функции бесплатны — без пробных периодов и платных уровней. Проект существует на добровольные донаты.',
  },
  {
    q: 'Что будет с моими данными?',
    a: 'Свободный текст — дневники, письма, заметки — шифруется (AES-256) и никому не передаётся. Терапевт видит вашу динамику только если вы сами дали доступ. Аккаунт можно удалить полностью в любой момент.',
  },
  {
    q: 'Нужен ли Telegram?',
    a: 'Нет. Войти можно через Google, ВКонтакте или по ссылке на email. Telegram — приятное дополнение: бот напомнит про чек-ин, а мини-приложение работает прямо в чате, с теми же данными.',
  },
];

function FaqList() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderTop: '1px solid var(--line)', borderBottom: i === FAQ.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 16, padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, fontFamily: 'inherit' }}>{item.q}</span>
              <span style={{
                fontSize: 20, color: 'var(--text-faint)', flexShrink: 0, lineHeight: 1,
                transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s',
              }}>+</span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .3s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-sub)', margin: '0 0 22px', maxWidth: 640 }}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Страница ─────────────────────────────────────────────────────────────────
export function ProductLandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    if (isAuthenticated) navigate('/today', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => { document.title = 'Всё по схеме — инструмент схема-терапии'; }, []);

  const howRef      = useReveal() as React.RefObject<HTMLElement>;
  const featuresRef = useReveal() as React.RefObject<HTMLElement>;
  const tgRef       = useReveal() as React.RefObject<HTMLElement>;
  const trustRef    = useReveal() as React.RefObject<HTMLElement>;
  const faqRef      = useReveal() as React.RefObject<HTMLElement>;
  const ctaRef      = useReveal() as React.RefObject<HTMLElement>;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>

      {/* ── Навбар ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '12px 24px', boxSizing: 'border-box',
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <a href="/" style={{ textDecoration: 'none' }}><Logo /></a>
        <nav className="pl-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[['Как это работает', '#how'], ['Возможности', '#features'], ['Вопросы', '#faq']].map(([label, href]) => (
            <a key={href} href={href}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap', transition: 'color .15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
              {label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleTheme} aria-label="Переключить тему" style={{
            width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'transparent',
            color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          <Btn size="sm" href="/login" newTab={false}>Войти</Btn>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '140px 24px 90px' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'var(--blob-1)', filter: 'blur(80px)', top: '-15%', left: '-12%', animation: 'pl-blob 14s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: 'var(--blob-2)', filter: 'blur(80px)', bottom: '-18%', right: '-10%', animation: 'pl-blob 16s ease-in-out 2s infinite' }} />
        </div>
        <div className="pl-hero-grid" style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center' }}>
          <div style={{ animation: 'pl-in .7s cubic-bezier(.16,1,.3,1) both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, border: '1px solid var(--line-strong)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 24 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pl-pulse 2.5s ease-in-out infinite' }} />
              Схема-терапия · бесплатно · без рекламы
            </div>
            <h1 className="pl-h1" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 5.2vw, 68px)', fontWeight: 400, lineHeight: 1.06, letterSpacing: '-.02em', margin: '0 0 22px' }}>
              Почему со мной <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>снова</em> это происходит?
            </h1>
            <p style={{ fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-sub)', maxWidth: 480, margin: '0 0 32px' }}>
              Одни и те же ссоры, тревога, самокритика — это не «характер», а схемы:
              выученные паттерны, которые можно заметить и постепенно менять.
              «Всё по схеме» — бесплатное приложение для самостоятельной работы
              в подходе схема-терапии.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn size="lg" href="/login" newTab={false}>Начать бесплатно →</Btn>
              <Btn size="lg" variant="ghost" href="#how" newTab={false}>Как это работает</Btn>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '18px 0 0' }}>
              Вход через Google, ВКонтакте, Telegram или email · регистрация не нужна
            </p>
          </div>
          <div style={{ animation: 'pl-in .7s cubic-bezier(.16,1,.3,1) .15s both' }}>
            <AppPreview />
          </div>
        </div>
      </section>

      {/* ── Как это работает ── */}
      <section id="how" ref={howRef} className="reveal-section" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-rail)', padding: '84px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Как это работает</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-.01em', margin: '14px 0 48px', maxWidth: 640 }}>
            Не «что со мной не так», а <em style={{ fontStyle: 'italic' }}>«какая схема включилась»</em>
          </h2>
          <div className="pl-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
            {STEPS.map((s) => (
              <div key={s.num}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 44, color: 'var(--accent)', opacity: .45, lineHeight: 1 }}>{s.num}</span>
                <p style={{ fontSize: 17, fontWeight: 700, margin: '14px 0 10px', color: 'var(--text)' }}>{s.title}</p>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-sub)', margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Возможности ── */}
      <section id="features" ref={featuresRef} className="reveal-section" style={{ padding: '84px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Возможности</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-.01em', margin: '14px 0 48px', maxWidth: 560 }}>
            Всё, что нужно для работы <em style={{ fontStyle: 'italic' }}>между сессиями</em> — или до них
          </h2>
          <div className="pl-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {FEATURES.map((f, i) => <FeatureCard key={f.num} f={f} accent={i === 0} />)}
          </div>
        </div>
      </section>

      {/* ── Telegram ── */}
      <section ref={tgRef} className="reveal-section" style={{ background: DARK_BG, padding: '84px 24px' }}>
        <div className="pl-tg-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 56, alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>Telegram</span>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-.01em', color: INK_ON_DARK, margin: '14px 0 20px' }}>
              Живёт и в&nbsp;Telegram
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, color: 'rgba(236,234,229,.75)', maxWidth: 460, margin: '0 0 30px' }}>
              Бот <strong style={{ color: INK_ON_DARK }}>@SchemaLabBot</strong> мягко напомнит про чек-ин,
              а мини-приложение работает прямо в чате. Данные общие с сайтом:
              начните в телефоне — продолжите в браузере.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Btn variant="dark" size="lg" href={BOT_URL}>Открыть бота ↗</Btn>
            </div>
          </div>
          {/* Мокап чата */}
          <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, width: '100%', justifySelf: 'center' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '11px 15px', borderRadius: '16px 16px 16px 5px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', fontSize: 13.5, lineHeight: 1.55, color: 'rgba(236,234,229,.9)' }}>
              🧠 Привет! Минутка на чек-ин? Как сегодня с границами?
            </div>
            <div style={{ alignSelf: 'flex-end', maxWidth: '75%', padding: '11px 15px', borderRadius: '16px 16px 5px 16px', background: 'var(--accent)', fontSize: 13.5, lineHeight: 1.55, color: '#fff' }}>
              Сложно. Опять согласился на лишнее на работе 😔
            </div>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '11px 15px', borderRadius: '16px 16px 16px 5px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', fontSize: 13.5, lineHeight: 1.55, color: 'rgba(236,234,229,.9)' }}>
              Записал. Похоже на схему «Самопожертвование» — хочешь короткое упражнение на границы?
            </div>
          </div>
        </div>
      </section>

      {/* ── Доверие ── */}
      <section ref={trustRef} className="reveal-section" style={{ padding: '84px 24px' }}>
        <div className="pl-trust" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
          {TRUST.map((t) => (
            <div key={t.title}>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{t.icon}</div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>{t.title}</p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-sub)', margin: 0 }}>{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" ref={faqRef} className="reveal-section" style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)', padding: '84px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Вопросы</span>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-.01em', margin: '14px 0 36px' }}>
            Частые вопросы
          </h2>
          <FaqList />
        </div>
      </section>

      {/* ── Финальный CTA ── */}
      <section ref={ctaRef} className="reveal-section" style={{ padding: '110px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--blob-1)', filter: 'blur(90px)', bottom: '-40%', left: '50%', transform: 'translateX(-50%)' }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(34px, 5vw, 58px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-.02em', margin: '0 0 20px' }}>
            Первый шаг — просто <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>заметить</em>
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--text-sub)', margin: '0 0 36px' }}>
            Минутный чек-ин в день — и через пару недель паттерны станут видимыми.
            Бесплатно, бережно, в вашем темпе.
          </p>
          <Btn size="lg" href="/login" newTab={false}>Начать бесплатно →</Btn>
        </div>
      </section>

      {/* ── Футер ── */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '32px 24px' }}>
        <div className="pl-footer" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo size={26} />
            <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>© {new Date().getFullYear()}</span>
          </div>
          <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              ['Политика конфиденциальности', '/privacy'],
              ['Оферта', '/offer'],
              ['Поддержать 💛', '/donate'],
              ['Автор проекта ↗', AUTHOR_SITE],
            ].map(([label, href]) => (
              <a key={href} href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={{ fontSize: 13, color: 'var(--text-sub)', textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>

      {/* ── Page-scoped styles ── */}
      <style>{`
        html { scroll-behavior: smooth; }
        section[id] { scroll-margin-top: 70px; }

        @keyframes pl-in    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes pl-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pl-blob  { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(2%,3%) scale(1.05); } }
        @keyframes pl-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.65); } }

        .reveal-section { opacity: 0; transform: translateY(28px); transition: opacity .75s ease, transform .75s ease; }
        .reveal-section.revealed { opacity: 1; transform: none; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .15s !important;
            scroll-behavior: auto !important;
          }
          .reveal-section { opacity: 1 !important; transform: none !important; }
        }

        @media (max-width: 900px) {
          .pl-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .pl-steps, .pl-features, .pl-trust { grid-template-columns: 1fr !important; }
          .pl-tg-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .pl-chip { display: none; }
        }
        @media (min-width: 601px) and (max-width: 900px) {
          .pl-features { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .pl-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
