import { useState, useEffect } from 'react';
import { TherapyNote } from './TherapyNote';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { api } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';

const STORAGE_KEY = 'schema_flashcards';

interface FlashcardEntry {
  id: string | number;
  date: string;
  mode: string;
  reflection: string;
  needId: string;
  action: string;
}

const MODES = [
  {
    id: 'vulnerable_child',
    emoji: '😢',
    label: 'Уязвимый Ребёнок',
    desc: 'Грустно, страшно, одиноко, беспомощно',
    response: 'Здоровый Взрослый слышит тебя: твоя боль настоящая, и ты не один. Позволь себе побыть в этом — без самокритики.',
    color: '#60a5fa',
  },
  {
    id: 'angry_child',
    emoji: '😡',
    label: 'Злой Ребёнок',
    desc: 'Злость, раздражение, хочется взорваться',
    response: 'Злость — сигнал, что нарушено что-то важное. Не нужно ни давить её, ни выплёскивать. Давай выясним, что за ней стоит.',
    color: '#f87171',
  },
  {
    id: 'detached',
    emoji: '🔇',
    label: 'Отстранённый Защитник',
    desc: 'Пусто, онемело, всё равно, хочется исчезнуть',
    response: 'Ты отключился, чтобы не было больно — это понятно. Но ты в безопасности прямо сейчас. Можно чуть-чуть вернуться.',
    color: '#94a3b8',
  },
  {
    id: 'critic',
    emoji: '🪓',
    label: 'Внутренний Критик',
    desc: 'Стыд, «я облажался», «я недостаточно хорош»',
    response: 'Критик думает, что защищает тебя, но причиняет боль. Здоровый Взрослый говорит: ты достаточно хорош — прямо сейчас.',
    color: '#fb923c',
  },
];

const NEEDS = [
  { id: 'attachment', emoji: '💙', label: 'Привязанность' },
  { id: 'autonomy',   emoji: '🔑', label: 'Автономия' },
  { id: 'expression', emoji: '🎨', label: 'Выражение' },
  { id: 'play',       emoji: '🎉', label: 'Игра и радость' },
  { id: 'limits',     emoji: '🛡️', label: 'Границы' },
];

type Step = 'mode' | 'response' | 'need' | 'action';
const STEPS: Step[] = ['mode', 'response', 'need', 'action'];

function loadLocal(): FlashcardEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function Topbar({ onBack, label = 'Закрыть' }: { onBack: () => void; label?: string }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
      <button className="ex-btn ex-btn-ghost" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
        <GlyphArrowLeft /> {label}
      </button>
    </div>
  );
}

interface Props { onClose: () => void; onOpenTracker?: () => void; onComplete?: () => void; }

