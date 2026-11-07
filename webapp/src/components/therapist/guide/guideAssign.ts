import type { BetweenSessionsItem } from '../../../../../shared/src/schemaTherapy/guide';
import type { TaskType } from '../../taskCreate/taskOptions';
import type { AssignPreset } from '../assignTemplates';

/**
 * «Дать заданием» (#995): пункт «Между сессиями» → с чем открыть «Новое
 * задание» (TaskCreateSheet, тот же лист, что у «Назначить из шаблона»).
 * Упражнение из «Практик» — его тип; `satisfies` держит на сборке, что каждый
 * GuideTaskType — тип задания сайта. Упражнение без экрана — «Своё задание»:
 * название первой строкой, ниже инструкция. Режим в «Карточку режима» не
 * подставляется: лист назначения выбор режима снаружи не принимает.
 */
export function guideAssignPreset(item: BetweenSessionsItem): AssignPreset {
  if (item.kind === 'custom') {
    return { type: 'custom', text: `${item.title}\n${item.text}` };
  }
  return { type: item.type satisfies TaskType };
}
