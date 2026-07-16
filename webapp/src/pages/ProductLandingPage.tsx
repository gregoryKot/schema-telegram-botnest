import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useRecentArticles } from '../components/landing-kit';
import type { ArticleSummary } from '../api';
import { botUrl, botHandle } from '../utils/botConfig';

// Продуктовый лендинг «Всё по схеме» — главная app-домена (schemehappens.ru).
// САМОСТОЯТЕЛЬНАЯ айдентика: тёмный «ночной» холст + аврора-градиенты, глассморфизм,
// крупная жирная типографика. Намеренно НЕ похоже на тёплую serif-страничку терапевта.
// Палитра захардкожена (не зависит от app-темы) — это отдельный маркетинговый бренд.

const BOT_URL = botUrl;
const AUTHOR_SITE = 'https://kotlarewski.gr';

// ─── Палитра (self-contained, тёмная) ────────────────────────────────────────
const INK = '#f3f1fb';
const SUB = 'rgba(243,241,251,.62)';
const FAINT = 'rgba(243,241,251,.40)';
const GLASS = 'rgba(255,255,255,.045)';
const GLASS_BORDER = 'rgba(255,255,255,.10)';
const VIOLET = '#a78bfa';
const PINK = '#f472b6';
const CYAN = '#38e0d0';
const AMBER = '#fbbf24';
const EMERALD = '#34d399';
const ROSE = '#fb7185';
const AURORA = 'linear-gradient(115deg, #a78bfa 0%, #f472b6 52%, #fb923c 100%)';
const glow = (c: string, a = 0.5) => `color-mix(in srgb, ${c} ${a * 100}%, transparent)`;

// ─── Логотип ──────────────────────────────────────────────────────────────────
function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
        background: AURORA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, boxShadow: `0 0 22px ${glow(PINK, .5)}`,
      }}>🧠</span>
      <span style={{ fontSize: 16.5, fontWeight: 800, color: INK, letterSpacing: '-.02em' }}>Всё по схеме</span>
    </span>
  );
}

// ─── Кнопки ───────────────────────────────────────────────────────────────────
function Cta({ href, children, variant = 'primary', size = 'md' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'ghost'; size?: 'md' | 'lg' }) {
  const pad = size === 'lg' ? '15px 30px' : '11px 22px';
  const fs = size === 'lg' ? 15 : 13.5;
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: pad, fontSize: fs, fontWeight: 700, fontFamily: 'inherit', borderRadius: 14,
    textDecoration: 'none', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s, background .15s',
    border: '1px solid transparent', boxSizing: 'border-box',
  };
  const styles: React.CSSProperties = variant === 'primary'
    ? { ...base, background: AURORA, color: '#1a0f2e', boxShadow: `0 8px 30px ${glow(VIOLET, .45)}` }
    : { ...base, background: 'rgba(255,255,255,.04)', color: INK, borderColor: GLASS_BORDER };
  const ext = href.startsWith('http');
  return (
    <a href={href} target={ext ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined} style={styles}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translateY(-2px)'; if (variant === 'primary') el.style.boxShadow = `0 14px 44px ${glow(PINK, .55)}`; else el.style.background = 'rgba(255,255,255,.09)'; }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; if (variant === 'primary') el.style.boxShadow = `0 8px 30px ${glow(VIOLET, .45)}`; else el.style.background = 'rgba(255,255,255,.04)'; }}>
      {children}
    </a>
  );
}

// ─── Мокап приложения (тёмное стекло) ─────────────────────────────────────────
const MOCK_NEEDS = [
  { emoji: '🤝', name: 'Привязанность', v: 7, c: CYAN },
  { emoji: '🚀', name: 'Автономия',     v: 8, c: EMERALD },
  { emoji: '⚖️', name: 'Границы',       v: 4, c: ROSE },
  { emoji: '🎉', name: 'Спонтанность',  v: 6, c: AMBER },
];
const MOCK_SPARK = [4, 5, 3, 6, 5, 7, 6, 8, 7, 8, 6, 9];

