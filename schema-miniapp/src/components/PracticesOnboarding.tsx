import { useState } from 'react';
import { Need } from '../types';
import { api } from '../api';
import { NEED_DATA } from '../needData';
import { COLORS } from '../types';
import { BottomSheet } from './BottomSheet';
import { CURATED } from './PlanSheet';

export const PRACTICES_ONBOARDING_KEY = 'practices_onboarding_done';

export function shouldShowPracticesOnboarding(): boolean {
  return !localStorage.getItem(PRACTICES_ONBOARDING_KEY);
}

interface Props {
  needs: Need[];
  onDone: () => void;
}

export function PracticesOnboarding({ needs, onDone }: Props) {
  const [step, setStep] = useState<'intro' | number>('intro');
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function finish() {
    localStorage.setItem(PRACTICES_ONBOARDING_KEY, '1');
    onDone();
  }

  async function handleSaveAndNext() {
    const idx = step as number;
    const needId = needs[idx].id;
    setSaving(true);
    const toSave = [...selected];
    if (input.trim()) toSave.push(input.trim());
    try {
      const results = await Promise.allSettled(toSave.map(text => api.addPractice(needId, text)));
      if (results.some(r => r.status === 'rejected')) {
        setSaveError(true);
        setSaving(false);
        return;
      }
      setSaveError(false);
    } catch {
      setSaveError(true);
      setSaving(false);
      return;
    }
    setSaving(false);
    setInput('');
    setSelected(new Set());
    next();
  }

  function toggleSuggestion(text: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text); else next.add(text);
      return next;
    });
  }

  function next() {
    const idx = step === 'intro' ? 0 : (step as number) + 1;
    if (idx >= needs.length) { finish(); return; }
    setStep(idx);
    setInput('');
    setSelected(new Set());
  }

  const currentNeed = step !== 'intro' ? needs[step as number] : null;
  const color = currentNeed ? COLORS[currentNeed.id] ?? '#888' : 'var(--accent)';
  const emoji = currentNeed ? NEED_DATA[currentNeed.id]?.emoji ?? '' : '';
  const total = needs.length;
  const progress = step === 'intro' ? 0 : ((step as number) + 1) / total;

  return (
    <BottomSheet onClose={finish} zIndex={250}>
      {step === 'intro' ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 4 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗂</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 10 }}>
              Что тебя вытаскивает?
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7 }}>
              Когда потребность низкая — сложно вспомнить что помогает.{' '}
              <span style={{ color: 'rgba(var(--fg-rgb),0.8)' }}>Добавь заранее</span> — и они будут под рукой в нужный момент.
            </div>
          </div>

          <div style={{
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}>
              В схема-терапии это называют <span style={{ color: 'var(--accent)', fontWeight: 500 }}>копинг-карточками</span> — маленькими напоминаниями себе о том, что реально работает. Не воля, а конкретный шаг.
            </div>
          </div>

          <button
            onClick={() => setStep(0)}
            style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #a78bfa, #4fa3f7)',
              color: 'var(--text)', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
            }}
          >
            Заполнить — займёт 2 минуты
          </button>
          <button
            onClick={finish}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
              background: 'transparent', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer',
            }}
          >
            Пропустить, сделаю позже
          </button>
        </div>
      ) : currentNeed && (
        <div>
          {/* Progress */}
          <div style={{ height: 2, background: 'rgba(var(--fg-rgb),0.07)', borderRadius: 2, marginBottom: 24 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${progress * 100}%`,
              background: color,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Need header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: color + '26',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              {emoji}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                {(step as number) + 1} из {total}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {currentNeed.chartLabel}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 14 }}>
            Выбери готовые или добавь своё:
          </div>

          {/* Suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {(CURATED[currentNeed.id] ?? []).map(text => {
              const on = selected.has(text);
              return (
                <div
                  key={text}
                  onClick={() => toggleSuggestion(text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: on ? color + '20' : 'rgba(var(--fg-rgb),0.04)',
                    border: `1px solid ${on ? color + '55' : 'rgba(var(--fg-rgb),0.08)'}`,
                    borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${on ? color : 'rgba(var(--fg-rgb),0.2)'}`,
                    background: on ? color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {on && <span style={{ fontSize: 11, color: '#000', fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14, color: on ? '#fff' : 'rgba(var(--fg-rgb),0.7)', lineHeight: 1.4 }}>{text}</span>
                </div>
              );
            })}
          </div>

          {/* Custom input */}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Или своё..."
            maxLength={200}
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(var(--fg-rgb),0.05)',
              border: `1px solid ${input.trim() ? color + '55' : 'rgba(var(--fg-rgb),0.1)'}`,
              borderRadius: 12, padding: '12px 14px',
              color: 'var(--text)', fontSize: 15, lineHeight: 1.5,
              resize: 'none', outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
              marginBottom: 12,
            }}
          />

          {saveError && (
            <div style={{ fontSize: 12, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 8 }}>
              Не удалось сохранить — попробуй ещё раз
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={next}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14,
                border: '1px solid rgba(var(--fg-rgb),0.1)',
                background: 'transparent', color: 'var(--text-sub)',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              {(step as number) === total - 1 ? 'Готово' : 'Пропустить →'}
            </button>
            <button
              onClick={handleSaveAndNext}
              disabled={saving || (selected.size === 0 && !input.trim())}
              style={{
                flex: 2, padding: '14px 0', borderRadius: 14, border: 'none',
                background: (selected.size > 0 || input.trim()) ? color : 'rgba(var(--fg-rgb),0.07)',
                color: 'var(--text)', fontSize: 15, fontWeight: 600,
                cursor: (selected.size > 0 || input.trim()) ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              {saving ? '...' : `Сохранить${selected.size + (input.trim() ? 1 : 0) > 0 ? ` (${selected.size + (input.trim() ? 1 : 0)})` : ''} →`}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
