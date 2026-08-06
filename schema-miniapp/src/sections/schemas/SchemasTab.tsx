import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { PatternsHero } from '../../components/PatternsHero';
import { SchemasSectionProps } from './types';
import { SchemasPatternSection } from './SchemasPatternSection';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { YsqStatusCard } from './YsqStatusCard';
import type { SchemaDiaryEntry } from '../../types';

interface SchemasTabProps {
  profileLoading: boolean;
  allSchemaIds: string[];
  ysqCompletedAt: string | null;
  ysqProgressAnswered: number | null;
  weekSummary: WeekTopSummary | null;
  schemaFreq: Record<string, number>;
  schemaEntries: SchemaDiaryEntry[];
  setSchemaEntries: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowSchemaPicker: () => void;
}

export function SchemasTab({
  profileLoading,
  allSchemaIds,
  ysqCompletedAt,
  ysqProgressAnswered,
  weekSummary,
  schemaFreq,
  schemaEntries,
  setSchemaEntries,
  onOpenSchema,
  onOpenDiaries,
  onShowSchemaPicker,
}: SchemasTabProps) {
  const hasSchemas = allSchemaIds.length > 0 || !!ysqCompletedAt;
  const [openId, setOpenId] = useState<string | null>(null);

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
          onOpenSchemaDetail={setOpenId}
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

      <SchemasPatternSection
        profileLoading={profileLoading}
        hasSchemas={hasSchemas}
        allSchemaIds={allSchemaIds}
        schemaFreq={schemaFreq}
        schemaEntries={schemaEntries}
        setSchemaEntries={setSchemaEntries}
        weekSummary={weekSummary}
        onShowSchemaPicker={onShowSchemaPicker}
        openId={openId}
        onOpenChange={setOpenId}
      />
    </>
  );
}