function AppPreview() {
  return (
    <div className="pl2-preview" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} aria-hidden>
      <div style={{
        width: 300, boxSizing: 'border-box', padding: '22px 20px 20px',
        background: 'linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03))',
        border: `1px solid ${GLASS_BORDER}`, borderRadius: 32,
        boxShadow: `0 40px 90px rgba(0,0,0,.5), 0 0 60px ${glow(VIOLET, .18)}`,
        backdropFilter: 'blur(12px)', animation: 'pl2-float 7s ease-in-out infinite',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: INK }}>Сегодня</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: FAINT }}>минутный чек-ин</span>
        </div>
        <p style={{ fontSize: 12, color: SUB, margin: '0 0 16px' }}>Как ты? Отметь свои потребности</p>
        {MOCK_NEEDS.map((n) => (
          <div key={n.name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: INK, fontWeight: 600 }}>{n.emoji} {n.name}</span>
              <span style={{ color: n.c, fontWeight: 800 }}>{n.v}</span>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'rgba(255,255,255,.08)' }}>
              <div style={{ width: `${n.v * 10}%`, height: '100%', borderRadius: 5, background: n.c, boxShadow: `0 0 10px ${glow(n.c, .6)}` }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 16, border: `1px solid ${GLASS_BORDER}`, background: 'rgba(255,255,255,.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: INK }}>Динамика</span>
            <span style={{ color: FAINT }}>2 недели</span>
          </div>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none">
            <defs><linearGradient id="pl2bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={VIOLET} /><stop offset="1" stopColor={PINK} /></linearGradient></defs>
            {MOCK_SPARK.map((v, i) => (
              <rect key={i} x={i * 18.5} y={42 - v * 4.2} width="11" height={v * 4.2} rx="3" fill="url(#pl2bar)" opacity={0.45 + (v / 9) * 0.55} />
            ))}
          </svg>
        </div>
      </div>
      <div className="pl2-chip" style={{ position: 'absolute', top: 30, right: -10, padding: '10px 14px', borderRadius: 14, background: 'rgba(20,14,34,.85)', border: `1px solid ${glow(PINK, .35)}`, boxShadow: `0 14px 40px rgba(0,0,0,.5)`, backdropFilter: 'blur(8px)', fontSize: 12, fontWeight: 700, color: INK, animation: 'pl2-float 6s ease-in-out .8s infinite' }}>
        <span style={{ color: PINK }}>🔍 Схема замечена</span>
        <div style={{ fontSize: 11, fontWeight: 500, color: SUB, marginTop: 2 }}>Покинутость · 3-й раз за неделю</div>
      </div>
      <div className="pl2-chip" style={{ position: 'absolute', bottom: 44, left: -16, padding: '10px 14px', borderRadius: 14, background: 'rgba(20,14,34,.85)', border: `1px solid ${glow(EMERALD, .35)}`, boxShadow: `0 14px 40px rgba(0,0,0,.5)`, backdropFilter: 'blur(8px)', fontSize: 12, fontWeight: 700, color: INK, animation: 'pl2-float 8s ease-in-out 1.6s infinite' }}>
        <span style={{ color: EMERALD }}>🌱 Критик — тише</span>
        <div style={{ fontSize: 11, fontWeight: 500, color: SUB, marginTop: 2 }}>реже, чем месяц назад</div>
      </div>
    </div>
  );
}

// ─── Данные ───────────────────────────────────────────────────────────────────
const STEPS = [
  { num: '01', color: ROSE,   emoji: '🌱', title: 'Схемы родом из детства', text: 'Когда важные потребности — в безопасности, принятии, тепле — недополучены, психика достраивает «правила»: «меня оставят», «я недостаточно хорош». Это ранние дезадаптивные схемы.' },
  { num: '02', color: AMBER,  emoji: '🔁', title: 'Они включаются незаметно', text: 'Во взрослой жизни схемы срабатывают на автомате: одни и те же ссоры, тревога, самокритика, прокрастинация. Кажется, что «такой характер» — а это выученный паттерн.' },
  { num: '03', color: CYAN,   emoji: '👁️', title: 'Их можно замечать — и менять', text: 'Регулярное наблюдение — дневник, тест, упражнения — делает схемы видимыми. А то, что видно, уже можно менять: самостоятельно или вместе с терапевтом.' },
];

