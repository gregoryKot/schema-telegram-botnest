import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { PatternsHeroSection } from './PatternsHeroSection';
import { SchemasSectionProps } from './types';
import { SchemasPatternSection } from './SchemasPatternSection';
import { WeekTopSummary } from '../../utils/patternsSummary';
import type { BlockVisibility } from './blockVisibility';
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
  blocks: BlockVisibility;
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
  blocks,
}: SchemasTabProps) {
  const hasSchemas = allSchemaIds.length > 0 || !!ysqCompletedAt;
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <PatternsHeroSection
        profileLoading={profileLoading}
        hasSchemas={hasSchemas}
        weekSummary={weekSummary}
        ysqProgressAnswered={ysqProgressAnswered}
        ysqCompletedAt={ysqCompletedAt}
        onOpenSchema={onOpenSchema}
        onShowSchemaPicker={onShowSchemaPicker}
        onOpenSchemaDetail={setOpenId}
        onOpenDiaries={onOpenDiaries}
        blocks={blocks}
      />
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
