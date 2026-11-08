// Блок «Уведомления в приложении» для /stats (правило №8: событие, которого
// нет в отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую
// БД. Язык без терминов: «включили уведомления в приложении», «запретили в
// браузере», «перестали доходить» — не «пуш» и не «подписка».
import { plural } from './plural';

export interface PushMetrics {
  /** Сколько людей с уведомлениями в приложении прямо сейчас. */
  people: number;
  /** На скольких устройствах (браузерах) они включены. */
  devices: number;
  week: {
    /** Включили (люди). */
    enabled: number;
    /** Из них первое уведомление не дошло. */
    firstMissed: number;
    /** Выключили сами. */
    disabled: number;
    /** Выключились при выходе из аккаунта. */
    loggedOut: number;
    /** Запретили уведомления в браузере (люди). */
    denied: number;
    /** Перестали доходить: браузер отозвал разрешение, приложение удалено. */
    gone: number;
  };
}

// Родительный после «у»: у 1 человека, у 2 человек, у 5 человек.
const people = (n: number) =>
  `${n} ${plural(n, 'человека', 'человек', 'человек')}`;

const TITLE = '🔔 <b>Уведомления в приложении</b>';

/** Текстовый блок для /stats. Чистая функция. */
export function formatPushMetrics(m: PushMetrics): string {
  const w = m.week;
  const weekQuiet = Object.values(w).every((n) => n === 0);
  if (m.people === 0 && weekQuiet) {
    return `${TITLE}: пока никто не включал.`;
  }
  const lines = [TITLE];
  lines.push(
    m.people === 0
      ? 'Сейчас не включены ни у кого.'
      : `Включены сейчас у ${people(m.people)} (устройств: ${m.devices}).`,
  );
  if (weekQuiet) {
    lines.push('За неделю ничего не менялось.');
    return lines.join('\n');
  }
  const parts = [
    `включили ${w.enabled}` +
      (w.firstMissed > 0 ? ` (первое не дошло у ${w.firstMissed})` : ''),
    `выключили ${w.disabled + w.loggedOut}` +
      (w.loggedOut > 0
        ? ` (из них при выходе из аккаунта ${w.loggedOut})`
        : ''),
    `запретили в браузере ${w.denied}`,
    `перестали доходить ${w.gone}`,
  ];
  lines.push(`За неделю: ${parts.join(' · ')}.`);
  return lines.join('\n');
}
