import { CaseStepScreen } from './CaseStepScreen';
import { CaseFlowFoot } from './caseFlowUi';
import { CaseSaveError } from './CaseSaveError';
import { SignScene } from '../art/SceneParts';
import { Strokes } from '../art/PaperArt';
import type { ArtProps } from '../art/paper';

/** Ровный день — пять полосок одной высоты, без наклона (Strokes even, PAPER_2026-11.md): у шага и у его итога. */
const EvenStrokes = ({ size }: ArtProps) => <Strokes even size={size} />;
export const SteadyArt = ({ className }: { className: string }) => <SignScene Art={EvenStrokes} className={className} />;

/** «Ровный день — тоже запись»: ворота «спокойно, хорошо» не требуют разбора. */
export function CaseSteadyStep({ saving, failed, onBack, onSave, crisis, onHardNow }: {
  saving: boolean;
  failed: boolean;
  onBack: () => void;
  onSave: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  return (
    <CaseStepScreen
      onBack={onBack} spread={false}
      heroArt={<SteadyArt className="cq-steady-art" />}
      eyebrow="Что случилось"
      title="Ровный день — тоже запись"
      lede="Спокойные дни остаются в записях рядом с трудными — так видно, что помогает."
    >
      {failed && <CaseSaveError />}
      <CaseFlowFoot
        primaryLabel={saving ? 'Сохраняю…' : 'Записать так'}
        primaryDisabled={saving}
        onPrimary={onSave}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </CaseStepScreen>
  );
}
