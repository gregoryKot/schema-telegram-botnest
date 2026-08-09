// Блок «Вход в мессенджере» для /stats (правило №8: метрика, которой нет в
// отчёте, — невидима). Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Зачем блок вообще есть. 2026-08-08 вход был сломан у ВСЕХ пользователей
// Telegram, и узнали об этом от человека, который написал в личку. На сервере
// авария выглядела как обычные 401: их никто не считал. Теперь «мини-апп
// открыт, а подписи нет» — отдельная строка отчёта.
//
// Язык простой: «приложение не смогло войти», а не «empty_signature events».

export interface AuthHealthMetrics {
  /** За сутки: сколько раз мини-апп пришёл без подписи (по площадкам). */
  day: { telegram: number; max: number };
  /** За неделю — то же, чтобы видеть, разовый это сбой или тянется. */
  week: { telegram: number; max: number };
}

const HOSTS = [
  ['telegram', 'Telegram'],
  ['max', 'MAX'],
] as const;

/** Текстовый блок для /stats. Чистая функция. */
export function formatAuthHealth(m: AuthHealthMetrics): string {
  const lines = ['🔑 <b>Вход в мессенджере</b>'];
  const weekTotal = m.week.telegram + m.week.max;

  if (weekTotal === 0) {
    lines.push('За неделю все входы прошли нормально.');
    return lines.join('\n');
  }

  lines.push(
    'Приложение открывали в мессенджере, но пропуска у него не было — ' +
      'значит сломан сам вход, а не пользователь:',
  );
  for (const [key, title] of HOSTS) {
    const day = m.day[key];
    const week = m.week[key];
    if (week === 0) continue;
    lines.push(`${title}: за сутки ${day}, за неделю ${week}`);
  }
  if (m.day.telegram + m.day.max > 0) {
    lines.push(
      'Это происходит прямо сейчас — открой приложение и проверь вход.',
    );
  } else {
    lines.push('За последние сутки такого не было — похоже, уже починено.');
  }
  return lines.join('\n');
}
