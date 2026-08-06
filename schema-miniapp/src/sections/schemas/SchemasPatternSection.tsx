// Список «Мои схемы» по доменам (частота + статус карточки) и экран
// паттерна схемы — вынесено из SchemasTab.tsx (файл-храповик у потолка,
// правило №10 CLAUDE.md). openId управляется снаружи: список и PatternsHero
// (сводка недели) должны открывать один и тот же экран одной и той же схемы.
import type { Dispatch, SetStateAction } from 'react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import {
  PatternFrequencyList,
  FreqGroup,
} from '../../components/PatternFrequencyList';
import { PatternSheet } from '../../components/patternSheet/PatternSheet';
import { usePatternStatus } from '../../components/patternSheet/usePatternStatus';
import { schemaEntryCounts } from '../../components/patternSheet/patternStatus';
import { ChipsSkeleton } from './CatalogParts';
import { shortName } from './utils';
import { WeekTopSummary } from '../../utils/patternsSummary';
import type { SchemaDiaryEntry } from '../../types';

interface Props {
  profileLoading: boolean;
  hasSchemas: boolean;
  allSchemaIds: string[];
  schemaFreq: Record<string, number>;
  schemaEntries: SchemaDiaryEntry[];
  setSchemaEntries: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  weekSummary: WeekTopSummary | null;
  onShowSchemaPicker: () => void;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

export function SchemasPatternSection({
  profileLoading,
  hasSchemas,
  allSchemaIds,
  schemaFreq,
  schemaEntries,
  setSchemaEntries,
  weekSummary,
  onShowSchemaPicker,
  openId,
  onOpenChange,
}: Props) {
  const { items, reload, statusFor } = usePatternStatus(
    'schema',
    schemaEntryCounts(schemaEntries),
  );
  const groups: FreqGroup[] = SCHEMA_DOMAINS.map((domain) => ({
    title: domain.domain,
    items: domain.schemas
      .filter((sc) => allSchemaIds.includes(sc.id))
      .map((sc) => ({
        id: sc.id,
        name: shortName(sc.name),
        freq: schemaFreq[sc.id] ?? 0,
        status: statusFor(sc.id),
      })),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {hasSchemas &&
        (profileLoading ? (
          <ChipsSkeleton widths={[80, 100, 90, 110]} />
        ) : groups.length > 0 ? (
          <PatternFrequencyList
            groups={groups}
            selectedId={weekSummary?.id}
            onSelect={onOpenChange}
            addLabel="+ Добавить схему"
            onAdd={onShowSchemaPicker}
            anyFreq={Object.values(schemaFreq).some((v) => v > 0)}
            hint="Полоска рядом со схемой — сколько дней за неделю она всплывала в дневнике. Это наблюдение, а не оценка."
          />
        ) : (
          <button
            onClick={onShowSchemaPicker}
            style={{
              width: '100%',
              padding: 15,
              background: 'transparent',
              border: '1.5px dashed var(--border-color)',
              borderRadius: 14,
              color: 'var(--text-sub)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            + Добавить схему
          </button>
        ))}

      {openId && (
        <PatternSheet
          kind="schema"
          id={openId}
          items={items}
          reload={reload}
          schemaEntries={schemaEntries}
          setSchemaEntries={setSchemaEntries}
          onClose={() => onOpenChange(null)}
        />
      )}
    </>
  );
}
