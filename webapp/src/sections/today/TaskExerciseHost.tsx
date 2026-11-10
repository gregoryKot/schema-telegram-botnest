import { lazy, Suspense } from 'react';
import { ExScreenSkeleton } from '../../components/exercises/ExScreen';
import { ExBackLabelContext, EX_BACK_DEFAULT } from '../../components/exercises/exBackLabel';
import type { OpenExercise } from './useTaskLauncher';
import { exerciseHue } from './exerciseHue';

// Упражнения поверх экрана — один набор на «Сегодня» и «Практику». Каждое упражнение
// само полноэкранное и само держит «Назад» через useHistorySheet; onComplete
// зовётся при сохранении, закрывает лист пользователь (экран «Готово»
// упражнения остаётся видимым). Код упражнений — отдельными чанками; силуэт — на бумаге упражнения.
const BeliefCheckEx = lazy(() => import('../../components/exercises/BeliefCheckEx').then(m => ({ default: m.BeliefCheckEx })));
const SchemaEx = lazy(() => import('../../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx = lazy(() => import('../../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
const LetterEx = lazy(() => import('../../components/exercises/LetterEx').then(m => ({ default: m.LetterEx })));
const SafePlaceEx = lazy(() => import('../../components/exercises/SafePlaceEx').then(m => ({ default: m.SafePlaceEx })));
const WarmWordsEx = lazy(() => import('../../components/exercises/WarmWordsEx').then(m => ({ default: m.WarmWordsEx })));
const PhraseCheckEx = lazy(() => import('../../components/exercises/PhraseCheckEx').then(m => ({ default: m.PhraseCheckEx })));
const SchemaFlashcard = lazy(() => import('../../components/SchemaFlashcard').then(m => ({ default: m.SchemaFlashcard })));
const YSQTestSheet = lazy(() => import('../../components/YSQTestSheet').then(m => ({ default: m.YSQTestSheet })));

export function TaskExerciseHost({ open, onBack, onComplete, onOpenTracker, backLabel = EX_BACK_DEFAULT }: {
  open: OpenExercise | null;
  onBack: () => void;
  onComplete: () => void;
  onOpenTracker: () => void;
  /** Подпись «Назад» в шапке упражнения: с «Сегодня» — просто «Назад» (QA 2026-11, A-М10). */
  backLabel?: string;
}) {
  if (!open) return null;
  return (
    <ExBackLabelContext.Provider value={backLabel}>
    <Suspense fallback={<ExScreenSkeleton onBack={onBack} hue={exerciseHue(open)} />}>
      {open.ex === 'belief' && <BeliefCheckEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'schema' && <SchemaEx onBack={onBack} initialSchemaId={open.id} onComplete={onComplete} />}
      {open.ex === 'mode' && <ModeEx onBack={onBack} initialModeId={open.id} onComplete={onComplete} />}
      {open.ex === 'letter' && <LetterEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'safe' && <SafePlaceEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'warm' && <WarmWordsEx onBack={onBack} />}
      {open.ex === 'phrase' && <PhraseCheckEx onBack={onBack} onComplete={onComplete} />}
      {open.ex === 'flashcard' && <SchemaFlashcard onClose={onBack} onOpenTracker={onOpenTracker} onComplete={onComplete} />}
      {open.ex === 'ysq' && <YSQTestSheet onClose={onBack} autoResume />}
    </Suspense>
    </ExBackLabelContext.Provider>
  );
}
