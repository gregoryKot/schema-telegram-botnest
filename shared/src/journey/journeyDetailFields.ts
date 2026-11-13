// Полные поля для ДЕТАЛЬНОГО просмотра записи «Моего пути» (тап → открыть,
// читать всё целиком). В отличие от карточки — все поля и без обрезки.
// Несуществующие поля молча пропускаются, поэтому список можно держать щедрым.
// Спец-типы (gratitude/tracker_day/ysq) обрабатываются отдельно в journeyContent.
// 'healthy' — голос Здорового Взрослого: деталь рисует его вставкой мха (как entryRows.ts «Записей»).
export type DetailField = [key: string, title: string, mark?: 'healthy'];

export const DETAIL_FIELDS: Record<string, DetailField[]> = {
  schema_diary: [
    ['trigger', 'Ситуация'],
    ['thoughts', 'Мысли'],
    ['bodyFeelings', 'Тело'],
    ['actualBehavior', 'Поведение'],
    ['schemaOrigin', 'Происхождение'],
    ['healthyView', 'Здоровый взгляд', 'healthy'],
    ['realProblems', 'Реальные проблемы'],
    ['excessiveReactions', 'Чрезмерные реакции'],
    ['healthyBehavior', 'Здоровое поведение'],
  ],
  mode_diary: [
    ['situation', 'Ситуация'],
    ['thoughts', 'Мысли'],
    ['feelings', 'Чувства'],
    ['bodyFeelings', 'Тело'],
    ['actions', 'Действия'],
    ['actualNeed', 'Что было нужно'],
    ['childhoodMemories', 'Воспоминания'],
    ['healthyResponse', 'Здоровый Взрослый', 'healthy'],
  ],
  belief_check: [
    ['belief', 'Убеждение'],
    ['evidence', 'За и против'],
    ['reframe', 'Здоровый взгляд', 'healthy'],
  ],
  flashcard: [
    ['reflection', 'Напоминание себе'],
    ['action', 'Что делать'],
  ],
  schema_note: [
    ['triggers', 'Триггеры'],
    ['feelings', 'Чувства'],
    ['thoughts', 'Мысли'],
    ['origins', 'Происхождение'],
    ['reality', 'Реальность'],
    ['healthyView', 'Здоровый взгляд', 'healthy'],
    ['behavior', 'Что помогает'],
  ],
  mode_note: [
    ['triggers', 'Триггеры'],
    ['feelings', 'Чувства'],
    ['thoughts', 'Мысли'],
    ['needs', 'Что мне нужно'],
    ['behavior', 'Что помогает'],
  ],
  letter: [['text', '']],
  safe_place: [['description', '']],
  note: [['text', '']],
  practice: [['text', 'Что меня питает']],
  plan_done: [['practiceText', 'Действие']],
};
