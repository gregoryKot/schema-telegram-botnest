import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';

const STORAGE_KEY = 'belief_checks';

interface BeliefEntry {
  id: string | number;
  date: string;
  belief: string;
  for: string[];
  against: string[];
  reframe: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function loadLocal(): BeliefEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

type Step = 'belief' | 'for' | 'against' | 'reframe' | 'done';

interface Props { onClose: () => void; onComplete?: () => void; }

export function BeliefCheck({ onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>('belief');
  const [belief, setBelief] = useState('');
  const [forInput, setForInput] = useState('');
  const [forList, setForList] = useState<string[]>([]);
  const [againstInput, setAgainstInput] = useState('');
  const [againstList, setAgainstList] = useState<string[]>([]);
  const [reframe, setReframe] = useState('');
  const [history, setHistory] = useState<BeliefEntry[]>(() => loadLocal().slice(0, 3));

  useEffect(() => {
    api.getBeliefChecks().then(rows => {
      setHistory(rows.slice(0, 3).map(r => ({
        id: r.id, date: fmtDate(r.createdAt), belief: r.belief,
        for: r.evidenceFor, against: r.evidenceAgainst, reframe: r.reframe ?? '',
      })));
    }).catch(() => {});
  }, []);

  function addFor() {
    const v = forInput.trim();
    if (!v) return;
    setForList(l => [...l, v]);
    setForInput('');
  }

  function addAgainst() {
    const v = againstInput.trim();
    if (!v) return;
    setAgainstList(l => [...l, v]);
    setAgainstInput('');
  }

  async function handleSave() {
    const entry: BeliefEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
      belief: belief.trim(),
      for: forList,
      against: againstList,
      reframe: reframe.trim(),
    };
    // Sync to localStorage immediately
    const all = [entry, ...loadLocal()].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    // Save to server
    api.createBeliefCheck({ belief: entry.belief, evidenceFor: entry.for, evidenceAgainst: entry.against, reframe: entry.reframe || undefined }).catch(() => {});
    setStep('done');
    onComplete?.();
  }

  if (step === 'done') {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Проверено</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 20 }}>
            Иногда достаточно увидеть доказательства, чтобы мысль потеряла силу
          </div>
          <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 16, padding: '14px 16px', textAlign: 'left', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 6 }}>УБЕЖДЕНИЕ</div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>«{belief}»</div>
            {forList.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>ЗА ({forList.length})</div>
                {forList.map((f, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 2 }}>• {f}</div>)}
                <div style={{ marginBottom: 10 }} />
              </>
            )}
            {againstList.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600, marginBottom: 4 }}>ПРОТИВ ({againstList.length})</div>
                {againstList.map((a, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 2 }}>• {a}</div>)}
                <div style={{ marginBottom: 10 }} />
              </>
            )}
            {reframe && (
              <>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>ПЕРЕФОРМУЛИРОВКА</div>
                <div style={{ fontSize: 13, color: 'rgba(var(--fg-rgb),0.75)', lineHeight: 1.5 }}>{reframe}</div>
              </>
            )}
          </div>
          <button onClick={onClose} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'rgba(96,165,250,0.15)', color: 'var(--accent-blue)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Готово
          </button>
        </div>
      </BottomSheet>
    );
  }

  const STEP_ORDER: Step[] = ['belief', 'for', 'against', 'reframe'];
  const stepIndex = STEP_ORDER.indexOf(step as Exclude<Step, 'done'>);
  const STEP_LABELS = ['Убеждение', 'За', 'Против', 'Переформулировка'];

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          {STEP_ORDER.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= stepIndex ? 'var(--accent-blue)' : 'rgba(var(--fg-rgb),0.1)', transition: 'background 0.2s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          {STEP_LABELS.map((label, i) => (
            <div key={i} style={{ fontSize: 9, color: i === stepIndex ? 'var(--accent-blue)' : 'rgba(var(--fg-rgb),0.2)', fontWeight: i === stepIndex ? 700 : 400, transition: 'color 0.2s', textAlign: 'center', flex: 1 }}>
              {label}
            </div>
          ))}
        </div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            🔍
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Проверить убеждение</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>Правда ли это на самом деле?</div>
          </div>
        </div>

        {step === 'belief' && (
          <>
            <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                Запиши мысль или убеждение, которое тебя беспокоит. Схемы часто говорят с нами голосом абсолютных утверждений: «я никогда», «всё всегда», «я недостаточно».
              </div>
            </div>
            <textarea
              value={belief}
              onChange={e => setBelief(e.target.value)}
              placeholder="Например: я всегда всё порчу, меня никто не любит..."
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(var(--fg-rgb),0.04)', border: `1px solid ${belief.trim() ? 'rgba(96,165,250,0.3)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 14, padding: '13px 14px', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 14 }}
            />
            <button onClick={() => setStep('for')} disabled={!belief.trim()} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: belief.trim() ? 'rgba(96,165,250,0.15)' : 'rgba(var(--fg-rgb),0.06)', color: belief.trim() ? 'var(--accent-blue)' : 'rgba(var(--fg-rgb),0.25)', fontSize: 15, fontWeight: 600, cursor: belief.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
              Дальше →
            </button>
          </>
        )}

        {step === 'for' && (
          <>
            <div style={{ background: 'color-mix(in srgb, var(--accent-red) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 12%, transparent)', borderRadius: 14, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>Доказательства ЗА</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>«{belief}» — что подтверждает эту мысль? Будь честен.</div>
            </div>
            {forList.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {forList.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.05)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-sub)', flex: 1 }}>• {f}</span>
                    <span onClick={() => setForList(l => l.filter((_, j) => j !== i))} style={{ fontSize: 16, color: 'var(--text-faint)', cursor: 'pointer', padding: '0 4px' }}>×</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={forInput}
                onChange={e => setForInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFor()}
                placeholder="Добавить..."
                style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={addFor} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'color-mix(in srgb, var(--accent-red) 15%, transparent)', color: 'var(--accent-red)', fontSize: 16, cursor: 'pointer' }}>+</button>
            </div>
            <button onClick={() => setStep('against')} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'rgba(96,165,250,0.15)', color: 'var(--accent-blue)', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              Дальше →
            </button>
          </>
        )}

        {step === 'against' && (
          <>
            <div style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 12%, transparent)', borderRadius: 14, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600, marginBottom: 4 }}>Доказательства ПРОТИВ</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>Что опровергает «{belief}»? Вспомни факты, исключения, другие точки зрения.</div>
            </div>
            {againstList.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {againstList.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.05)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-sub)', flex: 1 }}>• {a}</span>
                    <span onClick={() => setAgainstList(l => l.filter((_, j) => j !== i))} style={{ fontSize: 16, color: 'var(--text-faint)', cursor: 'pointer', padding: '0 4px' }}>×</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={againstInput}
                onChange={e => setAgainstInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addAgainst()}
                placeholder="Добавить..."
                style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={addAgainst} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: 'var(--accent-green)', fontSize: 16, cursor: 'pointer' }}>+</button>
            </div>
            <button onClick={() => setStep('reframe')} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'rgba(96,165,250,0.15)', color: 'var(--accent-blue)', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              Дальше →
            </button>
          </>
        )}

        {step === 'reframe' && (
          <>
            <div style={{ background: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 12%, transparent)', borderRadius: 14, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Переформулировка</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>
                Посмотрев на оба списка — как можно сформулировать эту мысль точнее и добрее к себе?
              </div>
            </div>
            <textarea
              value={reframe}
              onChange={e => setReframe(e.target.value)}
              placeholder="Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу..."
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(var(--fg-rgb),0.04)', border: `1px solid ${reframe.trim() ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 14, padding: '13px 14px', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 14 }}
            />
            <button onClick={handleSave} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: 'var(--accent-green)', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}>
              Сохранить
            </button>
          </>
        )}

        {step === 'belief' && history.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>Прошлые проверки</div>
            {history.map(h => (
              <div key={h.id} style={{ padding: '10px 14px', background: 'rgba(var(--fg-rgb),0.03)', border: '1px solid rgba(var(--fg-rgb),0.06)', borderRadius: 12, marginBottom: 7 }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 3 }}>{h.date}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>«{h.belief}»</div>
              </div>
            ))}
          </div>
        )}

        {(step === 'reframe' || step === 'belief') && <div style={{ marginTop: 12 }}><TherapyNote compact /></div>}
      </div>
    </BottomSheet>
  );
}
