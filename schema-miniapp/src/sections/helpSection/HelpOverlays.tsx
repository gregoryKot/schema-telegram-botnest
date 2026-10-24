import { SchemaFlashcard } from '../../components/SchemaFlashcard';
import { BeliefCheck } from '../../components/BeliefCheck';
import { PhraseCheck } from '../../components/PhraseCheck';
import { LetterToSelf } from '../../components/LetterToSelf';
import { SafePlace } from '../../components/SafePlace';
import { WarmWords } from '../../components/WarmWords';
import { SchemaIntroSheet } from '../../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../../components/ModeIntroSheet';
import { SelfHelpSheet } from '../../components/SelfHelpDisclaimer';
import { QuickPracticeSheet } from '../../components/QuickPracticeSheet';
import { CrisisSheet } from './CrisisSheet';
import type { HelpOverlaysState } from './useHelpOverlays';

// Стена оверлеев раздела «Помощь»: десять листов-практик и интро
// схемы/режима. Состоянием владеет useHelpOverlays, здесь только рендер.
// Вынесено из HelpSection.tsx (правило №10).
export function HelpOverlays({
  overlays,
  onTaskComplete,
  onOpenTracker,
}: {
  overlays: HelpOverlaysState;
  onTaskComplete: (id?: number) => void;
  onOpenTracker?: () => void;
}) {
  return (
    <>
      {overlays.open.flashcard && (
        <SchemaFlashcard
          onClose={() => overlays.hide('flashcard')}
          onOpenTracker={onOpenTracker}
          onComplete={onTaskComplete}
        />
      )}
      {overlays.open.beliefCheck && (
        <BeliefCheck
          onClose={() => overlays.hide('beliefCheck')}
          onComplete={onTaskComplete}
        />
      )}
      {overlays.open.phraseCheck && (
        <PhraseCheck
          onClose={() => overlays.hide('phraseCheck')}
          onComplete={onTaskComplete}
        />
      )}
      {overlays.open.letterToSelf && (
        <LetterToSelf
          onClose={() => overlays.hide('letterToSelf')}
          onComplete={onTaskComplete}
        />
      )}
      {overlays.open.safePlace && (
        <SafePlace
          onClose={() => overlays.hide('safePlace')}
          onComplete={onTaskComplete}
        />
      )}
      {overlays.open.warmWords && (
        <WarmWords onClose={() => overlays.hide('warmWords')} />
      )}
      {overlays.introSchemaId && (
        <SchemaIntroSheet
          schemaId={overlays.introSchemaId}
          onClose={() => overlays.setIntroSchemaId(null)}
          onComplete={() => {
            overlays.setIntroSchemaId(null);
            onTaskComplete();
          }}
        />
      )}
      {overlays.introModeId && (
        <ModeIntroSheet
          modeId={overlays.introModeId}
          onClose={() => overlays.setIntroModeId(null)}
          onComplete={() => {
            overlays.setIntroModeId(null);
            onTaskComplete();
          }}
        />
      )}
      {overlays.open.selfHelp && (
        <SelfHelpSheet
          onClose={() => overlays.hide('selfHelp')}
          onOpenCrisis={() => {
            overlays.hide('selfHelp');
            overlays.show('crisis');
          }}
        />
      )}
      {overlays.open.grounding && (
        <QuickPracticeSheet
          id="grounding"
          onClose={() => overlays.hide('grounding')}
        />
      )}
      {overlays.open.stop && (
        <QuickPracticeSheet id="stop" onClose={() => overlays.hide('stop')} />
      )}
      {overlays.open.crisis && (
        <CrisisSheet onClose={() => overlays.hide('crisis')} />
      )}
    </>
  );
}
