// Блок «Кнопка «плюс»» для /stats (правило №8: событие, которого нет в
// отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую БД.
// Язык — простой: «открывали меню», а не «plus_open events».

export interface PlusMetrics {
  /** За месяц: сколько раз открыли меню «плюс». */
  opens30: number;
  /** За месяц: у скольких разных людей это было. */
  users30: number;
  /** Какие действия выбирают чаще всего (meta.action), по убыванию. */
  actions30: Array<{ action: string; count: number }>;
  /** Что прячут из меню (quick_action_toggle, hidden=true), по убыванию. */
  hidden30: Array<{ action: string; count: number }>;
  /** За месяц: сколько раз меняли порядок пунктов (quick_action_move). */
  moves30: number;
}

// Человеческие подписи пунктов меню — в отчёте не должно быть внутренних id.
// Сверка с реестром — в спеке форматтера (новый пункт без подписи вылезет
// в отчёт голым ключом).
export const QUICK_ACTION_LABELS: Record<string, string> = {
  tracker: 'Трекер потребностей',
  diary_schema: 'Дневник схем',
  diary_mode: 'Дневник режимов',
  diary_gratitude: 'Благодарность',
  breathing: 'Дыхание 4-4-6',
  grounding: 'Заземление 5-4-3-2-1',
  stop: 'Техника «Стоп»',
  belief_check: 'Проверка убеждений',
  phrase_check: 'Критик или забота?',
  flashcard: 'Схема включилась',
  safe_place: 'Безопасное место',
  letter_to_self: 'Письмо себе',
  warm_words: 'Тёплые слова',
  childhood_wheel: 'Колесо детства',
  tasks: 'Мои цели',
  practices: 'Практики',
  plans: 'Планы',
};

const label = (action: string): string => QUICK_ACTION_LABELS[action] ?? action;

const listByLabel = (rows: Array<{ action: string; count: number }>): string =>
  rows.map((r) => `${label(r.action)} — ${r.count}`).join(' · ');

/** Текстовый блок для /stats. Чистая функция. */
export function formatPlusMetrics(m: PlusMetrics): string {
  if (m.opens30 === 0 && m.moves30 === 0) {
    return '➕ <b>Кнопка «плюс»</b>: за 30 дней ещё не открывали.';
  }
  const lines = [`➕ <b>Кнопка «плюс»</b> (за месяц)`];
  if (m.opens30 > 0) {
    lines.push(`Открывали: ${m.opens30} раз (${m.users30} человек)`);
  }
  if (m.actions30.length > 0) {
    lines.push(`Чаще всего выбирают: ${listByLabel(m.actions30)}`);
  }
  if (m.hidden30.length > 0) {
    lines.push(`Убирают из меню: ${listByLabel(m.hidden30)}`);
  }
  if (m.moves30 > 0) {
    lines.push(`Меняли порядок пунктов: ${m.moves30} раз`);
  }
  return lines.join('\n');
}
