import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { api } from '../api';

const LS_KEY = (id: string) => `schema_intro_${id}`;

const VAR_HEX: Record<string, string> = {
  'var(--accent-red)':    '#f87171',
  'var(--accent-orange)': '#fb923c',
  'var(--accent-yellow)': '#facc15',
  'var(--accent-green)':  '#34d399',
  'var(--accent-indigo)': '#818cf8',
  'var(--accent-blue)':   '#60a5fa',
  'var(--accent)':        '#a78bfa',
};

function getSchemaById(id: string) {
  for (const domain of SCHEMA_DOMAINS) {
    const schema = domain.schemas.find(s => s.id === id);
    if (schema) return { ...schema, domainName: domain.domain, color: domain.color };
  }
  return null;
}

export interface SchemaIntroData {
  triggers: string;
  feelings: string;
  thoughts: string;
  origins: string;
  reality: string;
  healthyView: string;
  behavior: string;
}

const EMPTY: SchemaIntroData = {
  triggers: '', feelings: '', thoughts: '',
  origins: '', reality: '', healthyView: '', behavior: '',
};

const QUESTIONS: {
  key: keyof SchemaIntroData;
  label: string;
  hint: string;
  placeholder: string;
  optional?: boolean;
}[] = [
  {
    key: 'triggers',
    label: 'Что запускает эту схему?',
    hint: 'Ситуации, слова, интонации — типичные триггеры',
    placeholder: 'Когда не отвечают на сообщения; когда критикуют при других...',
  },
  {
    key: 'feelings',
    label: 'Как проявляется в теле и чувствах?',
    hint: 'Типичные эмоции и ощущения когда схема активна',
    placeholder: 'Тревога и ком в горле; злость и напряжение в груди...',
  },
  {
    key: 'thoughts',
    label: 'Что говорит голос схемы?',
    hint: 'Устойчивые убеждения — про себя, про других, про будущее',
    placeholder: '«Меня никто не ценит», «Я всегда облажаюсь»...',
  },
  {
    key: 'origins',
    label: 'Откуда эта схема пришла?',
    hint: 'Опыт из детства или юности',
    placeholder: 'Папа говорил что я недостаточно стараюсь; в школе чувствовал себя чужим...',
    optional: true,
  },
  {
    key: 'reality',
    label: 'Что реально, а что говорит схема?',
    hint: 'Факты и доказательства, которые противоречат голосу схемы',
    placeholder: 'Есть люди которые ценят меня; большинство прогнозов схемы не сбылись...',
  },
  {
    key: 'healthyView',
    label: 'Слова Здорового Взрослого',
    hint: 'Что зрелая, сострадательная часть тебя говорит',
    placeholder: '«Эта боль из прошлого, сейчас я в безопасности», «Я достаточно хорош»...',
  },
  {
    key: 'behavior',
    label: 'Что помогает когда схема активна?',
    hint: 'Действия и практики вместо привычных реакций',
    placeholder: 'Написать что чувствую; позвонить другу; короткая медитация...',
  },
];

interface Props {
  schemaId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function SchemaIntroSheet({ schemaId, onClose, onComplete }: Props) {
  const schema = getSchemaById(schemaId);
  const [data, setData]     = useState<SchemaIntroData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [step,   setStep]   = useState(0); // card-by-card flip mode
  const [flipped, setFlipped] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  useEffect(() => {
    api.getSchemaNotes().then(notes => {
      const note = notes.find(n => n.schemaId === schemaId);
      if (note) {
        setData({ triggers: note.triggers, feelings: note.feelings, thoughts: note.thoughts,
          origins: note.origins, reality: note.reality, healthyView: note.healthyView, behavior: note.behavior });
      } else {
        const stored = localStorage.getItem(LS_KEY(schemaId));
        if (stored) { try { setData(JSON.parse(stored)); } catch {} }
      }
    }).catch(() => {
      const stored = localStorage.getItem(LS_KEY(schemaId));
      if (stored) { try { setData(JSON.parse(stored)); } catch {} }
    });
  }, [schemaId]);

  if (!schema) return null;

  const colorHex = VAR_HEX[schema.color] ?? '#a78bfa';
  const hasAny   = Object.values(data).some(v => v.trim().length > 0);
  const q        = QUESTIONS[step];
  const answer   = q ? data[q.key] : '';

  function set(key: keyof SchemaIntroData, value: string) {
    const next = { ...data, [key]: value };
    setData(next);
    localStorage.setItem(LS_KEY(schemaId), JSON.stringify(next));
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      api.saveSchemaNote({ schemaId, ...next }).catch(() => {});
    }, 1500);
  }

  async function handleSave() {
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    setSaving(true);
    localStorage.setItem(LS_KEY(schemaId), JSON.stringify(data));
    try { await api.saveSchemaNote({ schemaId, ...data }); } catch {}
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
            background: `${colorHex}18`, border: `1px solid ${colorHex}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {(schema as any).emoji ?? '●'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {schema.name}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: colorHex, marginTop: 2 }}>
              {schema.domainName}
            </div>
          </div>
        </div>

        {/* ── Schema description card ── */}
        <div style={{
          background: `${colorHex}0e`, border: `1px solid ${colorHex}22`,
          borderRadius: 16, padding: '12px 14px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
            {(schema as any).desc}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {QUESTIONS.map((_, i) => {
            const filled = data[QUESTIONS[i].key].trim().length > 0;
            const active = i === step;
            return (
              <div
                key={i} onClick={() => { setStep(i); setFlipped(false); }}
                style={{
                  flex: 1, height: 4, borderRadius: 2, cursor: 'pointer',
                  background: filled ? colorHex : active ? `${colorHex}55` : 'var(--surface-2)',
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
            background: flipped ? `${colorHex}06` : 'var(--surface)',
            border: `1px solid ${flipped ? `${colorHex}40` : 'var(--border-color)'}`,
            borderRadius: 20, padding: '18px 18px 14px', marginBottom: 16,
            minHeight: 120, cursor: flipped ? 'default' : 'pointer', position: 'relative',
            transition: 'all 0.2s',
          }}
        >
          {/* Top row: counter + back button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colorHex }}>
              {step + 1} / {QUESTIONS.length}
              {q.optional && <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 6 }}>необязательно</span>}
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
            /* Front: question */
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
                  background: `${colorHex}10`, border: `1px dashed ${colorHex}55`,
                  fontSize: 13, color: colorHex, fontWeight: 500,
                }}>
                  <span style={{ fontSize: 16 }}>✏️</span>
                  <span>Нажми чтобы ответить</span>
                </div>
              )}
            </>
          ) : (
            /* Back: textarea */
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
                  border: `1.5px solid ${answer.trim() ? `${colorHex}66` : 'var(--border-color)'}`,
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
                background: `${colorHex}20`, color: colorHex,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Следующий вопрос →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!hasAny || saving}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none', fontFamily: 'inherit',
                background: hasAny
                  ? `linear-gradient(135deg, ${colorHex}cc, ${colorHex}88)`
                  : 'var(--surface-2)',
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
