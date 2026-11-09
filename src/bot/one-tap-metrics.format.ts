// Строка «Окно Google „Продолжить как…“» для /stats — продолжение блока «Вход по
// коду» (тот же раздел отчёта, LoginTicketMetricsService.render). Правило №8:
// окно включено #863, а входы через него нигде не считались — ни пользы, ни
// того, что оно молча сломалось (скрипт Google заблокирован, origin снят в
// Google Cloud Console), видно не было. Чистый форматтер, тест — включая
// пустую БД.
//
// Чего здесь НЕТ: показов окна. Их видит только браузер, а событие пишет
// сервер. Перестало показываться — видно по тому, что входов стало ноль.
//
// Язык простой: «вошли одним касанием», а не «One Tap conversions».

export interface OneTapMetrics {
  /** Сессия выдана. */
  signedIn: number;
  /** Окно сработало, дальше — код второго фактора. */
  twofa: number;
  /** Сервер не принял токен из окна. */
  rejected: number;
}

const TITLE = '🔑 <b>Окно Google «Продолжить как…»</b> (за неделю)';

/** Текстовый блок для /stats. Чистая функция. */
export function formatOneTap(m: OneTapMetrics): string {
  const lines = [TITLE];
  if (m.signedIn + m.twofa + m.rejected === 0) {
    lines.push('За неделю через окно не входили.');
    return lines.join('\n');
  }
  if (m.signedIn + m.twofa === 0) {
    lines.push(
      `Сервер не принял вход из окна: ${m.rejected} — и ни одного входа. ` +
        'Похоже, у сайта и сервера разный ключ приложения Google ' +
        '(VITE_GOOGLE_CLIENT_ID и GOOGLE_CLIENT_ID).',
    );
    return lines.join('\n');
  }
  lines.push(`Вошли одним касанием: ${m.signedIn}`);
  if (m.twofa > 0) lines.push(`Дошли до кода второго шага: ${m.twofa}`);
  if (m.rejected > 0)
    lines.push(`Сервер не принял вход из окна: ${m.rejected}`);
  return lines.join('\n');
}
