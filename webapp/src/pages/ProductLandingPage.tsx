import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Btn, ThemeIcon, useReveal, useTilt, useTheme, useRecentArticles } from '../components/landing-kit';
import type { ArticleSummary } from '../api';

// Продуктовый лендинг «Всё по схеме» — главная страница app-домена (schemehappens.ru).
// Своя айдентика (app-стиль, живые цвета схем, sans-serif), намеренно отличная от
// serif+индиго странички терапевта. Общие примитивы — в components/landing-kit.

const BOT_URL = 'https://t.me/SchemaLabBot';
const AUTHOR_SITE = 'https://kotlarewski.gr';

// Палитра схем — та же, что в самом приложении (адаптируется к теме через CSS-переменные).
const C = { rose: 'var(--c-rose)', amber: 'var(--c-amber)', moss: 'var(--c-moss)', teal: 'var(--c-teal)', plum: 'var(--c-plum)', clay: 'var(--c-clay)', slate: 'var(--c-slate)' };
const tint = (c: string, pct = 12) => `color-mix(in srgb, ${c} ${pct}%, var(--bg-elev))`;
const soft = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// ─── Логотип ──────────────────────────────────────────────────────────────────
function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
        background: 'linear-gradient(135deg, var(--c-plum), var(--accent))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, boxShadow: '0 4px 14px rgba(77,71,153,.28)',
      }}>🧠</span>
      <span style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>Всё по схеме</span>
    </span>
  );
}

// ─── Мокап приложения (чистый CSS/SVG — не устареет и живёт в обеих темах) ────
const MOCK_NEEDS = [
  { emoji: '🤝', name: 'Привязанность', v: 7, c: C.teal },
  { emoji: '🚀', name: 'Автономия',     v: 8, c: C.moss },
  { emoji: '⚖️', name: 'Границы',       v: 4, c: C.rose },
  { emoji: '🎉', name: 'Спонтанность',  v: 6, c: C.amber },
];
const MOCK_SPARK = [4, 5, 3, 6, 5, 7, 6, 8, 7, 8, 6, 9];

function AppPreview() {
  return (
    <div className="pl-preview" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} aria-hidden>
      <div style={{
        width: 300, boxSizing: 'border-box', padding: '22px 20px 20px',
        background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 32,
        boxShadow: '0 30px 80px rgba(28,25,20,.18)', animation: 'pl-float 7s ease-in-out infinite',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>Сегодня</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>минутный чек-ин</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: '0 0 16px' }}>Как ты? Отметь свои потребности</p>
        {MOCK_NEEDS.map((n) => (
          <div key={n.name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{n.emoji} {n.name}</span>
              <span style={{ color: n.c, fontWeight: 800 }}>{n.v}</span>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'color-mix(in srgb, var(--text) 8%, transparent)' }}>
              <div style={{ width: `${n.v * 10}%`, height: '100%', borderRadius: 5, background: n.c }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: 'var(--text)' }}>Динамика</span>
            <span style={{ color: 'var(--text-faint)' }}>2 недели</span>
          </div>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none">
            {MOCK_SPARK.map((v, i) => (
              <rect key={i} x={i * 18.5} y={42 - v * 4.2} width="11" height={v * 4.2} rx="3"
                fill="var(--accent)" opacity={0.3 + (v / 9) * 0.6} />
            ))}
          </svg>
        </div>
      </div>
      <div className="pl-chip" style={{
        position: 'absolute', top: 30, right: -10, padding: '10px 14px', borderRadius: 14,
        background: 'var(--bg-elev)', border: `1px solid ${soft(C.plum, 40)}`, boxShadow: '0 14px 34px rgba(28,25,20,.16)',
        fontSize: 12, fontWeight: 700, color: 'var(--text)', animation: 'pl-float 6s ease-in-out .8s infinite',
      }}>
        <span style={{ color: C.plum }}>🔍 Схема замечена</span>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-sub)', marginTop: 2 }}>Покинутость · 3-й раз за неделю</div>
      </div>
      <div className="pl-chip" style={{
        position: 'absolute', bottom: 44, left: -16, padding: '10px 14px', borderRadius: 14,
        background: 'var(--bg-elev)', border: `1px solid ${soft(C.moss, 40)}`, boxShadow: '0 14px 34px rgba(28,25,20,.16)',
        fontSize: 12, fontWeight: 700, color: 'var(--text)', animation: 'pl-float 8s ease-in-out 1.6s infinite',
      }}>
        <span style={{ color: C.moss }}>🌱 Критик — тише</span>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-sub)', marginTop: 2 }}>реже, чем месяц назад</div>
      </div>
    </div>
  );
}

