import { useState, lazy, Suspense } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../utils/storageKeys';
import { TherapyNote } from './TherapyNote';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
export { SCHEMA_DOMAINS };

const YSQTestSheet = lazy(() => import('./YSQTestSheet').then(m => ({ default: m.YSQTestSheet })));

type Tab = 'needs' | 'schemas' | 'modes';

/* ─── 5 Core Needs ─── */
const NEEDS_DATA = [
  {
    emoji: '🤝',
    title: 'Привязанность',
    subtitle: 'Безопасность и связь',
    desc: 'Потребность в стабильных, надёжных отношениях – чтобы тебя принимали, слышали и не бросали. Когда она не удовлетворена, появляются тревога, страх одиночества и сложности с доверием.',
  },
  {
    emoji: '🚀',
    title: 'Автономия',
    subtitle: 'Контроль и компетентность',
    desc: 'Потребность чувствовать себя способным справляться самостоятельно, делать выборы и отвечать за свою жизнь. Дефицит проявляется как беспомощность, зависимость от чужого мнения или страх ошибиться.',
  },
  {
    emoji: '💬',
    title: 'Выражение чувств',
    subtitle: 'Свобода самовыражения',
    desc: 'Потребность в том, чтобы чувства и мысли были услышаны и приняты – без осуждения. Когда эта потребность хронически не удовлетворяется, эмоции подавляются или взрываются.',
  },
  {
    emoji: '🎉',
    title: 'Спонтанность',
    subtitle: 'Игра и радость',
    desc: 'Потребность в лёгкости, веселье и отдыхе без чувства вины. Жёсткие стандарты и самокритика блокируют её, создавая ощущение серьёзности и долга вместо радости.',
  },
  {
    emoji: '⚖️',
    title: 'Границы',
    subtitle: 'Самодисциплина и уважение',
    desc: 'Потребность устанавливать разумные пределы – для себя и с другими. Без неё трудно сдерживать импульсы, говорить «нет» и уважать чужие границы.',
  },
];

/* ─── Schema Modes ─── */
const MODES = [
  {
    group: 'Детские режимы',
    color: 'var(--accent-blue)',
    items: [
      { name: 'Уязвимый Ребёнок', emoji: '🥺', feel: 'одиноко, страшно, грустно, покинуто', desc: 'Базовый режим боли – ранние чувства брошенности, стыда или беспомощности. Активируется, когда что-то задевает схему. Нуждается в безопасности, тепле и присутствии.' },
      { name: 'Сердитый / Разъярённый Ребёнок', emoji: '😤', feel: 'злость, ярость, «это несправедливо»', desc: 'Незрелая злость в ответ на нарушение потребностей. Сердитый ребёнок – реагирует, Разъярённый – вспыхивает. Возникает, когда потребности игнорировались или воспринята несправедливость.' },
      { name: 'Импульсивный / Недисциплинированный Ребёнок', emoji: '⚡', feel: 'хочу сейчас, скучно, не могу терпеть', desc: 'Действует импульсивно, требует немедленного удовлетворения. В умеренной форме – нежелание прилагать усилия ради долгосрочных целей, сложность терпеть дискомфорт.' },
    ],
  },
  {
    group: 'Дисфункциональные копинги',
    color: 'var(--accent-orange)',
    items: [
      { name: 'Послушный Капитулянт', emoji: '😶', feel: 'соглашаюсь, лишь бы не конфликтовать', desc: 'Подчиняется ожиданиям других. Подавляет собственные потребности ради сохранения отношений или избегания наказания.' },
      { name: 'Отстранённый Защитник', emoji: '🌫️', feel: 'онемение, отстранённость, «не трогайте меня»', desc: 'Уходит от боли через эмоциональную изоляцию, прокрастинацию, отвлечение. Временно снижает страдание, но блокирует контакт с собой и другими.' },
      { name: 'Самовозвеличиватель / Гиперкомпенсатор', emoji: '🔥', feel: 'контроль, превосходство, «я лучше знаю»', desc: 'Борьба со схемой через противоположное – сверхдостижения, контроль, грандиозность. Внешне сильный, внутри – тот же страх или стыд.' },
    ],
  },
  {
    group: 'Критикующие режимы',
    color: 'var(--accent-red)',
    items: [
      { name: 'Карающий Критик', emoji: '😠', feel: 'стыд, «я плохой», самонаказание', desc: 'Голос, который жёстко атакует и наказывает за ошибки. Усвоенный голос значимого взрослого, который критиковал, стыдил или наказывал.' },
      { name: 'Требовательный Критик', emoji: '😬', feel: 'давление, «недостаточно стараюсь», тревога', desc: 'Постоянное давление высоких стандартов – пока всё не идеально, нельзя отдыхать. Нередко маскируется под «продуктивность».' },
      { name: 'Внушающий Вину Критик', emoji: '😔', feel: 'вина, «я подвёл», долг', desc: 'Постоянно напоминает об обязательствах перед другими, формирует чувство вины. Часто стоит за самопожертвованием и трудностью говорить «нет».' },
    ],
  },
  {
    group: 'Здоровые режимы',
    color: 'var(--accent-green)',
    items: [
      { name: 'Счастливый Ребёнок', emoji: '😄', feel: 'лёгкость, радость, игривость', desc: 'Спонтанность, любопытство, радость без тревоги. Признак того, что базовые потребности сейчас удовлетворены.' },
      { name: 'Здоровый Взрослый', emoji: '🌿', feel: 'спокойно, ясно, устойчиво', desc: 'Главная цель схема-терапии. В этом режиме ты можешь заботиться о своих потребностях, ставить границы, успокаивать Уязвимого Ребёнка.' },
    ],
  },
];

