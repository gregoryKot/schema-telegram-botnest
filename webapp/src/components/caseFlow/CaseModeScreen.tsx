import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { haptic } from '../../haptic';
import { ModeFeelingBrowse } from '../diary/ModeFeelingBrowse';
import { ModeGroupList } from '../diary/ModeGroupList';
import { CaseFlowFoot } from './caseFlowUi';

/**
 * Шаг «кто взял управление» (gate+candidate миниаппа объединены в один
 * экран) — переиспользует уже существующий webapp-механизм выбора режима
 * (ModeFeelingBrowse + ModeGroupList, тот же, что в ModeSelectScreen.tsx
 * дневника режимов): правило «одна механика — один компонент» запрещает
 * заново реализовывать выбор режима вторым способом только потому, что это
 * другой поток. gateId для CaseFlowFoot/CASE_BODY_CHIPS выводится из
 * modeId (useCaseFlowState.pickMode → gateIdForMode) — отдельного тапа по
 * «воротам» здесь нет, в отличие от миниаппа.
 */
export function CaseModeScreen({
  onBack,
  onPick,
  onLater,
  crisis,
  onHardNow,
}: {
  onBack: () => void;
  onPick: (modeId: string) => void;
  onLater: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const tr = useTr();
  const [listOpen, setListOpen] = useState(false);

  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Разбор случая · Шаг 2 из 5"
      eyebrowColor="var(--accent-indigo)"
      title={
        <>
          Кто сейчас
          <br />
          <span className="it">взял управление?</span>
        </>
      }
      lede={tr(
        'Режим – состояние, которое сейчас «за рулём». Не знаешь названия – определим по чувству, в пару тапов.',
        'Режим – состояние, которое сейчас «за рулём». Не знаете названия – определим по чувству, в пару тапов.',
      )}
    >
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '0 0 10px' }}>
        {tr(
          'Что сейчас чувствуешь? Выбери самое близкое:',
          'Что сейчас чувствуете? Выберите самое близкое:',
        )}
      </div>
      <ModeFeelingBrowse onPick={onPick} />

      <button
        type="button"
        className="ex-btn ex-btn-ghost mode-list-toggle"
        onClick={() => {
          haptic.tap();
          setListOpen((v) => !v);
        }}
      >
        {listOpen ? 'Скрыть список' : 'Знаю режим – выбрать из списка'}
      </button>

      {listOpen && <ModeGroupList modeId="" onPick={onPick} />}

      <CaseFlowFoot onLater={onLater} crisis={crisis} onHardNow={onHardNow} />
    </ExScreen>
  );
}
