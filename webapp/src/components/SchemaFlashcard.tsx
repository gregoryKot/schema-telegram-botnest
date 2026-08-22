import { useState, useEffect } from 'react';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { Topbar } from './SchemaFlashcardTopbar';
import { FlashcardDoneScreen } from './flashcard/FlashcardDoneScreen';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import {
  STORAGE_KEY,
  buildModes,
  NEEDS,
  STEPS,
  loadLocal,
} from './schemaFlashcard/constants';
import type { FlashcardEntry, Step } from './schemaFlashcard/types';

interface Props { onClose: () => void; onOpenTracker?: () => void; onComplete?: () => void; }

export function SchemaFlashcard({ onClose, onOpenTracker, onComplete }: Props) {
  const tr = useTr();
  const MODES = buildModes(tr);
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
  const [syncFailed,   setSyncFailed]   = useState(false);
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
    }).catch(e => console.error('getFlashcards failed', e)); // деградация до локальных карточек
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
    // Карточка уже в localStorage; серверная копия — для других устройств и
    // терапевта. Её потерю раньше глушили молча — теперь экран честен.
    setSyncFailed(false);
    api.createFlashcard({ modeId: selectedMode!, needId: selectedNeed!, reflection: reflection || undefined, action: action || undefined }).catch(() => setSyncFailed(true));
    setDone(true);
    onComplete?.();
  }

  function handleNew() {
    setStep('mode'); setSelectedMode(null); setReflection('');
    setSelectedNeed(null); setAction(''); setDone(false); setGrounded(false);
  }

  const progressBar = (
    <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 28 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{
          flex: 1, height: 3, borderRadius: 'var(--r-2)',
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        <Topbar onBack={() => setViewing(null)} label="К истории" />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{viewing.date}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Режим',       value: modeInfo?.label ?? viewing.mode },
              viewing.reflection ? { label: 'Рефлексия',   value: viewing.reflection } : null,
              needInfo            ? { label: 'Потребность', value: needInfo.label } : null,
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        <Topbar onBack={() => setShowHistory(false)} label="Назад" />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 80px', overflowY: 'auto' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 24 }}>История карточек</h1>
          {allCards.length === 0 ? (
            <div style={{ fontSize: 15, color: 'var(--text-sub)', textAlign: 'center', padding: '40px 0' }}>
              Пока нет сохранённых карточек
            </div>
          ) : allCards.map(card => {
            const m = MODES.find(x => x.id === card.mode);
            const n = NEEDS.find(x => x.id === card.needId);
            return (
              <div key={card.id} onClick={() => setViewing(card)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewing(card); } }} style={{
                padding: '16px 20px', background: 'transparent',
                border: '1px solid var(--line)', borderRadius: 'var(--r-16)', marginBottom: 10, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.date}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)', lineHeight: 1.4 }}>
                  {m?.label ?? card.mode}
                  {n ? ` · ${n.label}` : ''}
                </div>
                {card.action && (
                  <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 6,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
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

  // Done state — экран вынесен (правило №10, файл сверх потолка).
  if (done) {
    return (
      <FlashcardDoneScreen
        modeLabel={MODES.find(m => m.id === selectedMode)?.label}
        needLabel={NEEDS.find(n => n.id === selectedNeed)?.label}
        action={action}
        syncFailed={syncFailed}
        onOpenTracker={onOpenTracker}
        goBack={goBack}
        handleNew={handleNew}
        tr={tr}
      />
    );
  }

  // Grounding screen (first step – breathing exercise)
  if (!grounded) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        <Topbar onBack={goBack} label="Закрыть" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px 80px', textAlign: 'center', overflowY: 'auto' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, color: 'var(--text)', marginBottom: 12, marginTop: 20 }}>
            Всё правильно
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 36 }}>
            {tr('То, что ты чувствуешь сейчас – это нормально.', 'То, что вы чувствуете сейчас – это нормально.')}<br/>Это пройдёт.
          </p>
          <div style={{
            background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)',
            borderRadius: 'var(--r-20)', padding: '24px', marginBottom: 36, textAlign: 'left',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 18 }}>
              Три вдоха прямо сейчас
            </div>
            {['Вдох через нос – 4 секунды', 'Задержи – 2 секунды', 'Медленный выдох – 6 секунд'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-14)', marginBottom: i < 2 ? 12 : 0 }}>
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
            {tr('Почувствуй ноги на полу. Ты в безопасности.', 'Почувствуйте ноги на полу. Вы в безопасности.')}
          </p>
          <button onClick={() => setGrounded(true)} className="ex-btn ex-btn-primary" style={{ width: '100%', marginBottom: 12 }}>
            Стало чуть лучше – разобраться →
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        <Topbar onBack={goBack} label="Закрыть" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px', overflowY: 'auto' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => { setSelectedMode(m.id); setStep('response'); }} style={{
                textAlign: 'left', padding: '18px 20px', borderRadius: 'var(--r-16)',
                border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 6 }}>
                  <IdentityDot color={m.color} size={16} />
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        <Topbar onBack={() => setStep('mode')} label="Назад" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px', overflowY: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 2 из 4</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Здоровый Взрослый</h1>
          {progressBar}
          <div style={{
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)',
            borderRadius: 'var(--r-20)', padding: '20px', marginBottom: 24,
          }}>
            <div className="eyebrow" style={{ color: 'var(--accent-green)', marginBottom: 12 }}>
              {tr('Говорит тебе', 'Говорит вам')}
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
          {detectCrisisAny(reflection) && <CrisisCard surface="flashcard" />}
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
        <Topbar onBack={() => setStep('response')} label="Назад" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px', overflowY: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 3 из 4</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Что за этим стоит?</h1>
          {progressBar}
          <p style={{ fontSize: 15, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
            Какая потребность сейчас не удовлетворена?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)', marginBottom: 20 }}>
            {NEEDS.map(n => {
              const sel = selectedNeed === n.id;
              return (
                <button key={n.id} onClick={() => { setSelectedNeed(n.id); setStep('action'); }} style={{
                  textAlign: 'left', padding: '16px 20px', borderRadius: 'var(--r-14)', cursor: 'pointer',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
                  background: sel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  color: 'var(--text)', fontSize: 15,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 'var(--space-12)',
                }}>
                  <IdentityDot id={n.id} size={16} />
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <Topbar onBack={() => setStep('need')} label="Назад" />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px', overflowY: 'auto' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Шаг 4 из 4</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>Один маленький шаг</h1>
        {progressBar}
        {needInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-14)',
            background: 'transparent', border: '1px solid var(--line)',
            borderRadius: 'var(--r-14)', padding: '14px 18px', marginBottom: 20,
          }}>
            <IdentityDot id={needInfo.id} size={18} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Потребность</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>{needInfo.label}</div>
            </div>
          </div>
        )}
        <p style={{ fontSize: 15, color: 'var(--text-sub)', marginBottom: 12, lineHeight: 1.6 }}>
          {tr('Что одно маленькое действие ты можешь сделать прямо сейчас?', 'Что одно маленькое действие вы можете сделать прямо сейчас?')}
        </p>
        <textarea
          value={action}
          onChange={e => setAction(e.target.value)}
          placeholder="Написать другу, выйти подышать, обнять подушку..."
          rows={3}
          className="paper-area"
          style={{ marginBottom: 20, borderColor: action.trim() ? 'var(--accent)' : 'var(--line)' }}
        />
        {detectCrisisAny(action) && <CrisisCard surface="flashcard" />}
        <button onClick={save} disabled={!action.trim()} className="ex-btn ex-btn-primary" style={{ width: '100%' }}>
          Сохранить
        </button>
        <div style={{ marginTop: 24 }}><TherapyNote compact /></div>
      </div>
    </div>
  );
}
