import { useState, useEffect } from 'react';
import { api } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { FlashcardDoneScreen } from './flashcard/FlashcardDoneScreen';
import { FlashcardGrounding } from './flashcard/FlashcardGrounding';
import { FlashcardHistoryList, FlashcardView } from './flashcard/FlashcardHistory';
import { StepMode, StepResponse, StepNeed, StepAction } from './flashcard/FlashcardSteps';
import '../styles/sheet-tasks.css';
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

  if (viewing) {
    return <FlashcardView card={viewing} modes={MODES} needs={NEEDS} onBack={() => setViewing(null)} />;
  }

  if (showHistory) {
    return <FlashcardHistoryList cards={allCards} modes={MODES} needs={NEEDS} onBack={() => setShowHistory(false)} onOpen={setViewing} />;
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
      <FlashcardGrounding tr={tr} historyCount={allCards.length}
        onContinue={() => setGrounded(true)} onHistory={() => setShowHistory(true)} onClose={goBack} />
    );
  }

  const common = { stepIndex, total: STEPS.length };

  if (step === 'mode') {
    return (
      <StepMode {...common} onBack={goBack} backLabel="Закрыть" modes={MODES}
        hasHistory={allCards.length > 0} onHistory={() => setShowHistory(true)}
        onPick={id => { setSelectedMode(id); setStep('response'); }} />
    );
  }

  if (step === 'response') {
    return (
      <StepResponse {...common} onBack={() => setStep('mode')} backLabel="Назад" tr={tr}
        response={modeData?.response} reflection={reflection} setReflection={setReflection}
        onNext={() => setStep('need')} />
    );
  }

  if (step === 'need') {
    return (
      <StepNeed {...common} onBack={() => setStep('response')} backLabel="Назад" needs={NEEDS}
        selected={selectedNeed} onPick={id => { setSelectedNeed(id); setStep('action'); }} />
    );
  }

  return (
    <StepAction {...common} onBack={() => setStep('need')} backLabel="Назад" tr={tr}
      need={NEEDS.find(n => n.id === selectedNeed)} action={action} setAction={setAction} onSave={save} />
  );
}