// ─── «Как это работает» — 3 шага ─────────────────────────────────────────────
const STEPS = [
  { num: '01', color: C.rose,  emoji: '🌱', title: 'Схемы родом из детства', text: 'Когда важные потребности — в безопасности, принятии, тепле — недополучены, психика достраивает «правила»: «меня оставят», «я недостаточно хорош». Это ранние дезадаптивные схемы.' },
  { num: '02', color: C.amber, emoji: '🔁', title: 'Они включаются незаметно', text: 'Во взрослой жизни схемы срабатывают на автомате: одни и те же ссоры, тревога, самокритика, прокрастинация. Кажется, что «такой характер» — а это выученный паттерн.' },
  { num: '03', color: C.teal,  emoji: '👁️', title: 'Их можно замечать — и менять', text: 'Регулярное наблюдение — дневник, тест, упражнения — делает схемы видимыми. А то, что видно, уже можно менять: самостоятельно или вместе с терапевтом.' },
];

// ─── Возможности ──────────────────────────────────────────────────────────────
const FEATURES = [
  { emoji: '📓', color: C.teal,  title: 'Дневник состояний', text: 'Минутный чек-ин: восемь базовых потребностей по шкале. Через пару недель видно, из чего складываются «плохие дни».' },
  { emoji: '🧩', color: C.plum,  title: 'Диагностика схем', text: 'Тест ЯСО: 20 ранних дезадаптивных схем в пяти доменах — с понятным разбором, а не просто цифрами.' },
  { emoji: '🎭', color: C.amber, title: 'Режимы', text: 'Внутренний Критик, Уязвимый ребёнок, Здоровый взрослый — отмечайте, кто «за рулём» прямо сейчас.' },
  { emoji: '✍️', color: C.moss,  title: 'Практики', text: 'Упражнения из схема-терапии и КПТ: переоценка убеждений, терапевтические письма, безопасное место, флэшкарточки.' },
  { emoji: '📈', color: C.clay,  title: 'Динамика', text: 'История состояний за недели и месяцы: что меняется, а что стоит на месте. Удобно приносить на сессии.' },
  { emoji: '🤝', color: C.rose,  title: 'Кабинет терапевта', text: 'Работаете с психологом? Поделитесь динамикой — и сессии будут опираться на реальные данные, а не только на память.' },
];

function FeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const ref = useTilt();
  return (
    <div ref={ref} style={{
      background: tint(f.color, 10), border: `1px solid ${soft(f.color, 22)}`,
      borderRadius: 22, padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 12,
      cursor: 'default', transition: 'transform .25s, box-shadow .25s', willChange: 'transform',
    }}>
      <span style={{
        width: 46, height: 46, borderRadius: 14, flexShrink: 0, fontSize: 22,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: soft(f.color, 20), border: `1px solid ${soft(f.color, 30)}`,
      }}>{f.emoji}</span>
      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', margin: '2px 0 0', color: 'var(--text)' }}>{f.title}</p>
      <p style={{ fontSize: 14, lineHeight: 1.65, margin: 0, color: 'var(--text-sub)' }}>{f.text}</p>
    </div>
  );
}