const FEATURES = [
  { emoji: '📓', color: CYAN,    title: 'Дневник состояний', text: 'Минутный чек-ин: восемь базовых потребностей по шкале. Через пару недель видно, из чего складываются «плохие дни».' },
  { emoji: '🧩', color: VIOLET,  title: 'Диагностика схем', text: 'Тест по схемам: 20 ранних дезадаптивных схем в пяти доменах — с понятным разбором, а не просто цифрами.' },
  { emoji: '🎭', color: AMBER,   title: 'Режимы', text: 'Внутренний Критик, Уязвимый ребёнок, Здоровый взрослый — отмечайте, кто «за рулём» прямо сейчас.' },
  { emoji: '✍️', color: EMERALD, title: 'Практики', text: 'Упражнения из схема-терапии и КПТ: переоценка убеждений, терапевтические письма, безопасное место, флэшкарточки.' },
  { emoji: '📈', color: PINK,    title: 'Динамика', text: 'История состояний за недели и месяцы: что меняется, а что стоит на месте. Удобно приносить на сессии.' },
  { emoji: '🤝', color: ROSE,    title: 'Кабинет терапевта', text: 'Работаете с психологом? Поделитесь динамикой — и сессии будут опираться на реальные данные, а не только на память.' },
];

const TRUST = [
  { icon: '💛', color: AMBER,   title: 'Бесплатно', node: <>Без подписок и рекламы. Проект живёт на донаты — если он помогает, можно <a href="/donate" style={{ color: VIOLET, textDecoration: 'none', fontWeight: 700 }}>поддержать</a>.</> },
  { icon: '🔒', color: CYAN,    title: 'Записи зашифрованы', node: <>Дневники, письма и заметки хранятся в зашифрованном виде (AES-256). Прочитать их можете только вы.</> },
  { icon: '🚪', color: EMERALD, title: 'Уйти легко', node: <>Аккаунт удаляется в один клик — целиком, со всеми данными. Никаких «мы сохраним копию».</> },
];

const FAQ = [
  { q: 'Что такое схема-терапия?', a: 'Доказательный метод, разработанный Джеффри Янгом. Он объединяет КПТ, теорию привязанности и работу с эмоциями и помогает при повторяющихся трудностях: в отношениях, самооценке, тревоге. Схема-терапия работает с глубинными убеждениями — схемами, которые сформировались в детстве и незаметно управляют реакциями сейчас.' },
  { q: 'Это замена психотерапии?', a: 'Нет. «Всё по схеме» — инструмент самонаблюдения и самопомощи: он помогает замечать паттерны и бережно с ними работать, но не ставит диагнозов и не лечит. Если состояние тяжёлое — пожалуйста, обратитесь к специалисту. А если вы уже в терапии, приложение станет хорошим спутником между сессиями.' },
  { q: 'Сколько это стоит?', a: 'Нисколько. Все функции бесплатны — без пробных периодов и платных уровней. Проект существует на добровольные донаты.' },
  { q: 'Что будет с моими данными?', a: 'Свободный текст — дневники, письма, заметки — шифруется (AES-256) и никому не передаётся. Терапевт видит вашу динамику только если вы сами дали доступ. Аккаунт можно удалить полностью в любой момент.' },
  { q: 'Нужен ли Telegram?', a: 'Нет. Войти можно через Google, ВКонтакте или по ссылке на email. Telegram — приятное дополнение: бот напомнит про чек-ин, а мини-приложение работает прямо в чате, с теми же данными.' },
];

// ─── Стекло-карточка (иконка + заголовок + текст) ────────────────────────────
function GlassCard({ emoji, color, title, children, big }: { emoji: string; color: string; title: string; children: React.ReactNode; big?: boolean }) {
  return (
    <div className="pl2-card" style={{
      position: 'relative', background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 22,
      padding: big ? '28px 24px' : '24px 22px', overflow: 'hidden',
      transition: 'transform .25s, border-color .25s, box-shadow .25s',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: glow(color, .16), filter: 'blur(30px)', pointerEvents: 'none' }} />
      <span style={{ position: 'relative', width: 48, height: 48, borderRadius: 14, fontSize: 23, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: glow(color, .14), border: `1px solid ${glow(color, .3)}`, boxShadow: `0 0 20px ${glow(color, .15)}` }}>{emoji}</span>
      <p style={{ position: 'relative', fontSize: big ? 19 : 17, fontWeight: 800, letterSpacing: '-.02em', margin: '14px 0 8px', color: INK }}>{title}</p>
      <p style={{ position: 'relative', fontSize: 14, lineHeight: 1.65, margin: 0, color: SUB }}>{children}</p>
    </div>
  );
}

