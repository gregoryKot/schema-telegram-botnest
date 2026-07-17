import { useState, useEffect } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import {
  buildModes,
  loadLocal,
  STEPS,
  STORAGE_KEY,
  type FlashcardEntry,
  type Step,
} from './schemaFlashcard/data';
import { ViewingCardSheet } from './schemaFlashcard/ViewingCardSheet';
import { HistoryListSheet } from './schemaFlashcard/HistoryListSheet';
import { DoneSheet } from './schemaFlashcard/DoneSheet';
import { GroundingSheet } from './schemaFlashcard/GroundingSheet';
import { ModeStepSheet } from './schemaFlashcard/ModeStepSheet';
import { ResponseStepSheet } from './schemaFlashcard/ResponseStepSheet';
import { NeedStepSheet } from './schemaFlashcard/NeedStepSheet';
import { ActionStepSheet } from './schemaFlashcard/ActionStepSheet';

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
  onComplete?: () => void;
}

export function SchemaFlashcard({ onClose, onOpenTracker, onComplete }: Props) {
  const tr = useTr();
  const MODES = buildModes(tr);
  const [grounded, setGrounded] = useState(false);
  const [step, setStep] = useState<Step>('mode');
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [selectedNeed, setSelectedNeed] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [done, setDone] = useState(false);
  const [allCards, setAllCards] = useState<FlashcardEntry[]>(() => loadLocal());
  const [viewing, setViewing] = useState<FlashcardEntry | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    api
      .getFlashcards()
      .then((rows) => {
        setAllCards(
          rows.map((r) => ({
            id: r.id,
            date: new Date(r.createdAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
            }),
            mode: r.modeId,
            reflection: r.reflection ?? '',
            needId: r.needId,
            action: r.action ?? '',
          })),
        );
      })
      .catch(() => {});
  }, []);

  const stepIndex = STEPS.indexOf(step);
  const modeData = MODES.find((m) => m.id === selectedMode);

  function save() {
    const entry: FlashcardEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
      }),
      mode: selectedMode!,
      reflection,
      needId: selectedNeed!,
      action,
    };
    const cards = [entry, ...loadLocal()].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    setAllCards(cards);
    api
      .createFlashcard({
        modeId: selectedMode!,
        needId: selectedNeed!,
        reflection: reflection || undefined,
        action: action || undefined,
      })
      .catch(() => {});
    setDone(true);
    onComplete?.();
  }

  function handleNew() {
    setStep('mode');
    setSelectedMode(null);
    setReflection('');
    setSelectedNeed(null);
    setAction('');
    setDone(false);
    setGrounded(false);
  }

  if (viewing) {
    return (
      <ViewingCardSheet
        viewing={viewing}
        modes={MODES}
        onClose={() => setViewing(null)}
      />
    );
  }

  if (showHistory) {
    return (
      <HistoryListSheet
        allCards={allCards}
        modes={MODES}
        onClose={() => setShowHistory(false)}
        onSelect={setViewing}
      />
    );
  }

  if (done) {
    return (
      <DoneSheet
        modes={MODES}
        selectedMode={selectedMode}
        selectedNeed={selectedNeed}
        action={action}
        onClose={onClose}
        onOpenTracker={onOpenTracker}
        onNew={handleNew}
        tr={tr}
      />
    );
  }

  if (!grounded) {
    return (
      <GroundingSheet
        cardsCount={allCards.length}
        onClose={onClose}
        onGrounded={() => setGrounded(true)}
        onShowHistory={() => setShowHistory(true)}
        tr={tr}
      />
    );
  }

  if (step === 'mode') {
    return (
      <ModeStepSheet
        modes={MODES}
        cardsCount={allCards.length}
        stepIndex={stepIndex}
        onClose={onClose}
        onShowHistory={() => setShowHistory(true)}
        onSelect={(modeId) => {
          setSelectedMode(modeId);
          setStep('response');
        }}
      />
    );
  }

  if (step === 'response') {
    return (
      <ResponseStepSheet
        response={modeData?.response}
        reflection={reflection}
        stepIndex={stepIndex}
        onClose={onClose}
        onReflectionChange={setReflection}
        onBack={() => setStep('mode')}
        onNext={() => setStep('need')}
        tr={tr}
      />
    );
  }

  if (step === 'need') {
    return (
      <NeedStepSheet
        selectedNeed={selectedNeed}
        stepIndex={stepIndex}
        onClose={onClose}
        onSelect={(needId) => {
          setSelectedNeed(needId);
          setStep('action');
        }}
        onBack={() => setStep('response')}
      />
    );
  }

  return (
    <ActionStepSheet
      selectedNeed={selectedNeed}
      stepIndex={stepIndex}
      action={action}
      onClose={onClose}
      onActionChange={setAction}
      onBack={() => setStep('need')}
      onSave={save}
      tr={tr}
    />
  );
}
