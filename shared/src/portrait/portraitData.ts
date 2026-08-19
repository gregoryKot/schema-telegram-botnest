// Чистый слой данных карточки «Мой портрет» (вкладка профиля мини-аппа).
// Общий для обоих фронтендов (правило №3 CLAUDE.md) — UI-потребитель
// добавляется отдельным PR сразу после этого файла.
//
// Активные схемы уже вычислены на бэкенде (GET /api/profile →
// ysq.activeSchemaIds, см. src/bot/profile.service.ts +
// computeActiveSchemas в src/utils/ysq.ts — тот же критерий активности,
// что и isSchemaScoreActive здесь) — этот слой их НЕ пересчитывает из
// сырых ответов, только объединяет с ручным выбором (User.mySchemaIds)
// и группирует по доменам. Источники объединяются через Set, чтобы одна и
// та же схема не считалась дважды.
import { SCHEMA_DOMAINS } from '../schemaTherapy/content/schemaDomains';
import { ALL_SCHEMAS } from '../schemaTherapy/schemaTherapyData';
import {
  countActiveInHistory,
  type YsqHistoryEntry,
} from '../hooks/ysqScoring';

export interface PortraitDomain {
  id: string;
  label: string;
  color: string;
  count: number;
}

export interface Portrait {
  domains: PortraitDomain[];
  totalSchemas: number;
  totalModes: number;
  delta: number | null;
}

export interface PortraitInput {
  activeSchemaIds: string[];
  manualSchemaIds: string[];
  myModeIds: string[];
  ysqHistory: YsqHistoryEntry[];
}

// Короткие человекочитаемые подписи доменов — для узкой карточки-бара, не
// длинные официальные названия SCHEMA_DOMAINS.domain (см. правило №8 CLAUDE.md
// «язык отчёта — простой»).
const DOMAIN_LABELS: Record<string, string> = {
  rejection: 'Отвержение',
  autonomy: 'Автономия',
  limits: 'Границы',
  other_directed: 'Ориентация на других',
  vigilance: 'Бдительность',
};

// id схемы → id домена, для группировки активных схем по доменам.
const SCHEMA_TO_DOMAIN: Record<string, string> = Object.fromEntries(
  ALL_SCHEMAS.map((s) => [s.id, s.domainId]),
);

export function buildPortrait(input: PortraitInput): Portrait {
  const activeIds = new Set<string>();
  for (const id of input.activeSchemaIds ?? []) {
    if (SCHEMA_TO_DOMAIN[id]) activeIds.add(id);
  }
  for (const id of input.manualSchemaIds ?? []) {
    if (SCHEMA_TO_DOMAIN[id]) activeIds.add(id);
  }

  const domains: PortraitDomain[] = SCHEMA_DOMAINS.map((d) => ({
    id: d.id,
    label: DOMAIN_LABELS[d.id] ?? d.domain,
    color: d.color,
    count: [...activeIds].filter((id) => SCHEMA_TO_DOMAIN[id] === d.id).length,
  }));

  const totalSchemas = domains.reduce((sum, d) => sum + d.count, 0);
  const totalModes = (input.myModeIds ?? []).length;

  const history = input.ysqHistory ?? [];
  const delta =
    history.length >= 2
      ? countActiveInHistory(history[0]) - countActiveInHistory(history[1])
      : null;

  return { domains, totalSchemas, totalModes, delta };
}

export function hasPortraitData(p: Portrait): boolean {
  return p.domains.some((d) => d.count > 0);
}
