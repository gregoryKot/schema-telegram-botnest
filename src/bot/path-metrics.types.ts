export interface PathMetrics {
  created30: number; // блок /stats «Путь клиента», всё за месяц: путей собрано
  phasesStarted30: number; // фаз начато
  phasesFinished30: number; // фаз завершено
  sessionsMarked30: number; // записей итогов сессии с отмеченными пунктами плана
  shifted30: number; // раз сдвигали сроки
  drafts30: number; // черновиков пути собрано
}
