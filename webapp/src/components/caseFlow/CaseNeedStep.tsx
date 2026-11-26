import { CaseStepScreen } from './CaseStepScreen';
import { CaseFlowFoot } from './caseFlowUi';
import { TertiaryLink } from './caseLinks';
import { needDataStyle } from '../needDataColor';
import { useTr } from '../../utils/addressForm';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { NEED_NAMES } from '../../../../shared/src/needs/needNames';

/**
 * Шаг 4 из 4 — «Чего не хватило?»: одна из пяти потребностей (повторный тап снимает)
 * или «Не пойму — дальше». Без потребности запись уходит без actualNeed. Свободного текста нет.
 */
export function CaseNeedStep({ needId, onPick, onBack, onNext, crisis, onHardNow }: {
  needId: string;
  onPick: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const tr = useTr();
  return (
    <CaseStepScreen
      onBack={onBack} compact
      eyebrow="Что случилось · 4 из 4"
      title="Чего не хватило?"
      lede={tr('Выбери одну: что в этот момент было нужно тебе больше всего.', 'Выберите одну: что в этот момент было нужно вам больше всего.')}
    >
      <div className="cq-needs" role="group" aria-label="Чего не хватило?">
        {NEED_ORDER.map((id) => (
          <button
            key={id} type="button" style={needDataStyle(id)}
            className={`cq-need${needId === id ? ' cq-need--on' : ''}`}
            aria-pressed={needId === id} onClick={() => onPick(id)}
          >
            {NEED_NAMES[id]}
          </button>
        ))}
      </div>
      <CaseFlowFoot primaryLabel="Дальше" primaryDisabled={!needId} onPrimary={onNext} crisis={crisis} onHardNow={onHardNow}>
        <TertiaryLink label="Не пойму — дальше" onClick={onNext} />
      </CaseFlowFoot>
    </CaseStepScreen>
  );
}
