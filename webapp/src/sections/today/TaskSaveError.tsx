// Отказ действия с заданием (useTaskActions.taskError: «Готово» или перечитывание после новой цели) — один сбой на все
// экраны заданий: блок «От терапевта» в «Практиках» и общий список (AllTasksOverlay). Наклейка сбоя PaperAlert со
// знаком заданий, как сбой на итоге «Мне плохо» (принцип 8 APP_2026-11.md: пусто ≠ сбой ≠ загрузка); до ревью g4 r5 —
// голая красная строка. Слова прежние: первая фраза — заголовок, просьба проверить соединение — тише.
import { PaperAlert } from '../../components/paper/PaperAlert';
import { useTr } from '../../utils/addressForm';

export function TaskSaveError({ className }: { className?: string }) {
  const tr = useTr();
  return (
    <PaperAlert sign="check" className={className} title="Не удалось сохранить изменение задания."
      text={tr('Проверь соединение и попробуй ещё раз', 'Проверьте соединение и попробуйте ещё раз')} />
  );
}
