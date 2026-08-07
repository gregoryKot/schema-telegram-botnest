import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { CrisisGate } from './CrisisGate';
import { SaveErrorNote } from './SaveErrorNote';
import { cm } from '../sections/schemas/utils';
import { EvidenceList } from './beliefCheck/EvidenceList';
import { BeliefEntry, fmtDate, loadLocal } from './beliefCheck/storage';
import { BeliefDoneScreen } from './beliefCheck/DoneScreen';
import { useSaveBeliefCheck } from './beliefCheck/useSaveBeliefCheck';

type Step = 'belief' | 'for' | 'against' | 'reframe' | 'done';

interface Props {
  onClose: () => void;
  onComplete?: () => void;
}

export function BeliefCheck({ onClose, onComplete }: Props) {
  const tr = useTr();
  const [step, setStep] = useState<Step>('belief');
  const [belief, setBelief] = useState('');
  const [forInput, setForInput] = useState('');
  const [forList, setForList] = useState<string[]>([]);
  const [againstInput, setAgainstInput] = useState('');
  const [againstList, setAgainstList] = useState<string[]>([]);
  const [reframe, setReframe] = useState('');
  const { saving, saveError, save } = useSaveBeliefCheck(
    () => setStep('done'),
    onComplete,
  );
  const [history, setHistory] = useState<BeliefEntry[]>(() =>
    loadLocal().slice(0, 3),
  );

  useEffect(() => {
    api
      .getBeliefChecks()
      .then((rows) => {
        setHistory(
          rows.slice(0, 3).map((r) => ({
            id: r.id,
            date: fmtDate(r.createdAt),
            belief: r.belief,
            for: r.evidenceFor,
            against: r.evidenceAgainst,
            reframe: r.reframe ?? '',
          })),
        );
      })
      .catch(() => {});
  }, []);

  function addFor() {
    const v = forInput.trim();
    if (!v) return;
    setForList((l) => [...l, v]);
    setForInput('');
  }

  function addAgainst() {
    const v = againstInput.trim();
    if (!v) return;
    setAgainstList((l) => [...l, v]);
    setAgainstInput('');
  }

  function handleSave() {
    void save({ belief, forList, againstList, reframe });
  }

  if (step === 'done') {
    return (
      <BeliefDoneScreen
        belief={belief}
        forList={forList}
        againstList={againstList}
        reframe={reframe}
        onClose={onClose}
      />
    );
  }

  const STEP_ORDER: Step[] = ['belief', 'for', 'against', 'reframe'];
  const stepIndex = STEP_ORDER.indexOf(step);
  const STEP_LABELS = ['Убеждение', 'За', 'Против', 'Переформулировка'];

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          {STEP_ORDER.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background:
                  i <= stepIndex
                    ? 'var(--accent-blue)'
                    : 'rgba(var(--fg-rgb),0.1)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          {STEP_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                fontSize: 9,
                color:
                  i === stepIndex
                    ? 'var(--accent-blue)'
                    : 'rgba(var(--fg-rgb),0.2)',
                fontWeight: i === stepIndex ? 700 : 400,
                transition: 'color 0.2s',
                textAlign: 'center',
                flex: 1,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: cm('var(--accent-blue)', 12),
              border: `1px solid ${cm('var(--accent-blue)', 20)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            🔍
          </div>
          <div>
            <div
              style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}
            >
              Проверить убеждение
            </div>
            <div
              style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}
            >
              Правда ли это на самом деле?
            </div>
          </div>
        </div>

        {step === 'belief' && (
          <>
            <div
              style={{
                background: cm('var(--accent-blue)', 6),
                border: `1px solid ${cm('var(--accent-blue)', 12)}`,
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                }}
              >
                {tr(
                  'Запиши мысль или убеждение, которое тебя беспокоит.',
                  'Запишите мысль или убеждение, которое вас беспокоит.',
                )}{' '}
                Схемы часто говорят с нами голосом абсолютных утверждений: «я
                никогда», «всё всегда», «я недостаточно».
              </div>
            </div>
            <textarea
              value={belief}
              onChange={(e) => setBelief(e.target.value)}
              placeholder="Например: я всегда всё порчу, меня никто не любит..."
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(var(--fg-rgb),0.04)',
                border: `1px solid ${belief.trim() ? cm('var(--accent-blue)', 30) : 'rgba(var(--fg-rgb),0.1)'}`,
                borderRadius: 14,
                padding: '13px 14px',
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.7,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            />
            <CrisisGate texts={[belief]} surface="belief_check" />
            <button
              onClick={() => setStep('for')}
              disabled={!belief.trim()}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 14,
                border: 'none',
                background: belief.trim()
                  ? cm('var(--accent-blue)', 15)
                  : 'rgba(var(--fg-rgb),0.06)',
                color: belief.trim()
                  ? 'var(--accent-blue)'
                  : 'rgba(var(--fg-rgb),0.25)',
                fontSize: 15,
                fontWeight: 600,
                cursor: belief.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              Дальше →
            </button>
          </>
        )}

        {step === 'for' && (
          <>
            <div
              style={{
                background: cm('var(--accent-red)', 6),
                border: `1px solid ${cm('var(--accent-red)', 12)}`,
                borderRadius: 14,
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-red)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Доказательства ЗА
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.5,
                }}
              >
                «{belief}» — что подтверждает эту мысль? Будь честен.
              </div>
            </div>
            <EvidenceList
              items={forList}
              setItems={setForList}
              input={forInput}
              setInput={setForInput}
              onAdd={addFor}
              accentColor="var(--accent-red)"
              surface="belief_check"
            />
            <button
              onClick={() => setStep('against')}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 14,
                border: 'none',
                background: cm('var(--accent-blue)', 15),
                color: 'var(--accent-blue)',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Дальше →
            </button>
          </>
        )}

        {step === 'against' && (
          <>
            <div
              style={{
                background: cm('var(--accent-green)', 6),
                border: `1px solid ${cm('var(--accent-green)', 12)}`,
                borderRadius: 14,
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent-green)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Доказательства ПРОТИВ
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.5,
                }}
              >
                Что опровергает «{belief}»?{' '}
                {tr(
                  'Вспомни факты, исключения, другие точки зрения.',
                  'Вспомните факты, исключения, другие точки зрения.',
                )}
              </div>
            </div>
            <EvidenceList
              items={againstList}
              setItems={setAgainstList}
              input={againstInput}
              setInput={setAgainstInput}
              onAdd={addAgainst}
              accentColor="var(--accent-green)"
              surface="belief_check"
            />
            <button
              onClick={() => setStep('reframe')}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 14,
                border: 'none',
                background: cm('var(--accent-blue)', 15),
                color: 'var(--accent-blue)',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Дальше →
            </button>
          </>
        )}

        {step === 'reframe' && (
          <>
            <div
              style={{
                background: cm('var(--accent)', 6),
                border: `1px solid ${cm('var(--accent)', 12)}`,
                borderRadius: 14,
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--accent)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Переформулировка
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.5,
                }}
              >
                Посмотрев на оба списка — как можно сформулировать эту мысль
                точнее и добрее к себе?
              </div>
            </div>
            <textarea
              value={reframe}
              onChange={(e) => setReframe(e.target.value)}
              placeholder="Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу..."
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(var(--fg-rgb),0.04)',
                border: `1px solid ${reframe.trim() ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
                borderRadius: 14,
                padding: '13px 14px',
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.7,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            />
            <CrisisGate texts={[reframe]} surface="belief_check" />
            {saveError && (
              <SaveErrorNote
                ty="Не удалось сохранить на сервере. Работа осталась на этом устройстве — попробуй ещё раз."
                vy="Не удалось сохранить на сервере. Работа осталась на этом устройстве — попробуйте ещё раз."
              />
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 14,
                border: 'none',
                background: cm('var(--accent-green)', 15),
                color: 'var(--accent-green)',
                fontSize: 15,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s',
                marginBottom: 16,
              }}
            >
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </>
        )}

        {step === 'belief' && history.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 10,
              }}
            >
              Прошлые проверки
            </div>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  padding: '10px 14px',
                  background: 'rgba(var(--fg-rgb),0.03)',
                  border: '1px solid rgba(var(--fg-rgb),0.06)',
                  borderRadius: 12,
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    marginBottom: 3,
                  }}
                >
                  {h.date}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.4,
                  }}
                >
                  «{h.belief}»
                </div>
              </div>
            ))}
          </div>
        )}

        {(step === 'reframe' || step === 'belief') && (
          <div style={{ marginTop: 12 }}>
            <TherapyNote compact />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
