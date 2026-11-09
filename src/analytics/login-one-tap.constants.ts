// Исходы входа через окно Google One Tap (meta.outcome события login_one_tap).
// Событие пишет только сервер (src/auth/google-one-tap.service.ts) с
// userId = null; блок /stats — src/bot/one-tap-metrics.format.ts.
//
// Одно имя с исходом внутри, а не три имени: счёт — один запрос, в allow-list
// и санитайзере — одна запись (приём login_ticket_step).
export const ONE_TAP_OUTCOMES = [
  /** Сессия выдана — человек вошёл одним касанием. */
  'signed_in',
  /** У аккаунта второй фактор: окно сработало, дальше — экран кода. */
  'twofa',
  /** Сервер не принял токен окна: подделка, просрочка, чужой client id, нет nonce. */
  'rejected',
] as const;
export type OneTapOutcome = (typeof ONE_TAP_OUTCOMES)[number];
