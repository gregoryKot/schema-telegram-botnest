// «Запланировано» (b20) — лист «готово» плана (DoneSheet: шалфей 135, Sprout с Check из ENTITY_LOOK.plan) вместо
// бледной неактивной кнопки «✓ Запланировано», где успех не читался. Над заголовком — потребность, под ним — когда
// напомнить, ниже — сам шаг белым листом. Лист держится, пока не сработает таймер сохранения (1,2 с,
// usePlanSheetState) или пока человек не нажмёт «Готово» — закрытие одно (PlanSheet.finish).
import type { usePlanSheetState } from '../../../../shared/src/practices/usePlanSheetState';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import { DoneSheet } from '../paper/DoneSheet';
import { planWhen } from './planDoneModel';

type PlanState = ReturnType<typeof usePlanSheetState>;

export function PlanDone({ s, needLabel, onDone }: { s: PlanState; needLabel: string; onDone: () => void }) {
  return (
    <DoneSheet entity="plan" label={needLabel} title="Запланировано" sub={planWhen(s.reminderIdx)}
      primary={{ label: 'Готово', onClick: onDone }}>
      <p className="sk-done-step">{glueSpaces(s.selectedText)}</p>
    </DoneSheet>
  );
}
