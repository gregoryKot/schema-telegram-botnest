import type { BetweenSessionsItem } from '../../../../../shared/src/schemaTherapy/guide';
import { catalogTaskId, customTaskText } from '../../../../../shared/src/tasks/catalog/taskCatalog';
import type { TaskType } from '../../taskCreate/taskOptions';
import type { AssignPreset } from '../assignTemplates';

/**
 * «Дать заданием» (#995): пункт «Между сессиями» → с чем открыть «Новое
 * задание» (TaskCreateSheet, тот же лист, что у «Назначить из шаблона»).
 * Упражнение из «Практик» — его тип; `satisfies` держит на сборке, что каждый
 * GuideTaskType — тип задания сайта. Упражнение без экрана — «Своё задание»:
 * текст собирает customTaskText, как у раздела «Из справочника». Режим в «Карточку режима» не
 * подставляется: лист назначения выбор режима снаружи не принимает.
 */
export function guideAssignPreset(item: BetweenSessionsItem): AssignPreset {
  if (item.kind === 'custom') {
    return { type: 'custom', text: customTaskText(item), catalogId: catalogTaskId(item.title) };
  }
  return { type: item.type satisfies TaskType };
}