export function SchemaFlashcard({ onClose, onOpenTracker, onComplete }: Props) {
  const goBack = useHistorySheet(onClose);
  const [grounded,     setGrounded]     = useState(false);
  const [step,         setStep]         = useState<Step>('mode');
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [reflection,   setReflection]   = useState('');
  const [selectedNeed, setSelectedNeed] = useState<string | null>(null);
  const [action,       setAction]       = useState('');
  const [done,         setDone]         = useState(false);
  const [allCards,     setAllCards]     = useState<FlashcardEntry[]>(() => loadLocal());
  const [viewing,      setViewing]      = useState<FlashcardEntry | null>(null);
  const [showHistory,  setShowHistory]  = useState(false);

  useEffect(() => {
    api.getFlashcards().then(rows => {
      setAllCards(rows.map(r => ({
        id: r.id,
        date: new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        mode: r.modeId,
        reflection: r.reflection ?? '',
        needId: r.needId,
        action: r.action ?? '',
      })));
    }).catch(() => {});
  }, []);

  const stepIndex = STEPS.indexOf(step);
  const modeData  = MODES.find(m => m.id === selectedMode);

  function save() {
    const entry: FlashcardEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      mode: selectedMode!, reflection, needId: selectedNeed!, action,
    };
    const cards = [entry, ...loadLocal()].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    setAllCards(cards);
    api.createFlashcard({ modeId: selectedMode!, needId: selectedNeed!, reflection: reflection || undefined, action: action || undefined }).catch(() => {});
    setDone(true);
    onComplete?.();
  }

  function handleNew() {
    setStep('mode'); setSelectedMode(null); setReflection('');
    setSelectedNeed(null); setAction(''); setDone(false); setGrounded(false);
  }

  const progressBar = (
    <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < stepIndex ? 'var(--accent)'
            : i === stepIndex ? 'rgba(var(--fg-rgb),0.25)'
            : 'var(--line)',
          transition: 'background 0.2s',
        }}/>
      ))}
    </div>
  );

  // Viewing a past card
  if (viewing) {
    const modeInfo = MODES.find(m => m.id === viewing.mode);
    const needInfo = NEEDS.find(n => n.id === viewing.needId);
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={() => setViewing(null)} label="К истории" />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{viewing.date}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Режим',       value: `${modeInfo?.emoji ?? '🧩'} ${modeInfo?.label ?? viewing.mode}` },
              viewing.reflection ? { label: 'Рефлексия',   value: viewing.reflection } : null,
              needInfo            ? { label: 'Потребность', value: `${needInfo.emoji} ${needInfo.label}` } : null,
              viewing.action      ? { label: 'Шаг',         value: viewing.action } : null,
            ].filter(Boolean).map((row, i, arr) => row && (
              <div key={row.label} style={{
                padding: '20px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>{row.label}</div>
                <div style={{ fontFamily: i === 0 ? 'var(--serif)' : 'inherit', fontSize: i === 0 ? 22 : 15, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // History list
  if (showHistory) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={() => setShowHistory(false)} label="Назад" />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 24 }}>История карточек</h1>
          {allCards.length === 0 ? (
            <div style={{ fontSize: 15, color: 'var(--text-sub)', textAlign: 'center', padding: '40px 0' }}>
              Пока нет сохранённых карточек
            </div>
          ) : allCards.map(card => {
            const m = MODES.find(x => x.id === card.mode);
            const n = NEEDS.find(x => x.id === card.needId);
            return (
              <div key={card.id} onClick={() => setViewing(card)} style={{
                padding: '16px 20px', background: 'transparent',
                border: '1px solid var(--line)', borderRadius: 16, marginBottom: 10, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.date}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)', lineHeight: 1.4 }}>
                  {m?.emoji ?? '🧩'} {m?.label ?? card.mode}
                  {n ? ` · ${n.emoji} ${n.label}` : ''}
                </div>
                {card.action && (
                  <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 6,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as any }}>
                    → {card.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Done state
  if (done) {
    const modeInfo = MODES.find(m => m.id === selectedMode);
    const needInfo = NEEDS.find(n => n.id === selectedNeed);
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={goBack} label="Закрыть" />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px 80px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🌿</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, color: 'var(--text)', marginBottom: 12 }}>Сохранено</h1>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 40 }}>
            Ты сделал шаг навстречу себе. Это уже немало.
          </p>
          <div style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 20, padding: '24px', marginBottom: 32, textAlign: 'left' }}>
            {[
              { label: 'Режим',       value: `${modeInfo?.emoji} ${modeInfo?.label}` },
              needInfo ? { label: 'Потребность', value: `${needInfo.emoji} ${needInfo.label}` } : null,
              action   ? { label: 'Шаг',         value: action } : null,
            ].filter(Boolean).map((row, i, arr) => row && (
              <div key={row.label} style={{
                paddingBottom: i < arr.length - 1 ? 16 : 0,
                marginBottom: i < arr.length - 1 ? 16 : 0,
                borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : undefined,
              }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{row.label}</div>
                <div style={{ fontFamily: i === 0 ? 'var(--serif)' : 'inherit', fontSize: i === 0 ? 20 : 15, color: 'var(--text)', lineHeight: 1.5 }}>{row.value}</div>
              </div>
            ))}
          </div>
          {onOpenTracker && (
            <button onClick={() => { goBack(); setTimeout(onOpenTracker!, 100); }} className="ex-btn ex-btn-outline" style={{ width: '100%', marginBottom: 12 }}>
              Открыть трекер →
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleNew} className="ex-btn ex-btn-ghost" style={{ flex: 1 }}>Ещё одну</button>
            <button onClick={goBack} className="ex-btn ex-btn-primary" style={{ flex: 1 }}>Готово</button>
          </div>
        </div>
      </div>
    );
  }

  // Grounding screen (first step — breathing exercise)
  if (!grounded) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={goBack} label="Закрыть" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px 80px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>💙</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, color: 'var(--text)', marginBottom: 12 }}>
            Ты сделал правильно
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 36 }}>
            То, что ты чувствуешь сейчас — это нормально.<br/>Это пройдёт.
          </p>
          <div style={{
            background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)',
            borderRadius: 20, padding: '24px', marginBottom: 36, textAlign: 'left',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 18 }}>
              Три вдоха прямо сейчас
            </div>
            {['Вдох через нос — 4 секунды', 'Задержи — 2 секунды', 'Медленный выдох — 6 секунд'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < 2 ? 12 : 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--serif)', fontSize: 14, color: '#60a5fa',
                }}>{i + 1}</div>
                <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>{t}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 28 }}>
            Почувствуй ноги на полу. Ты в безопасности.
          </p>
          <button onClick={() => setGrounded(true)} className="ex-btn ex-btn-primary" style={{ width: '100%', marginBottom: 12 }}>
            Стало чуть лучше — разобраться →
          </button>
          {allCards.length > 0 && (
            <button onClick={() => setShowHistory(true)} className="ex-btn ex-btn-ghost" style={{ width: '100%', marginBottom: 10 }}>
              История карточек ({allCards.length})
            </button>
          )}
          <button onClick={goBack} style={{
            width: '100%', padding: '11px', border: 'none', background: 'transparent',
            color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Просто закрыть
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Mode selection
  if (step === 'mode') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={goBack} label="Закрыть" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 1 из 4</div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)' }}>Что сейчас активно?</h1>
            </div>
            {allCards.length > 0 && (
              <button onClick={() => setShowHistory(true)} className="ex-btn ex-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                История
              </button>
            )}
          </div>
          {progressBar}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => { setSelectedMode(m.id); setStep('response'); }} style={{
                textAlign: 'left', padding: '18px 20px', borderRadius: 16,
                border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{m.emoji}</span>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: m.color }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-faint)', paddingLeft: 34 }}>{m.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 32 }}><TherapyNote compact /></div>
        </div>
      </div>
    );
  }

  // Step 2: Healthy Adult response
  if (step === 'response') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={() => setStep('mode')} label="Назад" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 2 из 4</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Здоровый Взрослый</h1>
          {progressBar}
          <div style={{
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)',
            borderRadius: 20, padding: '20px', marginBottom: 24,
          }}>
            <div className="eyebrow" style={{ color: 'var(--accent-green)', marginBottom: 12 }}>
              🌿 Говорит тебе
            </div>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
              {modeData?.response}
            </p>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 10 }}>
            Что отзывается? <span style={{ color: 'var(--text-faint)' }}>(необязательно)</span>
          </div>
          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Что хочется сказать себе..."
            rows={3}
            className="paper-area"
            style={{ marginBottom: 20 }}
          />
          <button onClick={() => setStep('need')} className="ex-btn ex-btn-primary" style={{ width: '100%' }}>
            Дальше →
          </button>
          <div style={{ marginTop: 24 }}><TherapyNote compact /></div>
        </div>
      </div>
    );
  }

  // Step 3: Need selection
  if (step === 'need') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
        <Topbar onBack={() => setStep('response')} label="Назад" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 3 из 4</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Что за этим стоит?</h1>
          {progressBar}
          <p style={{ fontSize: 15, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
            Какая потребность сейчас не удовлетворена?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {NEEDS.map(n => {
              const sel = selectedNeed === n.id;
              return (
                <button key={n.id} onClick={() => { setSelectedNeed(n.id); setStep('action'); }} style={{
                  textAlign: 'left', padding: '16px 20px', borderRadius: 14, cursor: 'pointer',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
                  background: sel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  color: 'var(--text)', fontSize: 15,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 22 }}>{n.emoji}</span>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{n.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 24 }}><TherapyNote compact /></div>
        </div>
      </div>
    );
  }

  // Step 4: Action
  const needInfo = NEEDS.find(n => n.id === selectedNeed);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
      <Topbar onBack={() => setStep('need')} label="Назад" />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 4 из 4</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Один маленький шаг</h1>
        {progressBar}
        {needInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'transparent', border: '1px solid var(--line)',
            borderRadius: 14, padding: '14px 18px', marginBottom: 20,
          }}>
            <span style={{ fontSize: 24 }}>{needInfo.emoji}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Потребность</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>{needInfo.label}</div>
            </div>
          </div>
        )}
        <p style={{ fontSize: 15, color: 'var(--text-sub)', marginBottom: 12, lineHeight: 1.6 }}>
          Что одно маленькое действие ты можешь сделать прямо сейчас?
        </p>
        <textarea
          value={action}
          onChange={e => setAction(e.target.value)}
          placeholder="Написать другу, выйти подышать, обнять подушку..."
          rows={3}
          className="paper-area"
          style={{ marginBottom: 20, borderColor: action.trim() ? 'var(--accent)' : 'var(--line)' }}
        />
        <button onClick={save} disabled={!action.trim()} className="ex-btn ex-btn-primary" style={{ width: '100%' }}>
          Сохранить
        </button>
        <div style={{ marginTop: 24 }}><TherapyNote compact /></div>
      </div>
    </div>
  );
}
