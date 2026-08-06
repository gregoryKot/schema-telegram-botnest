// Человеческие названия таблиц для экранов переноса данных. Один список на
// оба экрана (подтверждение merge и подтверждение привязки из мессенджера) —
// иначе второй экран тихо покажет сырые «UserSchemaNote».
export const TABLE_LABELS: Record<string, string> = {
  Rating: 'оценки потребностей',
  YsqProgress: 'прогресс теста на схемы',
  YsqResult: 'результат теста на схемы',
  YsqResultHistory: 'история тестов',
  Note: 'заметки',
  UserSchemaNote: 'заметки по схемам',
  UserModeNote: 'заметки по режимам',
  UserBeliefCheck: 'проверки убеждений',
  UserLetter: 'письма себе',
  UserSafePlace: 'безопасное место',
  UserFlashcard: 'флэшкарты',
  UserPractice: 'практики',
  PracticePlan: 'планы практик',
  PracticeSession: 'занятия практиками',
  ChildhoodRating: 'колесо детства',
  ScheduledNotification: 'уведомления',
  SchemaDiaryEntry: 'дневник схем',
  ModeDiaryEntry: 'дневник режимов',
  GratitudeDiaryEntry: 'дневник благодарности',
  AppActivity: 'активность',
  UserTask: 'задания',
  DiaryDraft: 'черновики',
  TherapyRelation: 'связи терапевт↔клиент',
  Pair: 'пары',
};

/** Название для строки сводки. Незнакомая таблица показывается как есть. */
export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

/** Сколько всего записей переедет — для строки «перенесётся N записей». */
export function totalItems(summary: Record<string, number>): number {
  return Object.values(summary).reduce((sum, n) => sum + n, 0);
}