/* ─── Mode Check-in data ─── */
const MODE_CHECKIN = [
  { emoji: '🥺', label: 'Одиноко / страшно', mode: 'Уязвимый Ребёнок', tip: 'Найди что-то тёплое – разговор, объятие, уют. Уязвимый Ребёнок нуждается в безопасности и присутствии, а не в советах.' },
  { emoji: '😤', label: 'Злюсь / несправедливо', mode: 'Сердитый Ребёнок', tip: 'Сначала – тело. Выдох, пауза, движение. Потом можно разбираться с ситуацией. Злость – сигнал о нарушенной потребности.' },
  { emoji: '😬', label: 'Давление / «надо больше»', mode: 'Требовательный Критик', tip: 'Это не твой голос – это усвоенное. Спроси: что бы я сказал другу в такой же ситуации?' },
  { emoji: '😠', label: 'Стыдно / я плохой', mode: 'Карающий Критик', tip: 'Карающий Критик врёт. Ошибки – часть человеческого опыта, не приговор. Попробуй сострадание к себе.' },
  { emoji: '😔', label: 'Виноват / должен всем', mode: 'Критик вины', tip: 'Чувство вины – не факт. Попробуй отделить: это реальная ответственность или усвоенный голос о долге?' },
  { emoji: '🌫️', label: 'Хочу отключиться', mode: 'Отстранённый Защитник', tip: 'За отстранённостью – боль. Попробуй назвать, что именно больно, хотя бы для себя.' },
  { emoji: '😶', label: 'Соглашаюсь, хотя не хочу', mode: 'Послушный Капитулянт', tip: 'Твои потребности тоже важны. Даже маленький «нет» – шаг к себе.' },
  { emoji: '🔥', label: 'Контролирую / превосхожу', mode: 'Гиперкомпенсатор', tip: 'Грандиозность – это Уязвимый Ребёнок в доспехах. Что ты защищаешь?' },
  { emoji: '💚', label: 'Поддерживаю себя', mode: 'Хороший Родитель', tip: 'Запомни это ощущение – к нему можно возвращаться.' },
  { emoji: '😄', label: 'Легко и радостно', mode: 'Счастливый Ребёнок', tip: 'Лёгкость и радость без тревоги – это ты, когда тебе хорошо. Просто побудь в этом.' },
  { emoji: '🌿', label: 'Спокойно и устойчиво', mode: 'Здоровый Взрослый', tip: 'Хорошее время для рефлексии и сложных решений.' },
];

/* ─── Sub-components ─── */
function NeedsTab() {
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
        Схема-терапия строится на идее, что у каждого есть пять базовых эмоциональных потребностей. Когда они систематически не удовлетворялись в детстве – формируются схемы.
      </p>
      {NEEDS_DATA.map((n) => (
        <div key={n.title} style={{ borderBottom: '1px solid var(--line)', padding: '20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <span style={{ fontSize: 28 }}>{n.emoji}</span>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--text)' }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{n.subtitle}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0 }}>{n.desc}</p>
        </div>
      ))}
    </div>
  );
}

