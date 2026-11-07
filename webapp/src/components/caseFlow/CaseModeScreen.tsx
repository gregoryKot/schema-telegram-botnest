import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { haptic } from '../../haptic';
import { ModeFeelingBrowse } from '../diary/ModeFeelingBrowse';
import { ModeGroupList } from '../diary/ModeGroupList';
import { CaseFlowFoot } from './caseFlowUi';

/**
 * «Не похоже — другие режимы»: выбор режима руками вместо предложенного.
 * Переиспользует существующий webapp-механизм (ModeFeelingBrowse +
 * ModeGroupList, тот же, что в ModeSelectScreen.tsx дневника режимов):
 * правило «одна механика — один компонент». Выбранный режим возвращается на
 * итог разбора.
 */
export function CaseModeScreen({
  onBack,
  onPick,
  crisis,
  onHardNow,
}: {
  onBack: () => void;
  onPick: (modeId: string) => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const tr = useTr();
  const [listOpen, setListOpen] = useState(false);

  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад"
      eyebrow="Что случилось"
      title="Другие режимы"
      lede={tr(
        'Режим – состояние, которое сейчас «за рулём». Не знаешь названия – определим по чувству, в пару тапов.',
        'Режим – состояние, которое сейчас «за рулём». Не знаете названия – определим по чувству, в пару тапов.',
      )}
    >
      <div className="ex2-fine">
        {tr(
          'Что сейчас чувствуешь? Выбери самое близкое:',
          'Что сейчас чувствуете? Выберите самое близкое:',
        )}
      </div>
      <ModeFeelingBrowse onPick={onPick} />

      <button
        type="button"
        className="ds-btn ex2-ghost ex2-gap"
        onClick={() => {
          haptic.tap();
          setListOpen((v) => !v);
        }}
      >
        {listOpen ? 'Скрыть список' : 'Знаю режим – выбрать из списка'}
      </button>

      {listOpen && <ModeGroupList modeId="" onPick={onPick} />}

      <CaseFlowFoot crisis={crisis} onHardNow={onHardNow} />
    </ExScreen>
  );
}
