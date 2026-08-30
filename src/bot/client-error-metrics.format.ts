// Блок «Поломки на клиенте» для /stats (правило №8: метрика, которой нет в
// отчёте, — невидима). Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Волна 9 щита покрытия (docs/SHIELD_PROMPT.md): раньше отчёт клиента о
// своей поломке (POST /api/client-errors) только логировался — а разные
// поломки схлопывались в один DM (AlertLogger троттлит по НОРМАЛИЗОВАННОМУ
// тексту первого аргумента, а он у нас постоянен по замыслу, см. хедер
// client-errors.controller.ts). Теперь каждый отчёт ещё и считается
// (событие client_error), и число видно здесь.
//
// Раздел auth — отдельная явная строка, а не просто пункт списка по разделам:
// это единственный клиентский свидетель для «вход сломан ДО того, как запрос
// вообще дошёл до guard'а» (инцидент 2026-08-08, см. блок «Вход в
// мессенджере» — auth-health-metrics.format.ts). Если этот блок молчит про
// рост auth-поломок, авария снова спрячется среди остального списка.
export interface ClientErrorMetrics {
  totalDay: number;
  totalWeek: number;
  authDay: number;
  authWeek: number;
  bySection: {
    login: number;
    today: number;
    diary: number;
    schemas: number;
    practice: number;
    profile: number;
    help: number;
    cabinet: number;
    other: number;
  };
  bySource: { webapp: number; miniapp: number };
}

const SECTION_LABELS: Record<keyof ClientErrorMetrics['bySection'], string> = {
  login: 'Вход по коду',
  today: 'Сегодня',
  diary: 'Дневник',
  schemas: 'Паттерны',
  practice: 'Практики',
  profile: 'Профиль',
  help: 'Помощь',
  cabinet: 'Кабинет',
  other: 'другое',
};

/** Текстовый блок для /stats. Чистая функция. */
export function formatClientErrorMetrics(m: ClientErrorMetrics): string {
  const lines = ['🧯 <b>Поломки на клиенте</b>'];

  // Пусто — не «всё хорошо», а «отчётов ещё не было» (чистая БД, первый
  // день после установки блока).
  if (m.totalWeek === 0) {
    lines.push('За неделю приложение ни разу не сообщило о своей поломке.');
    return lines.join('\n');
  }

  lines.push(
    `Приложение сообщило о поломке: ${m.totalDay} раз за сутки, ` +
      `${m.totalWeek} за неделю.`,
  );

  // Вход — всегда отдельной строкой, даже при нуле: иначе он теряется среди
  // остальных разделов ровно тогда, когда это важнее всего заметить.
  lines.push(
    m.authWeek > 0
      ? `Вход не срабатывал на телефоне у пользователя: ${m.authDay} раз ` +
          `за сутки, ${m.authWeek} за неделю — это значит, что вход ` +
          'сломан на стороне приложения, а не у конкретного человека.'
      : 'Вход ни разу не ломался на стороне приложения.',
  );

  const bySection = (
    Object.keys(SECTION_LABELS) as Array<keyof ClientErrorMetrics['bySection']>
  )
    .map((key) => ({ label: SECTION_LABELS[key], week: m.bySection[key] }))
    .filter((row) => row.week > 0)
    .sort((a, b) => b.week - a.week);
  if (bySection.length > 0) {
    lines.push(
      'По разделам: ' +
        bySection.map((row) => `${row.label} — ${row.week}`).join(', ') +
        '.',
    );
  }

  const sourceParts: string[] = [];
  if (m.bySource.webapp > 0) sourceParts.push(`сайт — ${m.bySource.webapp}`);
  if (m.bySource.miniapp > 0) {
    sourceParts.push(`приложение в мессенджере — ${m.bySource.miniapp}`);
  }
  if (sourceParts.length > 0) {
    lines.push(`Откуда: ${sourceParts.join(', ')}.`);
  }

  return lines.join('\n');
}
