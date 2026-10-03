import { joinTherapyErrorText } from '../../../shared/src/therapy/joinErrorText';

// Текст отказа экрана-согласия JoinConfirmSheet. Для терапевта 409
// already_connected — свой текст (клиент уже подключён к другому: ссылка в
// порядке, мешает действующее подключение), всё остальное — общий отказ.
export function joinConfirmFailText(
  err: unknown,
  isPair: boolean,
  tr: (ty: string, vy: string) => string,
): string {
  return (
    (!isPair && joinTherapyErrorText(err, tr)) ||
    tr(
      'Не получилось присоединиться. Проверь ссылку и попробуй ещё раз.',
      'Не получилось присоединиться. Проверьте ссылку и попробуйте ещё раз.',
    )
  );
}
