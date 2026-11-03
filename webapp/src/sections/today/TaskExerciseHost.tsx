import { lazy, Suspense } from 'react';
import { Loader } from '../../components/Loader';
import type { OpenExercise } from './useTaskLauncher';

// Упражнения поверх экрана — один набор на «Сегодня» и «Практику» (раньше
// «Сегодня» умело открыть только карточки схемы и режима). Каждое упражнение
// само полноэкранное и само держит «Назад» через useHistorySheet; onComplete
// зовётся при сохранении, закрывает лист пользователь (экран «Готово»
// упражнения остаётся видимым). Код упражнений — отдельными чанками.
const BeliefCheckEx = lazy(() => import('../../components/exercises/BeliefCheckEx').then(m => ({ default: m.BeliefCheckEx })));
const SchemaEx = lazy(() => import('../../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx = lazy(() => import('../../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
const LetterEx = lazy(() => import('../../components/exercises/LetterEx').then(m => ({ default: m.LetterEx })));
const SafePlaceEx = lazy(() => import('../../components/exercises/SafePlaceEx').then(m => ({ default: m.SafePlaceEx })));
const WarmWordsEx = lazy(() => import('../../components/exercises/WarmWordsEx').then(m => ({ default: m.WarmWordsEx })));
const PhraseCheckEx = lazy(() => import('../../components/exercises/PhraseCheckEx').then(m => ({ default: m.PhraseCheckEx })));
const SchemaFlashcard = lazy(() => import('../../components/SchemaFlashcard').then(m => ({ default: m.SchemaFlashcard })));

export function TaskExerciseHost({ open, onBack, onComplete, onOpenTracker }: {
  open: OpenExercise | null;
  onBack: () => void;
  onComplete: () => void;
  onOpenTracker: () => void;
}) {
  if (!open) return null;
  return (
    <Suspense fallback={<Loader minHeight="100dvh" />}>
      {open.ex === 'belief' && <BeliefCheckEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'schema' && <SchemaEx onBack={onBack} initialSchemaId={open.id} onComplete={onComplete} />}
      {open.ex === 'mode' && <ModeEx onBack={onBack} initialModeId={open.id} onComplete={onComplete} />}
      {open.ex === 'letter' && <LetterEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'safe' && <SafePlaceEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'warm' && <WarmWordsEx onBack={onBack} />}
      {open.ex === 'phrase' && <PhraseCheckEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'flashcard' && <SchemaFlashcard onClose={onBack} onOpenTracker={onOpenTracker} onComplete={onComplete} />}
    </Suspense>
  );
}
