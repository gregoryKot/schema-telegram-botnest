import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useRecentArticles } from '../components/landing-kit';
import type { ArticleSummary } from '../api';

// Продуктовый лендинг «Всё по схеме» — главная app-домена (schemehappens.ru).
// САМОСТОЯТЕЛЬНАЯ структура: бенто-сетка + горизонтальный степпер + тонкие полосы,
// а НЕ повторяющийся ритм «надзаголовок → заголовок → 3 карточки» (как у терапевта).
// Палитра тёмная, захардкожена — отдельный маркетинговый бренд.

const BOT_URL = 'https://t.me/SchemaLabBot';
const AUTHOR_SITE = 'https://kotlarewski.gr';

// ─── Палитра ──────────────────────────────────────────────────────────────────
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
      <span style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, background: AURORA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, boxShadow: `0 0 22px ${glow(PINK, .5)}` }}>🧠</span>
      <span style={{ fontSize: 16.5, fontWeight: 800, color: INK, letterSpacing: '-.02em' }}>Всё по схеме</span>
    </span>
  );
}

// ─── Кнопки ───────────────────────────────────────────────────────────────────
function Cta({ href, children, variant = 'primary', size = 'md' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'ghost'; size?: 'md' | 'lg' }) {
  const pad = size === 'lg' ? '15px 30px' : '11px 22px';
  const fs = size === 'lg' ? 15 : 13.5;
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: pad, fontSize: fs, fontWeight: 700, fontFamily: 'inherit', borderRadius: 14, textDecoration: 'none', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s, background .15s', border: '1px solid transparent', boxSizing: 'border-box' };
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

// ─── Мини-мокап чек-ина (для большой плитки бенто) ───────────────────────────
const MOCK_NEEDS = [
  { emoji: '🤝', name: 'Привязанность', v: 7, c: CYAN },
  { emoji: '🚀', name: 'Автономия',     v: 8, c: EMERALD },
  { emoji: '⚖️', name: 'Границы',       v: 4, c: ROSE },
  { emoji: '🎉', name: 'Спонтанность',  v: 6, c: AMBER },
];
function CheckinMock() {
  return (
    <div style={{ background: 'rgba(0,0,0,.25)', border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: '18px 18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', color: INK }}>Сегодня</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: FAINT }}>минутный чек-ин</span>
      </div>
      <p style={{ fontSize: 12, color: SUB, margin: '0 0 14px' }}>Как ты? Отметь свои потребности</p>
      {MOCK_NEEDS.map((n) => (
        <div key={n.name} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: INK, fontWeight: 600 }}>{n.emoji} {n.name}</span>
            <span style={{ color: n.c, fontWeight: 800 }}>{n.v}</span>
          </div>
          <div style={{ height: 6, borderRadius: 5, background: 'rgba(255,255,255,.08)' }}>
            <div style={{ width: `${n.v * 10}%`, height: '100%', borderRadius: 5, background: n.c, boxShadow: `0 0 10px ${glow(n.c, .6)}` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
const SPARK = [4, 5, 3, 6, 5, 7, 6, 8, 7, 8, 6, 9];
function SparkMock() {
  return (
    <svg width="100%" height="52" viewBox="0 0 220 52" preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id="pl2bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={VIOLET} /><stop offset="1" stopColor={PINK} /></linearGradient></defs>
      {SPARK.map((v, i) => (<rect key={i} x={i * 18.5} y={52 - v * 5.4} width="12" height={v * 5.4} rx="3" fill="url(#pl2bar)" opacity={0.45 + (v / 9) * 0.55} />))}
    </svg>
  );
}

// ─── Плитка бенто ─────────────────────────────────────────────────────────────
function Tile({ children, span, rowSpan, accent, style }: { children: React.ReactNode; span: number; rowSpan?: number; accent?: boolean; style?: React.CSSProperties }) {
  return (
    <div className="pl2-tile" style={{
      gridColumn: `span ${span}`, gridRow: rowSpan ? `span ${rowSpan}` : undefined,
      position: 'relative', overflow: 'hidden', borderRadius: 22,
      background: accent ? AURORA : GLASS, border: accent ? 'none' : `1px solid ${GLASS_BORDER}`,
      padding: 24, display: 'flex', flexDirection: 'column',
      transition: 'transform .25s, border-color .25s, box-shadow .25s', ...style,
    }}>{children}</div>
  );
}
function TileHead({ emoji, color, title }: { emoji: string; color: string; title: string }) {
  return (
    <>
      <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: glow(color, .16), filter: 'blur(32px)', pointerEvents: 'none' }} />
      <span style={{ position: 'relative', width: 44, height: 44, borderRadius: 13, fontSize: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: glow(color, .14), border: `1px solid ${glow(color, .3)}`, marginBottom: 12 }}>{emoji}</span>
      <p style={{ position: 'relative', fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', margin: 0, color: INK }}>{title}</p>
    </>
  );
}
const tileText: React.CSSProperties = { position: 'relative', fontSize: 13.5, lineHeight: 1.6, margin: '7px 0 0', color: SUB };

// ─── Степпер «как это работает» ──────────────────────────────────────────────
const STEPS = [
  { num: '01', color: ROSE,  title: 'Схемы родом из детства', text: 'Недополученные потребности в безопасности, принятии, тепле — и психика достраивает «правила»: «меня оставят», «я недостаточно хорош».' },
  { num: '02', color: AMBER, title: 'Включаются незаметно', text: 'Во взрослой жизни срабатывают на автомате: те же ссоры, тревога, самокритика. Кажется «характер» — а это выученный паттерн.' },
  { num: '03', color: CYAN,  title: 'Их можно менять', text: 'Дневник, тест, упражнения делают схемы видимыми. А то, что видно, — уже можно менять: самому или с терапевтом.' },
];

// ─── Данные ───────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: '💛', title: 'Бесплатно', node: <>без подписок и рекламы, живёт на <a href="/donate" style={{ color: VIOLET, textDecoration: 'none', fontWeight: 700 }}>донаты</a></> },
  { icon: '🔒', title: 'Зашифровано', node: <>дневники и заметки — AES-256, читаете только вы</> },
  { icon: '🚪', title: 'Уйти легко', node: <>аккаунт удаляется в один клик, целиком</> },
];

const FAQ = [
  { q: 'Что такое схема-терапия?', a: 'Доказательный метод, разработанный Джеффри Янгом. Он объединяет КПТ, теорию привязанности и работу с эмоциями и помогает при повторяющихся трудностях: в отношениях, самооценке, тревоге. Схема-терапия работает с глубинными убеждениями — схемами, которые сформировались в детстве и незаметно управляют реакциями сейчас.' },
  { q: 'Это замена психотерапии?', a: 'Нет. «Всё по схеме» — инструмент самонаблюдения и самопомощи: он помогает замечать паттерны и бережно с ними работать, но не ставит диагнозов и не лечит. Если состояние тяжёлое — пожалуйста, обратитесь к специалисту. А если вы уже в терапии, приложение станет хорошим спутником между сессиями.' },
  { q: 'Сколько это стоит?', a: 'Нисколько. Все функции бесплатны — без пробных периодов и платных уровней. Проект существует на добровольные донаты.' },
  { q: 'Что будет с моими данными?', a: 'Свободный текст — дневники, письма, заметки — шифруется (AES-256) и никому не передаётся. Терапевт видит вашу динамику только если вы сами дали доступ. Аккаунт можно удалить полностью в любой момент.' },
  { q: 'Нужен ли Telegram?', a: 'Нет. Войти можно через Google, ВКонтакте или по ссылке на email. Telegram — приятное дополнение: бот напомнит про чек-ин, а мини-приложение работает прямо в чате, с теми же данными.' },
];

function ArticleCard({ a }: { a: ArticleSummary }) {
  return (
    <a className="pl2-tile" href={`/articles/${a.slug}`} style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 20, overflow: 'hidden', transition: 'transform .25s, border-color .25s, box-shadow .25s' }}>
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
              <div style={{ overflow: 'hidden' }}><p style={{ fontSize: 14.5, lineHeight: 1.75, color: SUB, margin: '0 20px 20px' }}>{item.a}</p></div>
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
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 720, height: 720, borderRadius: '50%', background: glow(VIOLET, .22), filter: 'blur(120px)', top: '-20%', left: '-8%' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: glow(PINK, .15), filter: 'blur(120px)', top: '30%', right: '-14%' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: glow(CYAN, .1), filter: 'blur(130px)', bottom: '-8%', left: '25%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Навбар ── */}
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 24px', boxSizing: 'border-box', background: 'rgba(11,8,23,.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${GLASS_BORDER}` }}>
          <a href="/" style={{ textDecoration: 'none' }}><Logo /></a>
          <nav className="pl2-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[['Обзор', '#bento'], ['Как это работает', '#how'], ['Статьи', '#articles'], ['Вопросы', '#faq']].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 13.5, fontWeight: 600, color: SUB, textDecoration: 'none', padding: '7px 12px', borderRadius: 10, whiteSpace: 'nowrap', transition: 'color .15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = INK; }} onMouseLeave={(e) => { e.currentTarget.style.color = SUB; }}>{label}</a>
            ))}
          </nav>
          <Cta href="/login">Войти</Cta>
        </header>

        {/* ── Hero: по центру, без бокового мокапа ── */}
        <section style={{ padding: '150px 24px 40px', textAlign: 'center' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', animation: 'pl2-in .7s cubic-bezier(.16,1,.3,1) both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'rgba(255,255,255,.05)', border: `1px solid ${GLASS_BORDER}`, fontSize: 12.5, fontWeight: 700, color: SUB, marginBottom: 26 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PINK, boxShadow: `0 0 10px ${PINK}`, animation: 'pl2-pulse 2.5s ease-in-out infinite' }} />
              Схема-терапия · бесплатно · без рекламы
            </div>
            <h1 style={{ fontFamily: 'inherit', fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 800, lineHeight: 1.0, letterSpacing: '-.045em', margin: '0 0 24px', color: INK }}>
              Почему со мной <span style={{ background: AURORA, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>снова</span> это&nbsp;происходит?
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: SUB, maxWidth: 620, margin: '0 auto 34px' }}>
              Одни и те же ссоры, тревога, самокритика — это не «характер», а&nbsp;схемы: выученные паттерны,
              которые можно заметить и постепенно менять. Бесплатное приложение для самостоятельной работы
              в подходе схема-терапии.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Cta href="/login" size="lg">Начать бесплатно →</Cta>
              <Cta href="#bento" variant="ghost" size="lg">Что внутри</Cta>
            </div>
            <p style={{ fontSize: 12.5, color: FAINT, margin: '18px 0 0' }}>Вход через Google, ВКонтакте, Telegram или email · регистрация не нужна</p>
          </div>
        </section>

        {/* ── БЕНТО: продукт одним экраном (главный структурный ход) ── */}
        <section id="bento" style={{ padding: '40px 24px 72px', scrollMarginTop: 70 }}>
          <div className="pl2-bento" style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {/* Большая плитка — живой чек-ин */}
            <Tile span={2} rowSpan={2} style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025))' }}>
              <div aria-hidden style={{ position: 'absolute', top: -60, left: -30, width: 200, height: 200, borderRadius: '50%', background: glow(VIOLET, .16), filter: 'blur(50px)' }} />
              <span style={{ position: 'relative', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: CYAN }}>Дневник состояний</span>
              <p style={{ position: 'relative', fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', margin: '8px 0 16px', color: INK }}>Минута в день — и видно, из чего складываются «плохие дни»</p>
              <div style={{ position: 'relative', marginTop: 'auto' }}><CheckinMock /></div>
            </Tile>

            <Tile span={2}>
              <TileHead emoji="🧩" color={VIOLET} title="Диагностика схем" />
              <p style={tileText}>Тест ЯСО: 20 ранних дезадаптивных схем в пяти доменах — с понятным разбором, а не просто цифрами.</p>
            </Tile>

            <Tile span={1}>
              <TileHead emoji="🎭" color={AMBER} title="Режимы" />
              <p style={tileText}>Кто «за рулём» прямо сейчас — Критик, Ребёнок, Взрослый.</p>
            </Tile>

            <Tile span={1}>
              <TileHead emoji="✍️" color={EMERALD} title="Практики" />
              <p style={tileText}>Письма, безопасное место, флэшкарточки, переоценка убеждений.</p>
            </Tile>

            <Tile span={2}>
              <TileHead emoji="📈" color={PINK} title="Динамика" />
              <p style={{ ...tileText, marginBottom: 14 }}>История за недели и месяцы — что меняется, а что стоит на месте.</p>
              <div style={{ position: 'relative', marginTop: 'auto' }}><SparkMock /></div>
            </Tile>

            <Tile span={1}>
              <TileHead emoji="🤝" color={ROSE} title="Кабинет терапевта" />
              <p style={tileText}>Поделитесь динамикой — сессии на реальных данных.</p>
            </Tile>

            <Tile span={1} accent>
              <span style={{ fontSize: 30 }}>💛</span>
              <p style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: '10px 0 4px', color: '#1a0f2e' }}>Бесплатно</p>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'rgba(26,15,46,.72)', fontWeight: 600 }}>без подписок и рекламы</p>
            </Tile>
          </div>
        </section>

        {/* ── Как это работает — горизонтальный степпер (не карточки) ── */}
        <section id="how" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <span style={EYEBROW}>Как это работает</span>
            <h2 style={{ ...H2, margin: '14px 0 56px', maxWidth: 700 }}>Не «что со мной не так», а «какая схема включилась»</h2>
            <div className="pl2-flow" style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
              {STEPS.map((s, i) => (
                <div key={s.num} style={{ display: 'contents' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, background: `linear-gradient(120deg, ${s.color}, ${INK})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', marginBottom: 16 }}>{s.num}</div>
                    <p style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px', color: INK }}>{s.title}</p>
                    <p style={{ fontSize: 14.5, lineHeight: 1.65, color: SUB, margin: 0, maxWidth: 300 }}>{s.text}</p>
                  </div>
                  {i < STEPS.length - 1 && <div className="pl2-arrow" aria-hidden style={{ alignSelf: 'flex-start', fontSize: 28, color: FAINT, padding: '4px 8px', lineHeight: 1 }}>→</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Telegram — узкая полоса-баннер ── */}
        <section style={{ padding: '20px 24px 40px' }}>
          <div className="pl2-tg" style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', background: 'linear-gradient(120deg, rgba(167,139,250,.12), rgba(56,224,208,.08))', border: `1px solid ${GLASS_BORDER}`, borderRadius: 24, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
              <span style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 15, background: AURORA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🧠</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px', color: INK }}>Живёт и в Telegram</p>
                <p style={{ fontSize: 14, lineHeight: 1.55, color: SUB, margin: 0, maxWidth: 560 }}>
                  Бот <strong style={{ color: INK }}>@SchemaLabBot</strong> мягко напомнит про чек-ин, мини-приложение открывается прямо в чате. Данные общие с сайтом.
                </p>
              </div>
            </div>
            <Cta href={BOT_URL} size="lg">Открыть в Telegram ↗</Cta>
          </div>
        </section>

        {/* ── Доверие — тонкая полоса из трёх пунктов (не карточки) ── */}
        <section style={{ padding: '20px 24px 60px' }}>
          <div className="pl2-trust" style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'stretch', background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 20, overflow: 'hidden' }}>
            {TRUST.map((t, i) => (
              <div key={t.title} className="pl2-trust-item" style={{ flex: 1, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: i ? `1px solid ${GLASS_BORDER}` : 'none' }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{t.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', margin: '0 0 2px', color: INK }}>{t.title}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: SUB, margin: 0 }}>{t.node}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Статьи ── */}
        {articles && articles.length > 0 && (
          <section id="articles" style={{ padding: '60px 24px', scrollMarginTop: 70 }}>
            <div style={{ maxWidth: 1160, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
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
        <section id="faq" style={{ padding: '60px 24px', scrollMarginTop: 70 }}>
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
        .pl2-tile:hover { transform: translateY(-4px); box-shadow: 0 18px 50px rgba(0,0,0,.4); }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
        }
        @media (max-width: 900px) {
          .pl2-bento { grid-template-columns: repeat(2, 1fr) !important; }
          .pl2-bento .pl2-tile { grid-column: span 2 !important; grid-row: auto !important; }
          .pl2-flow { flex-direction: column !important; gap: 28px !important; }
          .pl2-arrow { display: none !important; }
          .pl2-trust { flex-direction: column !important; }
          .pl2-trust-item { border-left: none !important; border-top: 1px solid ${GLASS_BORDER} !important; }
          .pl2-trust-item:first-child { border-top: none !important; }
          .pl2-3 { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 601px) and (max-width: 900px) { .pl2-3 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 640px) { .pl2-nav { display: none !important; } }
      `}</style>
    </div>
  );
}