// ─── Доверие ──────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: '💛', color: C.amber, title: 'Бесплатно', text: <>Без подписок и рекламы. Проект живёт на донаты — если он помогает, можно <a href="/donate" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>поддержать</a>.</> },
  { icon: '🔒', color: C.teal,  title: 'Записи зашифрованы', text: <>Дневники, письма и заметки хранятся в зашифрованном виде (AES-256). Прочитать их можете только вы.</> },
  { icon: '🚪', color: C.moss,  title: 'Уйти легко', text: <>Аккаунт удаляется в один клик — целиком, со всеми данными. Никаких «мы сохраним копию».</> },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  { q: 'Что такое схема-терапия?', a: 'Доказательный метод, разработанный Джеффри Янгом. Он объединяет КПТ, теорию привязанности и работу с эмоциями и помогает при повторяющихся трудностях: в отношениях, самооценке, тревоге. Схема-терапия работает с глубинными убеждениями — схемами, которые сформировались в детстве и незаметно управляют реакциями сейчас.' },
  { q: 'Это замена психотерапии?', a: 'Нет. «Всё по схеме» — инструмент самонаблюдения и самопомощи: он помогает замечать паттерны и бережно с ними работать, но не ставит диагнозов и не лечит. Если состояние тяжёлое — пожалуйста, обратитесь к специалисту. А если вы уже в терапии, приложение станет хорошим спутником между сессиями.' },
  { q: 'Сколько это стоит?', a: 'Нисколько. Все функции бесплатны — без пробных периодов и платных уровней. Проект существует на добровольные донаты.' },
  { q: 'Что будет с моими данными?', a: 'Свободный текст — дневники, письма, заметки — шифруется (AES-256) и никому не передаётся. Терапевт видит вашу динамику только если вы сами дали доступ. Аккаунт можно удалить полностью в любой момент.' },
  { q: 'Нужен ли Telegram?', a: 'Нет. Войти можно через Google, ВКонтакте или по ссылке на email. Telegram — приятное дополнение: бот напомнит про чек-ин, а мини-приложение работает прямо в чате, с теми же данными.' },
];

function FaqList() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, fontFamily: 'inherit' }}>{item.q}</span>
              <span style={{ fontSize: 22, color: 'var(--accent)', flexShrink: 0, lineHeight: 1, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .3s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-sub)', margin: '0 20px 20px' }}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Карточка статьи (app-стиль) ─────────────────────────────────────────────
function ArticleCard({ a }: { a: ArticleSummary }) {
  const ref = useTilt<HTMLAnchorElement>();
  return (
    <a ref={ref} href={`/articles/${a.slug}`} style={{
      display: 'flex', flexDirection: 'column', textDecoration: 'none',
      background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 20,
      overflow: 'hidden', cursor: 'pointer', transition: 'transform .25s, box-shadow .25s', willChange: 'transform',
    }}>
      <div style={{ aspectRatio: '16 / 9', background: `linear-gradient(135deg, ${soft(C.plum, 22)}, ${soft(C.teal, 22)})`, overflow: 'hidden' }}>
        {a.heroImage && <img src={a.heroImage} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </div>
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25, margin: 0, color: 'var(--text)' }}>{a.title}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: 'var(--text-sub)', flex: 1 }}>{a.description}</p>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
          {new Date(a.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · {a.readMin} мин
        </span>
      </div>
    </a>
  );
}

// Общий стиль sans-serif заголовков (намеренно НЕ serif — отличие от странички терапевта).
const H2: React.CSSProperties = { fontFamily: 'inherit', fontSize: 'clamp(28px, 3.6vw, 42px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, margin: 0, color: 'var(--text)' };
const EYEBROW: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };

// ─── Страница ─────────────────────────────────────────────────────────────────
export function ProductLandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => { if (isAuthenticated) navigate('/today', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => { document.title = 'Всё по схеме — инструмент схема-терапии'; }, []);

  const articles = useRecentArticles(3);

  const howRef      = useReveal() as React.RefObject<HTMLElement>;
  const featuresRef = useReveal() as React.RefObject<HTMLElement>;
  const tgRef       = useReveal() as React.RefObject<HTMLElement>;
  const trustRef    = useReveal() as React.RefObject<HTMLElement>;
  const articlesRef = useReveal() as React.RefObject<HTMLElement>;
  const faqRef      = useReveal() as React.RefObject<HTMLElement>;
  const ctaRef      = useReveal() as React.RefObject<HTMLElement>;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh', flex: 1, minWidth: 0, overflowX: 'hidden' }}>

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
          {[['Как это работает', '#how'], ['Возможности', '#features'], ['Статьи', '#articles'], ['Вопросы', '#faq']].map(([label, href]) => (
            <a key={href} href={href}
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-sub)', textDecoration: 'none', padding: '7px 12px', borderRadius: 10, whiteSpace: 'nowrap', transition: 'color .15s, background .15s' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-soft)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-sub)'; el.style.background = 'transparent'; }}>
              {label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleTheme} aria-label="Переключить тему" style={{
            width: 36, height: 36, borderRadius: 11, border: '1px solid var(--line)', background: 'transparent',
            color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          <Btn size="sm" radius="btn" href="/login" newTab={false}>Войти</Btn>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '132px 24px 84px' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', background: `radial-gradient(circle, ${soft(C.plum, 24)}, transparent 68%)`, top: '-22%', left: '-14%', animation: 'pl-drift 16s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: `radial-gradient(circle, ${soft(C.teal, 22)}, transparent 68%)`, bottom: '-26%', right: '-12%', animation: 'pl-drift 18s ease-in-out 2s infinite' }} />
        </div>
        <div className="pl-hero-grid" style={{ position: 'relative', maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.08fr 1fr', gap: 56, alignItems: 'center' }}>
          <div style={{ animation: 'pl-in .7s cubic-bezier(.16,1,.3,1) both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'var(--accent-soft)', border: `1px solid ${soft('var(--accent)', 22)}`, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', marginBottom: 24 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pl-pulse 2.5s ease-in-out infinite' }} />
              Схема-терапия · бесплатно · без рекламы
            </div>
            <h1 style={{ fontFamily: 'inherit', fontSize: 'clamp(38px, 5.4vw, 62px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.04em', margin: '0 0 22px', color: 'var(--text)' }}>
              Почему со мной <span style={{ color: 'var(--accent)' }}>снова</span> это&nbsp;происходит?
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text-sub)', maxWidth: 490, margin: '0 0 32px' }}>
              Одни и те же ссоры, тревога, самокритика — это не «характер», а&nbsp;схемы:
              выученные паттерны, которые можно заметить и постепенно менять.
              «Всё по схеме» — бесплатное приложение для самостоятельной работы
              в подходе схема-терапии.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn size="lg" radius="btn" href="/login" newTab={false}>Начать бесплатно →</Btn>
              <Btn size="lg" radius="btn" variant="ghost" href="#how" newTab={false}>Как это работает</Btn>
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
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <span style={{ ...EYEBROW, color: 'var(--accent)' }}>Как это работает</span>
          <h2 style={{ ...H2, margin: '14px 0 48px', maxWidth: 680 }}>Не «что со мной не так», а «какая схема включилась»</h2>
          <div className="pl-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 22, padding: '28px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 15, fontSize: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: soft(s.color, 18), border: `1px solid ${soft(s.color, 28)}` }}>{s.emoji}</span>
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', color: soft(s.color, 55) }}>{s.num}</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px', color: 'var(--text)' }}>{s.title}</p>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-sub)', margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Возможности ── */}
      <section id="features" ref={featuresRef} className="reveal-section" style={{ padding: '84px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <span style={{ ...EYEBROW, color: 'var(--accent)' }}>Возможности</span>
          <h2 style={{ ...H2, margin: '14px 0 48px', maxWidth: 620 }}>Всё для работы между сессиями — или до них</h2>
          <div className="pl-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {FEATURES.map((f) => <FeatureCard key={f.title} f={f} />)}
          </div>
        </div>
      </section>

      {/* ── Telegram (честно: напоминания + мини-апп, без «умного» диалога) ── */}
      <section ref={tgRef} className="reveal-section" style={{ padding: '20px 24px 84px' }}>
        <div className="pl-tg-grid" style={{
          maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center',
          background: `linear-gradient(135deg, ${soft(C.teal, 12)}, ${soft(C.plum, 12)})`,
          border: '1px solid var(--line)', borderRadius: 28, padding: '48px 44px',
        }}>
          <div>
            <span style={{ ...EYEBROW, color: C.teal }}>Telegram</span>
            <h2 style={{ ...H2, margin: '14px 0 18px' }}>Живёт и в&nbsp;Telegram</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--text-sub)', maxWidth: 470, margin: '0 0 24px' }}>
              Бот <strong style={{ color: 'var(--text)' }}>@SchemaLabBot</strong> раз в месяц мягко напомнит
              заглянуть на чек-ин, а мини-приложение открывается прямо в чате — тот же дневник,
              те же схемы. Данные общие с сайтом: начните в телефоне, продолжите в браузере.
            </p>
            <Btn size="lg" radius="btn" href={BOT_URL}>Открыть в Telegram ↗</Btn>
          </div>
          {/* Мокап: напоминание + кнопка мини-аппа (без имитации ИИ-переписки) */}
          <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, width: '100%', justifySelf: 'center' }}>
            <div style={{ padding: '14px 16px', borderRadius: '16px 16px 16px 6px', background: 'var(--bg-elev)', border: '1px solid var(--line)', boxShadow: '0 10px 28px rgba(28,25,20,.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'linear-gradient(135deg, var(--c-plum), var(--accent))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🧠</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Всё по схеме</span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-sub)', margin: 0 }}>
                🌤️ Как ты в этом месяце? Пара минут на чек-ин помогут увидеть динамику.
              </p>
              <div style={{ marginTop: 12, padding: '9px 14px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                Открыть чек-ин
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)', alignSelf: 'center' }}>мини-приложение открывается прямо в чате</span>
          </div>
        </div>
      </section>

      {/* ── Доверие ── */}
      <section ref={trustRef} className="reveal-section" style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)', padding: '80px 24px' }}>
        <div className="pl-trust" style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {TRUST.map((t) => (
            <div key={t.title} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 20, padding: '26px 24px' }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, fontSize: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: soft(t.color, 18), border: `1px solid ${soft(t.color, 28)}`, marginBottom: 14 }}>{t.icon}</span>
              <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px', color: 'var(--text)' }}>{t.title}</p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-sub)', margin: 0 }}>{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Статьи ── */}
      {articles && articles.length > 0 && (
        <section id="articles" ref={articlesRef} className="reveal-section" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-rail)', padding: '84px 24px' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 48 }}>
              <div>
                <span style={{ ...EYEBROW, color: 'var(--accent)' }}>Статьи</span>
                <h2 style={{ ...H2, margin: '14px 0 0', maxWidth: 620 }}>Разбираемся в схема-терапии — простым языком</h2>
              </div>
              <a href="/articles" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Все статьи →</a>
            </div>
            <div className="pl-articles" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {articles.map((a) => <ArticleCard key={a.slug} a={a} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section id="faq" ref={faqRef} className="reveal-section" style={{ padding: '84px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span style={{ ...EYEBROW, color: 'var(--accent)' }}>Вопросы</span>
          <h2 style={{ ...H2, margin: '14px 0 36px' }}>Частые вопросы</h2>
          <FaqList />
        </div>
      </section>

      {/* ── Финальный CTA ── */}
      <section ref={ctaRef} className="reveal-section" style={{ padding: '24px 24px 96px' }}>
        <div style={{
          position: 'relative', overflow: 'hidden', maxWidth: 1120, margin: '0 auto',
          background: 'linear-gradient(135deg, var(--accent), var(--c-plum))',
          borderRadius: 32, padding: '72px 32px', textAlign: 'center',
        }}>
          <div aria-hidden style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,.12)', filter: 'blur(70px)', top: '-30%', left: '50%', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'relative', maxWidth: 620, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'inherit', fontSize: 'clamp(30px, 4.5vw, 50px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.08, margin: '0 0 18px', color: '#fff' }}>
              Первый шаг — просто заметить
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'rgba(255,255,255,.82)', margin: '0 0 34px' }}>
              Минутный чек-ин в день — и через пару недель паттерны станут видимыми.
              Бесплатно, бережно, в вашем темпе.
            </p>
            <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 34px', background: '#fff', color: 'var(--accent)', borderRadius: 12, fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 12px 34px rgba(0,0,0,.18)' }}>
              Начать бесплатно →
            </a>
          </div>
        </div>
      </section>

      {/* ── Футер ── */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '32px 24px' }}>
        <div className="pl-footer" style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
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
        @keyframes pl-drift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(3%,4%) scale(1.06); } }
        @keyframes pl-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.65); } }

        /* Только сдвиг, без opacity — текст всегда полностью виден (даже если
           переход подтормаживает или .revealed не успел примениться). */
        .reveal-section { transform: translateY(18px); transition: transform .6s cubic-bezier(.16,1,.3,1); }
        .reveal-section.revealed { transform: none; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .15s !important;
            scroll-behavior: auto !important;
          }
          .reveal-section { transform: none !important; }
        }

        @media (max-width: 900px) {
          .pl-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .pl-steps, .pl-features, .pl-trust, .pl-articles { grid-template-columns: 1fr !important; }
          .pl-tg-grid { grid-template-columns: 1fr !important; gap: 36px !important; padding: 36px 28px !important; }
          .pl-chip { display: none; }
        }
        @media (min-width: 601px) and (max-width: 900px) {
          .pl-features, .pl-articles { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .pl-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
