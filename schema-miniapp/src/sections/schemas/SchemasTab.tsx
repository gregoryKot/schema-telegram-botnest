import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { PatternsHero } from '../../components/PatternsHero';
import {
  PatternFrequencyList,
  FreqGroup,
} from '../../components/PatternFrequencyList';
import { MyCardsSection } from '../../components/myCards/MyCardsSection';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { ChipsSkeleton } from './CatalogParts';
import { shortName } from './utils';
import { SchemasSectionProps } from './types';
import { YsqStatusCard } from './YsqStatusCard';

interface SchemasTabProps {
  profileLoading: boolean;
  allSchemaIds: string[];
  ysqCompletedAt: string | null;
  ysqProgressAnswered: number | null;
  weekSummary: WeekTopSummary | null;
  schemaFreq: Record<string, number>;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowSchemaPicker: () => void;
  onOpenSchemaDetail: (id: string) => void;
}

export function SchemasTab({
  profileLoading,
  allSchemaIds,
  ysqCompletedAt,
  ysqProgressAnswered,
  weekSummary,
  schemaFreq,
  onOpenSchema,
  onOpenDiaries,
  onShowSchemaPicker,
  onOpenSchemaDetail,
}: SchemasTabProps) {
  const hasSchemas = allSchemaIds.length > 0 || !!ysqCompletedAt;

  // Схемы пользователя, сгруппированные по домену, с недельной частотой.
  const groups: FreqGroup[] = SCHEMA_DOMAINS.map((domain) => ({
    title: domain.domain,
    items: domain.schemas
      .filter((sc) => allSchemaIds.includes(sc.id))
      .map((sc) => ({
        id: sc.id,
        name: shortName(sc.name),
        freq: schemaFreq[sc.id] ?? 0,
      })),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Hero: новичку — один очевидный вход; опытному — «чаще всего звучит» */}
      {!profileLoading && (
        <PatternsHero
          hasSchemas={hasSchemas}
          summary={weekSummary}
          progressAnswered={ysqProgressAnswered}
          onStartTest={() => onOpenSchema({ startTest: true })}
          onOpenLibrary={() => onOpenSchema()}
          onPickManually={onShowSchemaPicker}
          onOpenSchemaDetail={(id) => onOpenSchemaDetail(id)}
          onOpenDiaries={onOpenDiaries}
        />
      )}

      {/* Тест на схемы — компактный вход к результатам/продолжению */}
      {hasSchemas && (
        <YsqStatusCard
          ysqCompletedAt={ysqCompletedAt}
          ysqProgressAnswered={ysqProgressAnswered}
          onOpenSchema={onOpenSchema}
        />
      )}

      {/* Мои схемы по группам с недельной частотой (дизайн-макет «Паттерны») */}
      {hasSchemas &&
        (profileLoading ? (
          <ChipsSkeleton widths={[80, 100, 90, 110]} />
        ) : groups.length > 0 ? (
          <PatternFrequencyList
            groups={groups}
            selectedId={weekSummary?.id}
            onSelect={onOpenSchemaDetail}
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

      {/* Заполненные карточки схем — открыть/отредактировать/поделиться */}
      <MyCardsSection kind="schema" />
    </>
  );
}
