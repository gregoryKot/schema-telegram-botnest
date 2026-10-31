import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';

/** «Ровный день — тоже запись»: ворота «спокойно, хорошо» не требуют разбора. */
export function CaseSteadyStep({
  saving,
  failed,
  onBack,
  onSave,
  crisis,
  onHardNow,
}: {
  saving: boolean;
  failed: boolean;
  onBack: () => void;
  onSave: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад"
      eyebrow="Что случилось"
      title="Ровный день — тоже запись"
      lede="Спокойные дни остаются в записях рядом с трудными — так видно, что помогает."
    >
      {failed && (
        <p role="alert" className="cq-error">
          Не удалось сохранить. Всё на месте — можно повторить.
        </p>
      )}
      <CaseFlowFoot
        primaryLabel={saving ? 'Сохраняю…' : 'Записать так'}
        primaryDisabled={saving}
        onPrimary={onSave}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
