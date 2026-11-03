// Прямой путь к плану с пустого экрана «Планов» (QA 2026-11, B-М8): раньше
// подпись обещала кнопку «Запланировать практику», которой нет, а настоящий
// путь шёл через трекер и ответ «Совсем нет». Строка потребности открывает
// тот же лист плана, что и трекер (PlanSheet).
import { useState } from 'react';
import { useNeedData } from '../../needData';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import { PlanSheet } from '../PlanSheet';

export function PlanNeedPicker({ onPlanned }: { onPlanned: () => void }) {
  const NEED_DATA = useNeedData();
  const [needId, setNeedId] = useState<string | null>(null);
  const picked = needId ? NEED_DATA[needId] : undefined;
  return (
    <>
      <div className="ds-card ds-card--flush" role="group" aria-label="Потребность для плана">
        {NEED_ORDER.filter(id => NEED_DATA[id]).map(id => (
          <div key={id} className="ds-list-row ds-list-row--nav ds-list-row--hover"
            style={hueStyle(NEED_HUE[id])} {...pressable(() => setNeedId(id))}>
            <span className="ds-list-body">
              <span className="ds-list-title"><span className="ds-dot tone-fill" /> {NEED_DATA[id].name}</span>
            </span>
            <span className="ds-chev" aria-hidden="true" />
          </div>
        ))}
      </div>
      {needId && picked && (
        <PlanSheet
          needId={needId}
          needLabel={picked.name}
          onClose={() => setNeedId(null)}
          onSaved={onPlanned}
        />
      )}
    </>
  );
}
