// Нулевые счётчики «Моего пути» — общая фикстура тестов обоих фронтендов
// (правило №11: один и тот же литерал из 18 полей жил в трёх тестах и рос
// с каждым новым счётчиком; jscpd считал его дублем). Держим рядом с
// JourneyCounts, чтобы новое поле нельзя было забыть: тип обязывает.
import type { JourneyCounts } from './journeyMeta';

export const EMPTY_JOURNEY_COUNTS: JourneyCounts = {
  trackerDays: 0,
  notes: 0,
  schemaDiary: 0,
  modeDiary: 0,
  gratitudeDays: 0,
  practices: 0,
  plansDone: 0,
  ysqTests: 0,
  childhoodDone: false,
  beliefChecks: 0,
  letters: 0,
  flashcards: 0,
  safePlace: false,
  schemaNotes: 0,
  modeNotes: 0,
  breathingSessions: 0,
  groundingSessions: 0,
  stopSessions: 0,
};
