// Отправка итога теста на схемы (useYsqTest): первая попытка и повтор после
// сбоя — одна функция. Вынесено из хука, чтобы он не рос (правило №10).
import { notifyTasksChanged } from '../tasks/tasksChanged';
import { notifyYsqResultChanged } from './ysqProgressStore';
import type { YsqApi } from './ysqTest.types';

export function submitYsqResult(
  api: Pick<YsqApi, 'saveYsqResult' | 'deleteYsqProgress'>,
  answers: number[],
  setSaveError: (failed: boolean) => void,
  onSaved?: () => unknown,
): void {
  api
    .saveYsqResult(answers)
    .then(() => {
      setSaveError(false);
      // Сервер закрыл задание терапевта «пройти тест» в той же транзакции —
      // списки заданий перечитываются (tasks/tasksChanged.ts, QA 2026-11, К1).
      notifyTasksChanged();
      onSaved?.();
      // Итог на сервере — прогресс там больше не нужен. Экраны под тестом
      // («Мои паттерны») узнают об итоге, когда прогресса уже нет (B-З5).
      void api
        .deleteYsqProgress()
        .catch((e) => console.error('deleteYsqProgress failed', e))
        .finally(notifyYsqResultChanged);
    })
    .catch(() => setSaveError(true));
}