// ─── Карточка статьи ──────────────────────────────────────────────────────────
function ArticleCard({ a }: { a: ArticleSummary }) {
  return (
    <a className="pl2-card" href={`/articles/${a.slug}`} style={{
      display: 'flex', flexDirection: 'column', textDecoration: 'none',
      background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 20, overflow: 'hidden',
      transition: 'transform .25s, border-color .25s, box-shadow .25s',
    }}>
      <div style={{ aspectRatio: '16 / 9', background: AURORA, overflow: 'hidden', opacity: a.heroImage ? 1 : 0.5 }}>
        {a.heroImage && <img src={a.heroImage} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </div>
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25, margin: 0, color: INK }}>{a.title}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: SUB, flex: 1 }}>{a.description}</p>
        <span style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>{new Date(a.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · {a.readMin} мин</span>
      </div>
    </a>
  );
}

function FaqList() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ background: GLASS, border: `1px solid ${isOpen ? glow(VIOLET, .4) : GLASS_BORDER}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color .2s' }}>
            <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1.4, fontFamily: 'inherit' }}>{item.q}</span>
              <span style={{ fontSize: 22, color: VIOLET, flexShrink: 0, lineHeight: 1, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .3s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: SUB, margin: '0 20px 20px' }}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const H2: React.CSSProperties = { fontFamily: 'inherit', fontSize: 'clamp(28px, 3.6vw, 44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.08, margin: 0, color: INK };
const EYEBROW: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', background: AURORA, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

// ─── Страница ─────────────────────────────────────────────────────────────────
export function ProductLandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const articles = useRecentArticles(3);

  useEffect(() => { if (isAuthenticated) navigate('/today', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => { document.title = 'Всё по схеме — инструмент схема-терапии'; }, []);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, overflowX: 'hidden', minHeight: '100dvh', background: '#0b0817', color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Аврора-фон (фиксированный) */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: glow(VIOLET, .22), filter: 'blur(120px)', top: '-18%', left: '-10%' }} />
        <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', background: glow(PINK, .16), filter: 'blur(120px)', top: '20%', right: '-14%' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: glow(CYAN, .12), filter: 'blur(130px)', bottom: '-10%', left: '20%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Навбар ── */}
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 24px', boxSizing: 'border-box', background: 'rgba(11,8,23,.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${GLASS_BORDER}` }}>
          <a href="/" style={{ textDecoration: 'none' }}><Logo /></a>
          <nav className="pl2-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[['Как это работает', '#how'], ['Возможности', '#features'], ['Статьи', '#articles'], ['Вопросы', '#faq']].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 13.5, fontWeight: 600, color: SUB, textDecoration: 'none', padding: '7px 12px', borderRadius: 10, whiteSpace: 'nowrap', transition: 'color .15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = INK; }} onMouseLeave={(e) => { e.currentTarget.style.color = SUB; }}>{label}</a>
            ))}
          </nav>
          <Cta href="/login">Войти</Cta>
        </header>

        {/* ── Hero ── */}
        <section style={{ padding: '140px 24px 90px' }}>
          <div className="pl2-hero" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.06fr 1fr', gap: 56, alignItems: 'center' }}>
            <div style={{ animation: 'pl2-in .7s cubic-bezier(.16,1,.3,1) both' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'rgba(255,255,255,.05)', border: `1px solid ${GLASS_BORDER}`, fontSize: 12.5, fontWeight: 700, color: SUB, marginBottom: 26 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PINK, boxShadow: `0 0 10px ${PINK}`, animation: 'pl2-pulse 2.5s ease-in-out infinite' }} />
                Схема-терапия · бесплатно · без рекламы
              </div>
              <h1 style={{ fontFamily: 'inherit', fontSize: 'clamp(40px, 5.6vw, 68px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-.04em', margin: '0 0 22px', color: INK }}>
                Почему со мной <span style={{ background: AURORA, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>снова</span> это&nbsp;происходит?
              </h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: SUB, maxWidth: 490, margin: '0 0 34px' }}>
                Одни и те же ссоры, тревога, самокритика — это не «характер», а&nbsp;схемы:
                выученные паттерны, которые можно заметить и постепенно менять.
                «Всё по схеме» — бесплатное приложение для самостоятельной работы в подходе схема-терапии.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <Cta href="/login" size="lg">Начать бесплатно →</Cta>
                <Cta href="#how" variant="ghost" size="lg">Как это работает</Cta>
              </div>
              <p style={{ fontSize: 12.5, color: FAINT, margin: '18px 0 0' }}>Вход через Google, ВКонтакте, Telegram или email · регистрация не нужна</p>
            </div>
            <div style={{ animation: 'pl2-in .7s cubic-bezier(.16,1,.3,1) .15s both' }}><AppPreview /></div>
          </div>
        </section>

        {/* ── Как это работает ── */}
        <section id="how" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <span style={EYEBROW}>Как это работает</span>
            <h2 style={{ ...H2, margin: '14px 0 48px', maxWidth: 700 }}>Не «что со мной не так», а «какая схема включилась»</h2>
            <div className="pl2-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {STEPS.map((s) => (
                <div key={s.num} className="pl2-card" style={{ position: 'relative', background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 22, padding: '28px 24px', overflow: 'hidden', transition: 'transform .25s, border-color .25s, box-shadow .25s' }}>
                  <div aria-hidden style={{ position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: '50%', background: glow(s.color, .16), filter: 'blur(34px)' }} />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <span style={{ width: 48, height: 48, borderRadius: 14, fontSize: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: glow(s.color, .14), border: `1px solid ${glow(s.color, .3)}` }}>{s.emoji}</span>
                    <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', color: glow(s.color, .55) }}>{s.num}</span>
                  </div>
                  <p style={{ position: 'relative', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px', color: INK }}>{s.title}</p>
                  <p style={{ position: 'relative', fontSize: 14, lineHeight: 1.7, color: SUB, margin: 0 }}>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Возможности ── */}
        <section id="features" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <span style={EYEBROW}>Возможности</span>
            <h2 style={{ ...H2, margin: '14px 0 48px', maxWidth: 620 }}>Всё для работы между сессиями — или до них</h2>
            <div className="pl2-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {FEATURES.map((f) => <GlassCard key={f.title} emoji={f.emoji} color={f.color} title={f.title} big>{f.text}</GlassCard>)}
            </div>
          </div>
        </section>

        {/* ── Telegram ── */}
        <section style={{ padding: '20px 24px 72px' }}>
          <div className="pl2-tg" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center', background: 'linear-gradient(120deg, rgba(167,139,250,.12), rgba(56,224,208,.08))', border: `1px solid ${GLASS_BORDER}`, borderRadius: 28, padding: '48px 44px' }}>
            <div>
              <span style={EYEBROW}>Telegram</span>
              <h2 style={{ ...H2, margin: '14px 0 18px' }}>Живёт и в&nbsp;Telegram</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: SUB, maxWidth: 470, margin: '0 0 26px' }}>
                Бот <strong style={{ color: INK }}>{botHandle}</strong> раз в месяц мягко напомнит заглянуть на чек-ин,
                а мини-приложение открывается прямо в чате — тот же дневник, те же схемы.
                Данные общие с сайтом: начните в телефоне, продолжите в браузере.
              </p>
              <Cta href={BOT_URL} size="lg">Открыть в Telegram ↗</Cta>
            </div>
            <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, width: '100%', justifySelf: 'center' }}>
              <div style={{ padding: '14px 16px', borderRadius: '16px 16px 16px 6px', background: 'rgba(255,255,255,.05)', border: `1px solid ${GLASS_BORDER}`, backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: AURORA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🧠</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Всё по схеме</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: SUB, margin: 0 }}>🌤️ Как ты в этом месяце? Пара минут на чек-ин помогут увидеть динамику.</p>
                <div style={{ marginTop: 12, padding: '9px 14px', borderRadius: 10, background: AURORA, color: '#1a0f2e', fontSize: 13, fontWeight: 800, textAlign: 'center' }}>Открыть чек-ин</div>
              </div>
              <span style={{ fontSize: 11.5, color: FAINT, alignSelf: 'center' }}>мини-приложение открывается прямо в чате</span>
            </div>
          </div>
        </section>

        {/* ── Доверие ── */}
        <section style={{ padding: '20px 24px 72px' }}>
          <div className="pl2-3" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {TRUST.map((t) => <GlassCard key={t.title} emoji={t.icon} color={t.color} title={t.title}>{t.node}</GlassCard>)}
          </div>
        </section>

        {/* ── Статьи ── */}
        {articles && articles.length > 0 && (
          <section id="articles" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
            <div style={{ maxWidth: 1160, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 44 }}>
                <div>
                  <span style={EYEBROW}>Статьи</span>
                  <h2 style={{ ...H2, margin: '14px 0 0', maxWidth: 620 }}>Разбираемся в схема-терапии — простым языком</h2>
                </div>
                <a href="/articles" style={{ fontSize: 14, fontWeight: 700, color: VIOLET, textDecoration: 'none', whiteSpace: 'nowrap' }}>Все статьи →</a>
              </div>
              <div className="pl2-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                {articles.map((a) => <ArticleCard key={a.slug} a={a} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        <section id="faq" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <span style={EYEBROW}>Вопросы</span>
            <h2 style={{ ...H2, margin: '14px 0 36px' }}>Частые вопросы</h2>
            <FaqList />
          </div>
        </section>

        {/* ── Финальный CTA ── */}
        <section style={{ padding: '24px 24px 96px' }}>
          <div style={{ position: 'relative', overflow: 'hidden', maxWidth: 1160, margin: '0 auto', background: AURORA, borderRadius: 32, padding: '76px 32px', textAlign: 'center' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,.25), transparent 60%)' }} />
            <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'inherit', fontSize: 'clamp(32px, 4.6vw, 52px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.06, margin: '0 0 18px', color: '#1a0f2e' }}>Первый шаг — просто заметить</h2>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(26,15,46,.78)', margin: '0 0 34px', fontWeight: 500 }}>Минутный чек-ин в день — и через пару недель паттерны станут видимыми. Бесплатно, бережно, в вашем темпе.</p>
              <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 34px', background: '#12091f', color: INK, borderRadius: 14, fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 12px 34px rgba(0,0,0,.3)' }}>Начать бесплатно →</a>
            </div>
          </div>
        </section>

        {/* ── Футер ── */}
        <footer style={{ borderTop: `1px solid ${GLASS_BORDER}`, padding: '32px 24px' }}>
          <div className="pl2-footer" style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Logo size={26} />
              <span style={{ fontSize: 12.5, color: FAINT }}>© {new Date().getFullYear()}</span>
            </div>
            <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[['Политика конфиденциальности', '/privacy'], ['Оферта', '/offer'], ['Поддержать 💛', '/donate'], ['Автор проекта ↗', AUTHOR_SITE]].map(([label, href]) => (
                <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ fontSize: 13, color: SUB, textDecoration: 'none', transition: 'color .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = INK; }} onMouseLeave={(e) => { e.currentTarget.style.color = SUB; }}>{label}</a>
              ))}
            </nav>
          </div>
        </footer>
      </div>

      {/* ── Стили ── */}
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes pl2-in    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes pl2-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pl2-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.6); } }
        .pl2-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,.22); box-shadow: 0 18px 50px rgba(0,0,0,.4); }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
        }
        @media (max-width: 900px) {
          .pl2-hero { grid-template-columns: 1fr !important; gap: 48px !important; }
          .pl2-3 { grid-template-columns: 1fr !important; }
          .pl2-tg { grid-template-columns: 1fr !important; gap: 36px !important; padding: 36px 28px !important; }
          .pl2-chip { display: none; }
        }
        @media (min-width: 601px) and (max-width: 900px) { .pl2-3 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 640px) { .pl2-nav { display: none !important; } }
      `}</style>
    </div>
  );
}
