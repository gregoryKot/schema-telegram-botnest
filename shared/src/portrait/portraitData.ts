// Чистый слой данных карточки «Мой портрет» (вкладка профиля мини-аппа).
// Общий для обоих фронтендов (правило №3 CLAUDE.md) — UI-потребитель
// добавляется отдельным PR сразу после этого файла.
//
// Активные схемы уже вычислены на бэкенде (GET /api/profile →
// ysq.activeSchemaIds, см. src/bot/profile.service.ts +
// computeActiveSchemas в src/utils/ysq.ts — тот же критерий активности,
// что и isSchemaScoreActive здесь) — этот слой их НЕ пересчитывает из
// сырых ответов, только объединяет с ручным выбором (User.mySchemaIds)
// и группирует по пяти базовым потребностям, а не по клиническим доменам
// схема-терапии (владелец продукта не узнал термины «Отвержение»,
// «Бдительность» и т.п. в собственном приложении — потребности уже везде
// в UI: трекер, колесо потребностей). Источники объединяются через Set,
// чтобы одна и та же схема не считалась дважды.
import { NEED_ORDER, type NeedId } from '../needs/types';
import { needColor } from '../needs/needColors';
import { JOURNEY_NEED_NAMES, JOURNEY_NEED_EMOJI } from '../journey/journeyMeta';
import { SCHEMAS, SCHEMA_NAME_TO_ID } from '../hooks/ysqSchemas';
import {
  countActiveInHistory,
  type YsqHistoryEntry,
} from '../hooks/ysqScoring';

export interface PortraitNeed {
  id: NeedId;
  label: string;
  emoji: string;
  color: string;
  count: number;
}

export interface Portrait {
  needs: PortraitNeed[];
  totalSchemas: number;
  totalModes: number;
  delta: number | null;
}

// Поля опциональны: вызывающая сторона может передать профиль до того, как
// прогрузились все его части (напр. история YSQ ещё в polling) — `??`-фолбэки
// ниже это честно отражают, а не защищаются от невозможного.
export interface PortraitInput {
  activeSchemaIds?: string[];
  manualSchemaIds?: string[];
  myModeIds?: string[];
  ysqHistory?: YsqHistoryEntry[];
}

// id схемы → id потребности, для группировки активных схем. `SCHEMAS`
// (ты-дефолт) хранится по русскому названию, `needId` от формы обращения не
// зависит (см. комментарий в ysqSchemas.ts) — join через SCHEMA_NAME_TO_ID
// (название → id схемы для истории), тот же реестр, что и раньше использовал
// домен. Схема без needId в реестре не встречается (проверено: все 20 имён
// SCHEMAS есть в SCHEMA_NAME_TO_ID) — если однажды контент разъедется, такая
// схема просто не попадёт в карту и не посчитается нигде, а не уронит расчёт.
const SCHEMA_TO_NEED: Record<string, NeedId> = Object.fromEntries(
  SCHEMAS.map((s) => [SCHEMA_NAME_TO_ID[s.name], s.needId as NeedId]),
);

export function buildPortrait(input: PortraitInput): Portrait {
  const activeIds = new Set<string>();
  for (const id of input.activeSchemaIds ?? []) {
    if (SCHEMA_TO_NEED[id]) activeIds.add(id);
  }
  for (const id of input.manualSchemaIds ?? []) {
    if (SCHEMA_TO_NEED[id]) activeIds.add(id);
  }

  // Без `??`-фолбэков: NEED_ORDER — единственный источник id потребностей, и
  // JOURNEY_NEED_NAMES/EMOJI (shared/src/journey/journeyMeta.ts) объявлены
  // ровно по тем же пяти ключам (сверка — тест «все пять id имеют подпись и
  // эмодзи» ниже в portraitData.test.ts). Фолбэк здесь был бы недостижимой
  // веткой (правило №15: гейт не обходят кодом, который никогда не выполнится).
  const needs: PortraitNeed[] = NEED_ORDER.map((id) => ({
    id,
    label: JOURNEY_NEED_NAMES[id],
    emoji: JOURNEY_NEED_EMOJI[id],
    color: needColor(id),
    count: [...activeIds].filter((sid) => SCHEMA_TO_NEED[sid] === id).length,
  }));

  const totalSchemas = needs.reduce((sum, n) => sum + n.count, 0);
  const totalModes = (input.myModeIds ?? []).length;

  const history = input.ysqHistory ?? [];
  const delta =
    history.length >= 2
      ? countActiveInHistory(history[0]) - countActiveInHistory(history[1])
      : null;

  return { needs, totalSchemas, totalModes, delta };
}

export function hasPortraitData(p: Portrait): boolean {
  return p.needs.some((n) => n.count > 0);
}
