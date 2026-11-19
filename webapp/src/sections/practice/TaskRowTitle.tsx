// Название строки задания (TaskRow). Задание из справочника (catalogId) клиент видит тремя частями: название,
// «что делать» и «зачем» (shared/tasks/catalog/taskWhy); «когда давать» остаётся терапевту. Без catalogId — одно название.
import type { UserTask } from '../../api';
import { useTr } from '../../utils/addressForm';
import { catalogTaskParts, taskWhy } from '../../../../shared/src/tasks/catalog/taskWhy';
import { taskTitleText } from './taskTitleText';
import { glueSpaces } from '../../../../shared/src/utils/typo';

export function TaskRowTitle({ task }: { task: UserTask }) {
  const tr = useTr();
  const why = taskWhy(task.catalogId, tr);
  if (!why) return <div className="cp-task-title">{glueSpaces(taskTitleText(task, tr))}</div>;
  const { what } = catalogTaskParts(task.text);
  return (
    <>
      <div className="cp-task-title">{glueSpaces(taskTitleText(task, tr))}</div>
      {what && <p className="cp-task-part">{glueSpaces(what)}</p>}
      <p className="cp-task-part"><span className="cp-task-part-label">Зачем</span>{glueSpaces(why)}</p>
    </>
  );
}
