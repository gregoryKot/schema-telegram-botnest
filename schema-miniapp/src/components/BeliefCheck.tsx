import { useState, useEffect } from 'react';
import { BeliefStep } from './beliefCheck/BeliefStep';
import { EvidenceStep } from './beliefCheck/EvidenceStep';
import { ReframeStep } from './beliefCheck/ReframeStep';
import { HistoryList } from './beliefCheck/HistoryList';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { cm } from '../sections/schemas/utils';
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
      .catch((e) => console.error('getBeliefChecks failed', e));
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
                borderRadius: 'var(--r-2)',
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
            gap: 'var(--space-12)',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--r-14)',
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
          <BeliefStep
            belief={belief}
            setBelief={setBelief}
            onNext={() => setStep('for')}
          />
        )}

        {step === 'for' && (
          <EvidenceStep
            accent="var(--accent-red)"
            title="Доказательства ЗА"
            hint={<>«{belief}» — что подтверждает эту мысль? Будь честен.</>}
            items={forList}
            setItems={setForList}
            input={forInput}
            setInput={setForInput}
            onAdd={addFor}
            onNext={() => setStep('against')}
          />
        )}

        {step === 'against' && (
          <EvidenceStep
            accent="var(--accent-green)"
            title="Доказательства ПРОТИВ"
            hint={
              <>
                Что опровергает «{belief}»?{' '}
                {tr(
                  'Вспомни факты, исключения, другие точки зрения.',
                  'Вспомните факты, исключения, другие точки зрения.',
                )}
              </>
            }
            items={againstList}
            setItems={setAgainstList}
            input={againstInput}
            setInput={setAgainstInput}
            onAdd={addAgainst}
            onNext={() => setStep('reframe')}
          />
        )}

        {step === 'reframe' && (
          <ReframeStep
            reframe={reframe}
            setReframe={setReframe}
            saving={saving}
            saveError={saveError}
            onSave={handleSave}
          />
        )}

        {step === 'belief' && history.length > 0 && (
          <HistoryList history={history} />
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
