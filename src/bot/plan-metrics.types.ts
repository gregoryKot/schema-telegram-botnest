export interface PlanMetrics {
  added30: number; // блок /stats «План работы с клиентом», всё за месяц: добавлено пунктов
  fromGuide30: number; // из них взято из статьи справочника (остальные — свои)
  therapists30: number; // сколько разных терапевтов добавляло пункты
  active30: number; // раз пункт отмечали «в работе»
  done30: number; // раз пункт отмечали «сделано»
}
