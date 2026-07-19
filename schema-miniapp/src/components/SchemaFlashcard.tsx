import { useState, useEffect } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import {
  STORAGE_KEY,
  STEPS,
  buildModes,
  loadLocal,
} from './schemaFlashcard/constants';
import type { FlashcardEntry, Step } from './schemaFlashcard/types';
import { ViewCard } from './schemaFlashcard/ViewCard';
import { HistoryList } from './schemaFlashcard/HistoryList';
import { DoneStep } from './schemaFlashcard/DoneStep';
import { GroundingStep } from './schemaFlashcard/GroundingStep';
import { ModeStep } from './schemaFlashcard/ModeStep';
import { ResponseStep } from './schemaFlashcard/ResponseStep';
import { NeedStep } from './schemaFlashcard/NeedStep';
import { ActionStep } from './schemaFlashcard/ActionStep';

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

  // ── Viewing past card ─────────────────────────────────────────────────────
  if (viewing) {
    return (
      <ViewCard
        viewing={viewing}
        modes={MODES}
        onClose={() => setViewing(null)}
      />
    );
  }

  // ── History list ──────────────────────────────────────────────────────────
  if (showHistory) {
    return (
      <HistoryList
        allCards={allCards}
        modes={MODES}
        onClose={() => setShowHistory(false)}
        onView={setViewing}
      />
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <DoneStep
        modes={MODES}
        selectedMode={selectedMode}
        selectedNeed={selectedNeed}
        action={action}
        tr={tr}
        onClose={onClose}
        onOpenTracker={onOpenTracker}
        onNew={handleNew}
      />
    );
  }

  // ── Grounding ─────────────────────────────────────────────────────────────
  if (!grounded) {
    return (
      <GroundingStep
        allCardsCount={allCards.length}
        tr={tr}
        onClose={onClose}
        onContinue={() => setGrounded(true)}
        onShowHistory={() => setShowHistory(true)}
      />
    );
  }

  // ── Step 1: Mode ──────────────────────────────────────────────────────────
  if (step === 'mode') {
    return (
      <ModeStep
        modes={MODES}
        allCardsCount={allCards.length}
        stepIndex={stepIndex}
        onClose={onClose}
        onShowHistory={() => setShowHistory(true)}
        onSelectMode={(id) => {
          setSelectedMode(id);
          setStep('response');
        }}
      />
    );
  }

  // ── Step 2: Healthy Adult response ────────────────────────────────────────
  if (step === 'response') {
    return (
      <ResponseStep
        modeData={modeData}
        reflection={reflection}
        setReflection={setReflection}
        stepIndex={stepIndex}
        tr={tr}
        onClose={onClose}
        onBack={() => setStep('mode')}
        onNext={() => setStep('need')}
      />
    );
  }

  // ── Step 3: Need ──────────────────────────────────────────────────────────
  if (step === 'need') {
    return (
      <NeedStep
        selectedNeed={selectedNeed}
        stepIndex={stepIndex}
        onClose={onClose}
        onBack={() => setStep('response')}
        onSelectNeed={(id) => {
          setSelectedNeed(id);
          setStep('action');
        }}
      />
    );
  }

  // ── Step 4: Action ────────────────────────────────────────────────────────
  return (
    <ActionStep
      selectedNeed={selectedNeed}
      action={action}
      setAction={setAction}
      stepIndex={stepIndex}
      tr={tr}
      onClose={onClose}
      onBack={() => setStep('need')}
      onSave={save}
    />
  );
}
