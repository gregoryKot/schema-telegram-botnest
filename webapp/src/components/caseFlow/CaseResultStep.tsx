import { CaseStepScreen } from './CaseStepScreen';
import { CaseFlowFoot } from './caseFlowUi';
import { CaseSummaryAside } from './CaseSummaryAside';
import { CaseResultHelp } from './CaseResultHelp';
import { CaseSaveError } from './CaseSaveError';
import { SceneCaseFound } from '../art/SceneCaseFound';
import { getModeById } from '../../schemaTherapyData';
import { modeLook } from '../../../../shared/src/theme/entityLook';
import type { QuickResultView } from '../../../../shared/src/case/quick/caseQuick';
import { glue } from '../../../../shared/src/utils/typo';
import { useTr } from '../../utils/addressForm';
import { haptic } from '../../haptic';

/**
 * Итог разбора: предложенный режим, что собрали, что поможет сейчас. «Сохранить»
 * — это и согласие с режимом; сомнение уходит в «Не похоже — другие режимы».
 * При первой встрече (записей режимов ещё нет) — строка, что такое режим.
 * Лист — бумага группы режима со сценой SceneCaseFound (лента и знак группы), а не шалфей
 * шагов: главное — кто взял управление. На телефоне сцена углом (cq-scene--found).
 */
export function CaseResultStep({ view, saving, failed, onBack, onSave, onDoubt, crisis, onHardNow, firstMode }: {
  view: QuickResultView;
  saving: boolean;
  failed: boolean;
  onBack: () => void;
  onSave: () => void;
  onDoubt: () => void;
  crisis: boolean;
  onHardNow: () => void;
  /** Записей режимов ещё нет: слово «режим» встречается впервые. */
  firstMode?: boolean;
}) {
  const tr = useTr();
  const look = modeLook(view.modeId, getModeById(view.modeId)?.groupId);
  return (
    <CaseStepScreen
      onBack={onBack}
      look={look}
      heroArt={<SceneCaseFound sign={look.sign} hue={look.hue} className="cq-scene cq-scene--found" />}
      eyebrow="Похоже на режим"
      title={view.name}
      lede={view.desc || undefined}
    >
      {firstMode && (
        <p className="cq-mode-intro">
          {tr(
            'Режим — состояние, в которое переключаешься в трудный момент. У каждого их несколько, и они сменяют друг друга.',
            'Режим — состояние, в которое переключаетесь в трудный момент. У каждого их несколько, и они сменяют друг друга.',
          )}
        </p>
      )}
      {view.need && <p className="cq-need">{glue(`Что ему нужно: ${view.need}`)}</p>}
      <CaseSummaryAside rows={view.rows} signs={false} />
      <CaseResultHelp />
      {failed && <CaseSaveError />}
      <p className="cq-agree-note">
        {tr(
          'Узнаёшь себя — сохрани, и режим ляжет на карту себя. Не узнаёшь — выбери другой: на карту попадёт он.',
          'Узнаёте себя — сохраните, и режим ляжет на карту себя. Не узнаёте — выберите другой: на карту попадёт он.',
        )}
      </p>

      <CaseFlowFoot
        primaryLabel={saving ? 'Сохраняю…' : 'Сохранить'}
        primaryDisabled={saving}
        onPrimary={onSave}
        crisis={crisis}
        onHardNow={onHardNow}
      >
        <button type="button" className="ds-btn ds-btn--secondary cq-doubt" onClick={() => { haptic.tap(); onDoubt(); }}>
          Не похоже — выбрать другой режим
        </button>
      </CaseFlowFoot>
    </CaseStepScreen>
  );
}