function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function SchemasTab({ highlight }: { highlight?: string }) {
  const initialDomain = highlight
    ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.name === highlight))?.domain ?? null
    : null;
  const [open, setOpen] = useState<string | null>(initialDomain);

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
        20 ранних дезадаптивных схем сгруппированы в 5 доменов. Схема – не диагноз, а паттерн, который когда-то помогал выжить.
      </p>
      {SCHEMA_DOMAINS.map((d) => (
        <div key={d.domain} style={{ marginBottom: 10 }}>
          <div
            onClick={() => setOpen(open === d.domain ? null : d.domain)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px',
              background: 'rgba(var(--fg-rgb),0.04)', borderRadius: open === d.domain ? '14px 14px 0 0' : 14,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)' }}>{d.domain}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {d.schemas.length}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ transform: open === d.domain ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          {open === d.domain && (
            <div style={{ background: 'rgba(var(--fg-rgb),0.03)', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
              {d.schemas.map((s, i) => {
                const isHighlighted = s.name === highlight;
                return (
                  <div key={s.name} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid rgba(var(--fg-rgb),0.05)' : 'none', background: isHighlighted ? `rgba(${hexToRgbStr(d.color)},0.12)` : 'transparent' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: d.color, marginBottom: 4 }}>{s.name}{isHighlighted && ' ◀'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{(s as { libraryDesc?: string; desc: string }).libraryDesc ?? s.desc}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModesTab() {
  const [checkinMode, setCheckinMode] = useState<typeof MODE_CHECKIN[0] | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);

  return (
    <div>
      <div
        onClick={() => setShowCheckin(true)}
        style={{
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          borderRadius: 16, padding: '16px 20px', marginBottom: 24, cursor: 'pointer',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 6 }}>Режим прямо сейчас</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>Как ты себя чувствуешь? →</div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 24 }}>
        Режим – это актуальное состояние психики прямо сейчас. Цель – расширить доступ к Здоровому взрослому.
      </p>

      {MODES.map((g) => (
        <div key={g.group} style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ color: g.color, marginBottom: 12 }}>{g.group}</div>
          {g.items.map((m) => (
            <div key={m.name} style={{ borderBottom: '1px solid var(--line)', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--text)' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>Чувствуется как: {m.feel}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      ))}

      {/* Check-in selector */}
      {showCheckin && !checkinMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', animation: 'fade-in 150ms ease' }}>
          <div className="ex-topbar">
            <button className="ex-back" onClick={() => setShowCheckin(false)}>
              <GlyphArrowLeft /> Назад
            </button>
          </div>
          <div className="page">
            <div className="page-inner" style={{ paddingTop: 48 }}>
              <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Режим прямо сейчас</div>
              <h1 className="hub-title" style={{ marginBottom: 8 }}>Как ты<br /><span className="it">сейчас?</span></h1>
              <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 36 }}>Выбери самое близкое ощущение</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {MODE_CHECKIN.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => setCheckinMode(item)}
                    className="mode-card"
                    style={{ '--mode-color': 'var(--accent)' } as React.CSSProperties}
                  >
                    <span className="mode-card-stripe" />
                    <div style={{ textAlign: 'center', width: '100%', padding: '4px 0' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{item.emoji}</div>
                      <div className="mode-card-name" style={{ fontSize: 13, textAlign: 'center' }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result overlay */}
      {checkinMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', animation: 'fade-in 150ms ease' }}>
          <div className="ex-topbar">
            <button className="ex-back" onClick={() => { setCheckinMode(null); setShowCheckin(false); }}>
              <GlyphArrowLeft /> Назад
            </button>
          </div>
          <div className="page">
            <div className="page-inner" style={{ paddingTop: 56, maxWidth: 520 }}>
              <div style={{ fontSize: 64, marginBottom: 20, textAlign: 'center' }}>{checkinMode.emoji}</div>
              <div className="eyebrow" style={{ color: 'var(--accent)', textAlign: 'center', marginBottom: 8 }}>Режим</div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', textAlign: 'center', marginBottom: 32 }}>
                {checkinMode.mode}
              </h1>
              <div className="aside-card" style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)', marginBottom: 32 }}>
                <div className="aside-card-eyebrow" style={{ color: 'var(--accent)' }}>Что помогает</div>
                <p className="body" style={{ margin: 0 }}>{checkinMode.tip}</p>
              </div>
              <div className="ex-foot" style={{ padding: 0 }}>
                <span className="spacer" />
                <button
                  onClick={() => { setCheckinMode(null); setShowCheckin(false); }}
                  className="ex-btn ex-btn-primary"
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export type SchemaInfoTab = 'needs' | 'schemas' | 'modes';
interface Props { onClose: () => void; ratings?: Record<string, number>; autoStartTest?: boolean; initialTab?: SchemaInfoTab; highlightSchema?: string }

const SCHEMA_TABS: { key: Tab; label: string }[] = [
  { key: 'needs',   label: 'Потребности' },
  { key: 'schemas', label: 'Схемы' },
  { key: 'modes',   label: 'Режимы' },
];

export function SchemaInfoContent({ initialTab, highlight }: { initialTab?: Tab; highlight?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'needs');
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--line)' }}>
        {SCHEMA_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14,
                color: active ? 'var(--text)' : 'var(--text-sub)',
                fontWeight: active ? 600 : 400,
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{t.label}</button>
          );
        })}
      </div>
      {tab === 'needs'   && <NeedsTab />}
      {tab === 'schemas' && <SchemasTab highlight={highlight} />}
      {tab === 'modes'   && <ModesTab />}
      <div style={{ marginTop: 32 }}>
        <TherapyNote />
      </div>
    </div>
  );
}

export function SchemaInfoSheet({ onClose, ratings, autoStartTest, initialTab, highlightSchema: initHighlight }: Props) {
  const goBack = useHistorySheet(onClose);
  const [showTest, setShowTest] = useState(autoStartTest ?? false);
  const [contentKey, setContentKey] = useState(0);
  const [contentInitialTab, setContentInitialTab] = useState<Tab>(initialTab ?? 'needs');
  const hasResult   = !!localStorage.getItem(YSQ_RESULT_KEY);
  const hasProgress = !!localStorage.getItem(YSQ_PROGRESS_KEY);
  const [highlightSchema, setHighlightSchema] = useState<string | undefined>(initHighlight);

  const handleViewSchemas = (schemaName?: string) => {
    setContentInitialTab('schemas');
    setHighlightSchema(schemaName);
    setContentKey(k => k + 1);
    setShowTest(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div className="ex-topbar">
        <button className="ex-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>

      <div className="page">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Схема-терапия</div>
          <h1 className="hub-title">Как это <span className="it">работает</span></h1>
        </div>

        <SchemaInfoContent key={contentKey} initialTab={contentInitialTab} highlight={highlightSchema} />

        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid var(--line)' }}>
          {hasProgress && !hasResult && (
            <div
              onClick={() => setShowTest(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 16, padding: '16px 20px', marginBottom: 12, cursor: 'pointer',
              }}>
              <span style={{ fontSize: 22 }}>⏸</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--accent-yellow)' }}>Незаконченный тест</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>Нажми, чтобы продолжить с места остановки</div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--accent-yellow)' }}>›</span>
            </div>
          )}
          <div
            onClick={() => setShowTest(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
              borderRadius: 16, padding: '18px 20px', cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--accent)' }}>
                {hasResult ? 'Мои результаты YSQ-R' : hasProgress ? 'Продолжить тест' : 'Пройти тест на схемы'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
                {hasResult ? 'Посмотреть или пройти заново' : '116 вопросов · ~10 минут · YSQ-R'}
              </div>
            </div>
            <span style={{ fontSize: 22, color: 'var(--accent)' }}>›</span>
          </div>
        </div>
      </div>

      </div> {/* .page */}

      {showTest && (
        <Suspense fallback={null}>
          <YSQTestSheet
            onClose={() => setShowTest(false)}
            ratings={ratings}
            autoResume={autoStartTest}
            onViewSchemas={(name) => handleViewSchemas(name)}
          />
        </Suspense>
      )}
    </div>
  );
}
