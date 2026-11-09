import { CaseStepScreen } from './CaseStepScreen';
import { CaseFlowFoot } from './caseFlowUi';
import { TertiaryLink } from './caseLinks';
import { CaseSummaryAside } from './CaseSummaryAside';
import { CaseResultHelp } from './CaseResultHelp';
import { CaseSaveError } from './CaseSaveError';
import { SceneCaseFound } from '../art/SceneCaseFound';
import { getModeById } from '../../schemaTherapyData';
import { modeLook } from '../../../../shared/src/theme/entityLook';
import type { QuickResultView } from '../../../../shared/src/case/quick/caseQuick';

/**
 * Итог разбора: предложенный режим, что собрали, что поможет сейчас. «Сохранить»
 * — это и согласие с режимом; сомнение уходит в «Не похоже — другие режимы».
 * Лист — бумага группы найденного режима со сценой SceneCaseFound (лента разбора
 * и знак группы), а не шалфей шагов: здесь главное — кто взял управление.
 */
export function CaseResultStep({
  view,
  saving,
  failed,
  onBack,
  onSave,
  onDoubt,
  crisis,
  onHardNow,
}: {
  view: QuickResultView;
  saving: boolean;
  failed: boolean;
  onBack: () => void;
  onSave: () => void;
  onDoubt: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const look = modeLook(view.modeId, getModeById(view.modeId)?.groupId);
  return (
    <CaseStepScreen
      onBack={onBack}
      look={look}
      heroArt={<SceneCaseFound sign={look.sign} hue={look.hue} className="cq-scene" />}
      eyebrow="Похоже на режим"
      title={view.name}
      lede={view.desc || undefined}
    >
      {view.need && <p className="cq-need">Что ему нужно: {view.need}</p>}
      <CaseSummaryAside rows={view.rows} signs={false} />
      <CaseResultHelp />
      {failed && <CaseSaveError />}

      <CaseFlowFoot
        primaryLabel={saving ? 'Сохраняю…' : 'Сохранить'}
        primaryDisabled={saving}
        onPrimary={onSave}
        crisis={crisis}
        onHardNow={onHardNow}
      >
        <TertiaryLink label="Не похоже — другие режимы" onClick={onDoubt} />
      </CaseFlowFoot>
    </CaseStepScreen>
  );
}
