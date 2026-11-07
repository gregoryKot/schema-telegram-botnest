import { joinTherapyErrorText, joinTransportErrorText } from './joinErrorText';

// Текст отказа экрана-согласия JoinConfirmSheet (оба фронтенда, правило №3).
// Для терапевта 409 already_connected — свой текст (клиент уже подключён к
// другому: ссылка в порядке, мешает действующее подключение). Обрыв связи,
// лимит и авария сервера — о себе (QA 2026-11, З1: «проверь ссылку» при
// рабочей ссылке). Всё остальное — общий отказ.
export function joinConfirmFailText(
  err: unknown,
  isPair: boolean,
  tr: (ty: string, vy: string) => string,
): string {
  return (
    (!isPair && joinTherapyErrorText(err, tr)) ||
    joinTransportErrorText(err, tr) ||
    tr(
      'Не получилось присоединиться. Проверь ссылку и попробуй ещё раз.',
      'Не получилось присоединиться. Проверьте ссылку и попробуйте ещё раз.',
    )
  );
}
