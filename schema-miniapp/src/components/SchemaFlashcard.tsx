import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';

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
const STEP_LABELS = ['Режим', 'Ответ', 'Потребность', 'Действие'];

function loadLocal(): FlashcardEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

interface Props { onClose: () => void; onOpenTracker?: () => void; onComplete?: () => void; }

export function SchemaFlashcard({ onClose, onOpenTracker, onComplete }: Props) {
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

  // ── Viewing past card ─────────────────────────────────────────────────────
  if (viewing) {
    const modeInfo = MODES.find(m => m.id === viewing.mode);
    const needInfo = NEEDS.find(n => n.id === viewing.needId);
    return (
      <BottomSheet onClose={() => setViewing(null)} zIndex={300}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}>{viewing.date}</div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border-color)',
            borderRadius: 20, padding: '16px',
          }}>
            {[
              { label: 'Режим',        value: `${modeInfo?.emoji ?? '🧩'} ${modeInfo?.label ?? viewing.mode}` },
              viewing.reflection ? { label: 'Рефлексия',    value: viewing.reflection } : null,
              needInfo            ? { label: 'Потребность',  value: `${needInfo.emoji} ${needInfo.label}` } : null,
              viewing.action      ? { label: 'Шаг',          value: viewing.action } : null,
            ].filter(Boolean).map((row, i, arr) => row && (
              <div key={row.label} style={{
                paddingBottom: i < arr.length - 1 ? 12 : 0,
                marginBottom: i < arr.length - 1 ? 12 : 0,
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: 'var(--text-faint)', marginBottom: 4 }}>{row.label}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>
    );
  }

  // ── History list ──────────────────────────────────────────────────────────
  if (showHistory) {
    return (
      <BottomSheet onClose={() => setShowHistory(false)} zIndex={300}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            История карточек
          </div>
          {allCards.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text-sub)', textAlign: 'center', padding: '24px 0' }}>
              Пока нет сохранённых карточек
            </div>
          ) : allCards.map(card => {
            const m = MODES.find(x => x.id === card.mode);
            const n = NEEDS.find(x => x.id === card.needId);
            return (
              <div key={card.id} onClick={() => setViewing(card)} style={{
                padding: '12px 14px', background: 'var(--surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 16, marginBottom: 8, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{card.date}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                  {m?.emoji ?? '🧩'} {m?.label ?? card.mode}
                  {n ? ` · ${n.emoji} ${n.label}` : ''}
                </div>
                {card.action && (
                  <div style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 4,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as any }}>
                    → {card.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    const modeInfo = MODES.find(m => m.id === selectedMode);
    const needInfo = NEEDS.find(n => n.id === selectedNeed);
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🌿</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Сохранено</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
              Ты сделал шаг навстречу себе. Это уже немало.
            </div>
          </div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border-color)',
            borderRadius: 20, padding: '16px', marginBottom: 20,
          }}>
            {[
              { label: 'Режим',       value: `${modeInfo?.emoji} ${modeInfo?.label}` },
              needInfo ? { label: 'Потребность', value: `${needInfo.emoji} ${needInfo.label}` } : null,
              action   ? { label: 'Шаг',         value: action } : null,
            ].filter(Boolean).map((row, i, arr) => row && (
              <div key={row.label} style={{
                paddingBottom: i < arr.length - 1 ? 12 : 0,
                marginBottom: i < arr.length - 1 ? 12 : 0,
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: 'var(--text-faint)', marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{row.value}</div>
              </div>
            ))}
          </div>
          {onOpenTracker && (
            <button onClick={() => { onClose(); setTimeout(onOpenTracker!, 100); }} style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
              background: 'var(--surface)', outline: '1px solid var(--border-color)',
              color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
            }}>
              Открыть трекер →
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleNew} style={{
              flex: 1, padding: '13px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
              background: 'var(--surface-2)', color: 'var(--text-sub)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Ещё одну</button>
            <button onClick={onClose} style={{
              flex: 1, padding: '13px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
              background: 'rgba(var(--fg-rgb),0.06)', color: 'var(--accent)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Готово</button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  // ── Grounding ─────────────────────────────────────────────────────────────
  if (!grounded) {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>💙</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            Ты сделал правильно
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 24 }}>
            То, что ты чувствуешь сейчас — это нормально.<br/>Это пройдёт.
          </div>
          {/* Breathing box */}
          <div style={{
            background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)',
            borderRadius: 20, padding: '18px 16px', marginBottom: 24, textAlign: 'left',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 14 }}>
              Три вдоха прямо сейчас
            </div>
            {['Вдох через нос — 4 секунды', 'Задержи — 2 секунды', 'Медленный выдох — 6 секунд'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 10 : 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'var(--accent-blue)', fontWeight: 700,
                }}>{i + 1}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{t}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 20 }}>
            Почувствуй ноги на полу. Ты в безопасности.
          </div>
          <button onClick={() => setGrounded(true)} style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
            background: 'rgba(96,165,250,0.12)', outline: '1px solid rgba(96,165,250,0.22)',
            color: 'var(--accent-blue)', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
          }}>
            Стало чуть лучше — разобраться →
          </button>
          {allCards.length > 0 && (
            <button onClick={() => setShowHistory(true)} style={{
              width: '100%', padding: '11px', borderRadius: 14, fontFamily: 'inherit',
              border: 'none', background: 'var(--surface)',
              outline: '1px solid var(--border-color)',
              color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', marginBottom: 10,
            }}>
              История карточек ({allCards.length})
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', padding: '11px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
            background: 'transparent', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer',
          }}>
            Просто закрыть
          </button>
        </div>
      </BottomSheet>
    );
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  const progressBar = (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < stepIndex ? 'var(--accent)'
            : i === stepIndex ? 'rgba(var(--fg-rgb),0.25)'
            : 'var(--surface-2)',
          transition: 'background 0.2s',
        }}/>
      ))}
    </div>
  );

  // ── Step 1: Mode ──────────────────────────────────────────────────────────
  if (step === 'mode') {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Что сейчас активно?</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Шаг 1 из 4 — выбери режим</div>
            </div>
            {allCards.length > 0 && (
              <button onClick={() => setShowHistory(true)} style={{
                background: 'none', border: 'none', fontSize: 11,
                color: 'var(--text-faint)', cursor: 'pointer', padding: 0,
              }}>История</button>
            )}
          </div>
          {progressBar}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => { setSelectedMode(m.id); setStep('response'); }} style={{
                textAlign: 'left', padding: '14px 16px', borderRadius: 16,
                border: '1px solid var(--border-color)',
                background: 'var(--surface)', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{m.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: m.color }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-faint)', paddingLeft: 30 }}>{m.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20 }}><TherapyNote compact/></div>
        </div>
      </BottomSheet>
    );
  }

  // ── Step 2: Healthy Adult response ────────────────────────────────────────
  if (step === 'response') {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Здоровый Взрослый</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Шаг 2 из 4</div>
          </div>
          {progressBar}
          <div style={{
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)',
            borderRadius: 20, padding: '16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              🌿 Говорит тебе
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
              {modeData?.response}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}>
            Что отзывается? <span style={{ color: 'var(--text-faint)' }}>(необязательно)</span>
          </div>
          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Что хочется сказать себе..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: '12px 14px',
              color: 'var(--text)', fontSize: 14, lineHeight: 1.55,
              resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 16,
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep('mode')} style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', fontFamily: 'inherit',
              background: 'var(--surface-2)', color: 'var(--text-sub)',
              fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>←</button>
            <button onClick={() => setStep('need')} style={{
              flex: 1, padding: '13px', borderRadius: 12, border: 'none', fontFamily: 'inherit',
              background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Дальше →</button>
          </div>
          <div style={{ marginTop: 20 }}><TherapyNote compact/></div>
        </div>
      </BottomSheet>
    );
  }

  // ── Step 3: Need ──────────────────────────────────────────────────────────
  if (step === 'need') {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Что за этим стоит?</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Шаг 3 из 4 — нужда</div>
          </div>
          {progressBar}
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14, lineHeight: 1.5 }}>
            Какая потребность сейчас не удовлетворена?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {NEEDS.map(n => {
              const sel = selectedNeed === n.id;
              return (
                <button key={n.id} onClick={() => { setSelectedNeed(n.id); setStep('action'); }} style={{
                  textAlign: 'left', padding: '13px 16px', borderRadius: 14, cursor: 'pointer',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-color)'}`,
                  background: sel ? 'var(--surface-2)' : 'var(--surface)',
                  color: 'var(--text)', fontSize: 14, fontWeight: sel ? 600 : 400,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>{n.emoji}</span>
                  {n.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => setStep('response')} style={{
            width: 44, height: 44, borderRadius: 12, border: 'none', fontFamily: 'inherit',
            background: 'var(--surface-2)', color: 'var(--text-sub)',
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
          <div style={{ marginTop: 20 }}><TherapyNote compact/></div>
        </div>
      </BottomSheet>
    );
  }

  // ── Step 4: Action ────────────────────────────────────────────────────────
  const needInfo = NEEDS.find(n => n.id === selectedNeed);
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Один маленький шаг</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>Шаг 4 из 4</div>
        </div>
        {progressBar}
        {needInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--surface)', border: '1px solid var(--border-color)',
            borderRadius: 14, padding: '11px 14px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>{needInfo.emoji}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 1 }}>Потребность</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{needInfo.label}</div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8, lineHeight: 1.5 }}>
          Что одно маленькое действие ты можешь сделать прямо сейчас?
        </div>
        <textarea
          value={action}
          onChange={e => setAction(e.target.value)}
          placeholder="Написать другу, выйти подышать, обнять подушку..."
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)',
            border: `1px solid ${action.trim() ? 'var(--accent)' : 'var(--border-color)'}`,
            borderRadius: 14, padding: '12px 14px',
            color: 'var(--text)', fontSize: 14, lineHeight: 1.55,
            resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 16,
            transition: 'border-color 0.2s',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setStep('need')} style={{
            width: 44, height: 44, borderRadius: 12, border: 'none', fontFamily: 'inherit',
            background: 'var(--surface-2)', color: 'var(--text-sub)',
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
          <button onClick={save} disabled={!action.trim()} style={{
            flex: 1, padding: '13px', borderRadius: 12, border: 'none', fontFamily: 'inherit',
            background: action.trim() ? 'rgba(52,211,153,0.15)' : 'var(--surface-2)',
            outline: action.trim() ? '1px solid rgba(52,211,153,0.25)' : 'none',
            color: action.trim() ? 'var(--accent-green)' : 'var(--text-faint)',
            fontSize: 14, fontWeight: 600,
            cursor: action.trim() ? 'pointer' : 'default', transition: 'all 0.2s',
          }}>
            Сохранить
          </button>
        </div>
        <div style={{ marginTop: 20 }}><TherapyNote compact/></div>
      </div>
    </BottomSheet>
  );
}
