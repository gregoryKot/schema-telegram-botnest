// Блок «Мост к терапевту» для /stats (правило №8): сколько раз показали строки
// «это самопомощь, не замена терапии», как часто открывают лист, переходят к
// записи и доходят до заявки. Чистый форматтер, покрыт тестом, включая нули.
// Язык простой: «показали строку», «открыли лист», «перешли к записи» —
// без терминов. Безличный: отчёт админский, без обращения.

export interface TherapyNudgeMetrics {
  /** Показы по местам (action=shown), в порядке THERAPY_NUDGE_PLACES. */
  shownByPlace: Array<{ place: string; count: number }>;
  /** Показы карточки по сигналу в разрезе причины, в порядке THERAPY_NUDGE_TRIGGERS. */
  signalByTrigger: Array<{ trigger: string; count: number }>;
  /** Открыли лист «Поговорить с кем-то». */
  open: number;
  /** Перешли к записи. */
  book: number;
  /** Нажали «написать». */
  write: number;
  /** Нажали «не сейчас». */
  dismiss: number;
  /** Заявок с формы знакомства, пришедших из приложения. */
  introFromApp: number;
}

// Подписи мест словами, без id. Порядок — как в реестре.
const PLACE_LABELS: Record<string, string> = {
  home: 'на главной',
  tracker_done: 'после трекера',
  case_done: 'после разбора случая',
  diary_done: 'после дневника',
  more: 'в «Ещё»',
  why: 'в «Зачем это»',
};

const TRIGGER_LABELS: Record<string, string> = {
  low_index: 'низкий индекс',
  repeat_mode: 'режим повторяется',
  crisis: 'кризис',
  none: 'без причины',
};

function nonZero(
  rows: Array<{ key: string; count: number }>,
  labels: Record<string, string>,
): string[] {
  const counts = new Map(rows.map((r) => [r.key, r.count]));
  return Object.keys(labels)
    .map((key) => [labels[key], counts.get(key) ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`);
}

export function formatTherapyNudge(m: TherapyNudgeMetrics): string {
  const title = '🌉 <b>Мост к терапевту</b> (за 30 дней)';
  const places = nonZero(
    m.shownByPlace.map((r) => ({ key: r.place, count: r.count })),
    PLACE_LABELS,
  );
  const signalShown =
    m.shownByPlace.find((r) => r.place === 'signal_card')?.count ?? 0;
  const triggers = nonZero(
    m.signalByTrigger.map((r) => ({ key: r.trigger, count: r.count })),
    TRIGGER_LABELS,
  );
  const actions = [
    m.open > 0 ? `открыли лист ${m.open}` : null,
    m.book > 0 ? `перешли к записи ${m.book}` : null,
    m.write > 0 ? `нажали «написать» ${m.write}` : null,
    m.dismiss > 0 ? `нажали «не сейчас» ${m.dismiss}` : null,
  ].filter((s): s is string => s !== null);

  const lines: string[] = [];
  if (places.length > 0) lines.push(`Показали строку: ${places.join(', ')}.`);
  if (signalShown > 0) {
    const why = triggers.length > 0 ? ` (${triggers.join(', ')})` : '';
    lines.push(`Показали карточку по сигналу: ${signalShown}${why}.`);
  }
  if (actions.length > 0) lines.push(`${capitalize(actions.join(', '))}.`);
  if (m.introFromApp > 0) {
    lines.push(`Заявок с формы знакомства из приложения: ${m.introFromApp}.`);
  }
  if (lines.length === 0) lines.push('Пока ничего.');
  return [title, ...lines].join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
