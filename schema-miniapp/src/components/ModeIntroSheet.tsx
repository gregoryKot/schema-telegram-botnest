import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from './BottomSheet';
import { getModeById } from '../schemaTherapyData';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';

const STORAGE_KEY = (modeId: string) => `mode_intro_${modeId}`;

interface IntroData {
  triggers: string;
  feelings: string;
  thoughts: string;
  needs: string;
  behavior: string;
}

const EMPTY: IntroData = { triggers: '', feelings: '', thoughts: '', needs: '', behavior: '' };

const QUESTIONS: { key: keyof IntroData; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'triggers',
    label: 'Когда активируется',
    hint: 'Ситуации, люди, слова — что запускает этот режим?',
    placeholder: 'Когда меня критикуют, когда нужно выступить...',
  },
  {
    key: 'feelings',
    label: 'Что чувствую',
    hint: 'Эмоции и ощущения в теле',
    placeholder: 'Тревога, комок в горле, напряжение в плечах...',
  },
  {
    key: 'thoughts',
    label: 'Что говорит внутри',
    hint: 'Убеждения, голос, монолог этого режима',
    placeholder: '«Я недостаточно хорош», «Лучше не рисковать»...',
  },
  {
    key: 'needs',
    label: 'Чего на самом деле хочет',
    hint: 'Глубинная потребность за этим режимом',
    placeholder: 'Безопасности, признания, контакта...',
  },
  {
    key: 'behavior',
    label: 'Как проявляется в поведении',
    hint: 'Что делаешь (или перестаёшь делать) в этом режиме',
    placeholder: 'Замолкаю, избегаю, злюсь, переусердствую...',
  },
];

interface Props {
  modeId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function ModeIntroSheet({ modeId, onClose, onComplete }: Props) {
  const mode = getModeById(modeId);
  const [data, setData]     = useState<IntroData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [step,   setStep]   = useState(0);
  const [flipped, setFlipped] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  useEffect(() => {
    api.getModeNotes().then(notes => {
      const note = notes.find(n => n.modeId === modeId);
      if (note) {
        setData({ triggers: note.triggers, feelings: note.feelings, thoughts: note.thoughts,
          needs: note.needs, behavior: note.behavior });
      } else {
        const stored = localStorage.getItem(STORAGE_KEY(modeId));
        if (stored) { try { setData(JSON.parse(stored)); } catch {} }
      }
    }).catch(() => {
      const stored = localStorage.getItem(STORAGE_KEY(modeId));
      if (stored) { try { setData(JSON.parse(stored)); } catch {} }
    });
  }, [modeId]);

  if (!mode) return null;

  const color  = mode.groupColor ?? 'var(--accent)';
  const hasAny = Object.values(data).some(v => v.trim().length > 0);
  const q      = QUESTIONS[step];
  const answer = q ? data[q.key] : '';

  function set(key: keyof IntroData, value: string) {
    const next = { ...data, [key]: value };
    setData(next);
    localStorage.setItem(STORAGE_KEY(modeId), JSON.stringify(next));
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      api.saveModeNote({ modeId, ...next }).catch(() => {});
    }, 1500);
  }

  async function handleSave() {
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    setSaving(true);
    localStorage.setItem(STORAGE_KEY(modeId), JSON.stringify(data));
    try { await api.saveModeNote({ modeId, ...data }); } catch {}
    setSaving(false);
    setSaved(true);
    onComplete?.();
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {mode.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {mode.name}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color, marginTop: 2 }}>
              {mode.groupName}
            </div>
          </div>
        </div>

        {/* ── Mode description ── */}
        {mode.short && (
          <div style={{
            background: `${color}0e`, border: `1px solid ${color}22`,
            borderRadius: 16, padding: '12px 14px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
              {mode.short}
            </div>
          </div>
        )}

        {/* ── Progress dots ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {QUESTIONS.map((_, i) => {
            const filled = data[QUESTIONS[i].key].trim().length > 0;
            const active = i === step;
            return (
              <div
                key={i} onClick={() => { setStep(i); setFlipped(false); }}
                style={{
                  flex: 1, height: 4, borderRadius: 2, cursor: 'pointer',
                  background: filled ? color : active ? `${color}55` : 'var(--surface-2)',
                  transition: 'background 0.2s',
                }}
              />
            );
          })}
        </div>

        {/* ── Flashcard ── */}
        <div
          onClick={() => !flipped && setFlipped(true)}
          style={{
            background: flipped ? `${color}06` : 'var(--surface)',
            border: `1px solid ${flipped ? `${color}40` : 'var(--border-color)'}`,
            borderRadius: 20, padding: '18px 18px 14px', marginBottom: 16,
            minHeight: 120, cursor: flipped ? 'default' : 'pointer', position: 'relative',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>
              {step + 1} / {QUESTIONS.length}
            </div>
            {flipped && (
              <button
                onClick={e => { e.stopPropagation(); setFlipped(false); }}
                style={{
                  background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
                  fontSize: 11, color: 'var(--text-faint)', cursor: 'pointer',
                }}
              >
                ← к вопросу
              </button>
            )}
          </div>

          {!flipped ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 8 }}>
                {q.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5, marginBottom: 14 }}>
                {q.hint}
              </div>
              {answer.trim() ? (
                <div style={{
                  background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px',
                  fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                }}>
                  {answer}
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 14px', borderRadius: 12,
                  background: `${color}10`, border: `1px dashed ${color}55`,
                  fontSize: 13, color, fontWeight: 500,
                }}>
                  <span style={{ fontSize: 16 }}>✏️</span>
                  <span>Нажми чтобы ответить</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: 10 }}>
                {q.label}
              </div>
              <textarea
                autoFocus
                value={answer}
                onChange={e => set(q.key, e.target.value)}
                placeholder={q.placeholder}
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--surface)',
                  border: `1.5px solid ${answer.trim() ? `${color}66` : 'var(--border-color)'}`,
                  borderRadius: 12, padding: '11px 13px',
                  color: 'var(--text)', fontSize: 14, lineHeight: 1.55,
                  resize: 'none', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
              />
            </>
          )}
        </div>

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => { setStep(s => Math.max(0, s - 1)); setFlipped(false); }}
            disabled={step === 0}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', fontFamily: 'inherit',
              background: step === 0 ? 'var(--surface)' : 'var(--surface-2)',
              color: step === 0 ? 'var(--text-faint)' : 'var(--text-sub)',
              fontSize: 18, cursor: step === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >←</button>

          {step < QUESTIONS.length - 1 ? (
            <button
              onClick={() => { setStep(s => s + 1); setFlipped(false); }}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none', fontFamily: 'inherit',
                background: `${color}20`, color,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Следующий →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!hasAny || saving}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none', fontFamily: 'inherit',
                background: hasAny ? color : 'var(--surface-2)',
                color: hasAny ? '#fff' : 'var(--text-faint)',
                fontSize: 14, fontWeight: 600,
                cursor: hasAny ? 'pointer' : 'default', transition: 'all 0.2s',
              }}
            >
              {saving ? 'Сохраняем…' : saved ? '✓ Сохранено' : 'Сохранить карточку'}
            </button>
          )}
        </div>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
