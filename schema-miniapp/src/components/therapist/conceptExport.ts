import { getHost } from '../../../../shared/src/host';
import { fmtDate, todayStr } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import type { TherapyClientSummary, ClientConceptualization } from '../../api';

// Текст экспорта краткой концептуализации (share/clipboard). Чистая функция,
// вынесена из useClientDetail.ts (правило №10).
export function buildConceptExport({
  selectedClient,
  concept,
  localConcept,
  activeSchemaIds,
  activeModeIds,
}: {
  selectedClient: TherapyClientSummary | null;
  concept: ClientConceptualization | null;
  localConcept: Partial<ClientConceptualization>;
  activeSchemaIds: string[];
  activeModeIds: string[];
}): string {
  if (!selectedClient || !concept) return '';
  const therapistName = getHost().user()?.firstName ?? 'Терапевт';
  const clientName =
    selectedClient.clientAlias ??
    selectedClient.name ??
    `ID ${selectedClient.telegramId}`;
  const date = concept.updatedAt
    ? fmtDate(concept.updatedAt.slice(0, 10))
    : todayStr();
  const c = { ...concept, ...localConcept };
  const schemaNames = activeSchemaIds.map((id) => {
    const s = SCHEMA_DOMAINS.flatMap((d) => d.schemas).find((x) => x.id === id);
    return s ? s.name : id;
  });
  const modeNames = activeModeIds.map((id) => {
    const m = MODE_GROUPS.flatMap((g) => g.items).find((x) => x.id === id);
    return m ? m.name : id;
  });
  const row = (label: string, value: string | null | undefined) =>
    `${label}\n${value?.trim() || '—'}\n`;
  const div = '─'.repeat(44);
  return [
    `Терапевт: ${therapistName}   Клиент: ${clientName}   Дата: ${date}`,
    '',
    '══════ КРАТКАЯ КОНЦЕПТУАЛИЗАЦИЯ ══════',
    '',
    div,
    row('АКТУАЛЬНЫЕ СХЕМЫ (ЭДС)', schemaNames.join(' · ') || null),
    div,
    row('КАРТА РЕЖИМОВ', modeNames.join(' · ') || null),
    div,
    row('РАННИЙ ДИСФУНКЦИОНАЛЬНЫЙ ОПЫТ', c.earlyExperience),
    div,
    row('НЕУДОВЛЕТВОРЁННЫЕ БАЗОВЫЕ ПОТРЕБНОСТИ', c.unmetNeeds),
    div,
    row('СХЕМНЫЕ ТРИГГЕРЫ', c.triggers),
    div,
    row('ДЕЗАДАПТИВНЫЕ КОПИНГИ', c.copingStyles),
    div,
    row('АКТУАЛЬНЫЕ ПРОБЛЕМЫ И СИМПТОМЫ', c.currentProblems),
    div,
    row('ЦЕЛИ СХЕМА-ТЕРАПИИ', c.goals),
    div,
    '',
    '@SchemeHappens · Всё по схеме',
  ].join('\n');
}
