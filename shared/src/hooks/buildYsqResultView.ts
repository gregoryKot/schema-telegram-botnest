import {
  SCHEMAS,
  DOMAIN_ORDER,
  NEED_LABELS,
  SCHEMA_NAME_TO_ID,
} from './ysqSchemas';
import { isSchemaScoreActive, type YsqHistoryEntry } from './ysqScoring';
import type { ResultView } from './ysqTest.types';

type Scores = ReturnType<typeof import('./ysqScoring').computeScores>;

// Сборка результата теста для UI: сортировка схем по выраженности, разбивка
// активных по доменам, подпись даты и дельта к прошлому прохождению.
// Чистая функция — вынесена из useYsqTest.ts (правило №10), хук зовёт её
// внутри useMemo.
export function buildYsqResultView(
  scores: Scores | null,
  history: YsqHistoryEntry[],
  completedAt: string | null,
): ResultView | null {
  if (!scores) return null;
  const sortedSchemas = [...SCHEMAS].sort(
    (a, b) =>
      scores[b.name].pct5plus - scores[a.name].pct5plus ||
      scores[b.name].avg - scores[a.name].avg,
  );
  const activeSchemas = sortedSchemas.filter((s) =>
    isSchemaScoreActive(scores[s.name]),
  );
  const inactiveSchemas = sortedSchemas.filter(
    (s) => !isSchemaScoreActive(scores[s.name]),
  );

  const activeByDomain = DOMAIN_ORDER.map((needId) => ({
    needId,
    label: NEED_LABELS[needId],
    schemas: activeSchemas.filter((s) => s.needId === needId),
  })).filter((d) => d.schemas.length > 0);

  const dateLabel = completedAt
    ? new Date(completedAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const activeCount = activeSchemas.length;
  const activeLabel =
    activeCount === 0
      ? 'Активных схем не найдено'
      : `${activeCount}\u00A0${activeCount === 1 ? 'выраженная схема' : activeCount < 5 ? 'выраженные схемы' : 'выраженных схем'}`;

  // Дельта со прошлого прохождения — в единицах среднего балла (главная
  // метрика карточки), напр. «+0.4». Старые записи истории могли не хранить
  // avg — тогда дельту не показываем (null), а не смешиваем с pct5plus.
  const prevEntry = history.length >= 2 ? history[1] : null;
  const getSchemaDelta = (schemaName: string): number | null => {
    if (!prevEntry) return null;
    const id = SCHEMA_NAME_TO_ID[schemaName];
    if (!id) return null;
    const prev = prevEntry.scores.find((s) => s.id === id);
    if (prev == null || prev.avg == null) return null;
    return Math.round(((scores[schemaName]?.avg ?? 0) - prev.avg) * 10) / 10;
  };

  return {
    activeSchemas,
    inactiveSchemas,
    activeByDomain,
    dateLabel,
    activeCount,
    activeLabel,
    getSchemaDelta,
  };
}
