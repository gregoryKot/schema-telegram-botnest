// Прогрев ДАННЫХ чужих вкладок в простое — аналог preloadSections.ts (тот
// греет КОД секции чанком React.lazy), здесь греются GET-запросы, которые
// каждая вкладка сама шлёт при монтировании. Кеш (shared/src/api/apiCache.ts,
// fresh=15с/stale=2мин) успевает нагреться к моменту переключения — первый
// заход на «Паттерны»/«Помощь»/«Я» больше не ждёт эти запросы по сети
// (баг: скелетон на несколько секунд на LTE, разбор 2026-08-23).
//
// Вызовы сверены по коду секций (не приняты на веру, 2026-08-23):
//   Паттерны — useMySelections/usePatternStatus: getProfile, getSchemaDiary,
//     getModeDiary, getSchemaNotes. getYsqProgress НЕ входит — App.tsx уже
//     зовёт его на старте (Promise.all с getYsqResult).
//   Помощь — HelpSection: getTasks, getTaskHistory, getPracticeSessions.
//   Я — useProfileStats/useAboutMe: getStreak, getAchievements, getInsights,
//     getYsqHistory, getModeNotes, getPhraseChecks. history(112) НЕ греем —
//     самый тяжёлый, осознанно ленивый (HeatmapCard, по вьюпорту).
//   Списки сверены с водопадом реального прогона (замер 2026-08-23):
//     после старта «Сегодня» вкладкам не хватало ровно schema-notes,
//     practice-sessions+tasks/history и семи запросов «Я».
import type { Section } from '../components/BottomNav';
import { api } from '../api';
import { onIdle } from './preloadSections';

type Warmer = () => Promise<unknown>;

const SECTION_DATA_WARMERS: Partial<Record<Section, Warmer[]>> = {
  schemas: [
    () => api.getProfile(),
    () => api.getSchemaDiary(),
    () => api.getModeDiary(),
    () => api.getSchemaNotes(),
  ],
  help: [
    () => api.getTasks(),
    () => api.getTaskHistory(),
    () => api.getPracticeSessions(),
  ],
  profile: [
    () => api.getStreak(),
    () => api.getAchievements(),
    () => api.getInsights(),
    () => api.getYsqHistory(),
    () => api.getModeNotes(),
    () => api.getPhraseChecks(),
  ],
};

const ALL_SECTIONS: Section[] = ['today', 'schemas', 'help', 'profile'];

// Счётчик практик для бейджа «Помощи» (ToolsList) — раньше уходил в сеть
// синхронно на старте наравне с needs/ratings первого экрана (разбор залпа
// 2026-08-23: ~11 параллельных запросов холодного старта конкурировали за
// LTE), хотя нужен только бейджу, не первому рендеру «Сегодня». Не привязан
// к конкретной вкладке — HelpSection получает его пропом и сам
// api.getPractices не зовёт, поэтому греется последним шагом всегда, а не
// только когда «Помощь» не текущая (иначе холодный старт на «Помощи» никогда
// бы его не получил — а раньше он приезжал всегда, независимо от вкладки).
const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

function fetchHelpPracticeCount(): Promise<number> {
  return Promise.all(NEED_IDS.map((id) => api.getPractices(id))).then((r) =>
    r.reduce((sum, arr) => sum + arr.length, 0),
  );
}

/**
 * Планирует прогрев данных всех вкладок, кроме текущей — по одной в простое
 * (образец организации, preloadSections.ts), и последним шагом цепочки —
 * счётчик практик «Помощи» (см. выше). Не запускается офлайн: сети всё равно
 * нет, план бесполезен, а `getPractices` в оффлайне и раньше не показывал
 * реальных данных (не «0», а неизвестность — см. `practiceCount == null` в
 * toolRows.ts).
 *
 * Возвращает запланированные секции — прод-код результат не читает, это
 * только для теста (план построен верно, не дожидаясь реальных idle-колбэков).
 */
export function prefetchOtherSectionsData(
  current: Section,
  onHelpPracticeCount: (count: number) => void,
): Section[] {
  if (!navigator.onLine) return [];
  const rest = ALL_SECTIONS.filter((s) => s !== current);
  function loadNext(index: number): void {
    if (index >= rest.length) {
      onIdle(() => {
        fetchHelpPracticeCount()
          .then(onHelpPracticeCount)
          .catch(() => onHelpPracticeCount(0));
      });
      return;
    }
    const warmers = SECTION_DATA_WARMERS[rest[index]];
    if (!warmers) {
      // У «Сегодня» нет отдельного прогрева: её данные (needs/ratings) и так
      // грузятся сразу на старте, независимо от того, какая вкладка текущая.
      loadNext(index + 1);
      return;
    }
    onIdle(() => {
      // Promise.allSettled никогда не реджектится — отдельный неудавшийся
      // эндпоинт (например, офлайн наступил посреди цепочки) просто не
      // попадёт в кеш; секция догрузит его сама обычным путём при реальном
      // переключении вкладки. Явный .catch() здесь не нужен и не появится.
      void Promise.allSettled(warmers.map((warm) => warm())).finally(() =>
        loadNext(index + 1),
      );
    });
  }
  loadNext(0);
  return rest;
}
