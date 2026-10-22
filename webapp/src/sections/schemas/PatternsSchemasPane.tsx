import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import type { useSchemasData } from './useSchemasData';
import type { usePatternLayer } from './usePatternLayer';
import { ExpressedCard } from './ExpressedCard';
import { YsqTestCard } from './YsqTestCard';
import { MySchemasBlock } from './MySchemasBlock';
import { MySchemasList } from './MySchemasList';
import { SchemaMap } from './SchemaMap';
import { SchemaMapFold } from './SchemaMapFold';
import { countSchemas, schemasWord } from './schemasModel';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';

interface Props {
  mobile: boolean;
  d: ReturnType<typeof useSchemasData>;
  pat: ReturnType<typeof usePatternLayer>;
  allSchemaIds: string[];
  onStartTest: () => void;
  onAdd: () => void;
  onOpenDetail: (id: string) => void;
  /** Скрытие карточки теста («Настроить экран»); на телефоне строка теста стоит выше, в PatternsTopStack. */
  blocks: Pick<SiteScreenBlocks, 'isHidden'>;
}

/**
 * Всё про схемы на экране «Паттерны». Десктоп — как раньше (карточки, чипы, полная карта).
 * Телефон — как в мини-аппе: выраженные схемы, строки по доменам,
 * полная карта под сворачиваемым «Все N схем».
 */
export function PatternsSchemasPane({ mobile, d, pat, allSchemaIds, onStartTest, onAdd, onOpenDetail, blocks }: Props) {
  const expressed = (
    <ExpressedCard loading={d.loading} ysqSchemaIds={d.ysqSchemaIds} ysqScores={d.ysqScores} completedAt={d.ysqCompletedAt} onOpenSchema={onOpenDetail} />
  );
  const mine = { onAdd, onOpenSchema: (id: string) => pat.openPattern('schema', id), statusFor: pat.statusOf('schema').statusFor, freq: pat.entriesReady ? pat.schemaFreq : undefined };
  if (!mobile) {
    return (
      <>
        <div className="cs-top">
          {expressed}
          {!blocks.isHidden('ysq_status') && <YsqTestCard progressAnswered={d.ysqProgressAnswered} completedAt={d.ysqCompletedAt} onStart={onStartTest} />}
        </div>
        <MySchemasBlock loading={d.loading} ids={allSchemaIds} {...mine} />
        <SchemaMap mineIds={allSchemaIds} onOpenSchema={onOpenDetail} />
      </>
    );
  }
  const total = countSchemas(SCHEMA_DOMAINS);
  return (
    <>
      {(d.loading || d.ysqSchemaIds.length > 0) && expressed}
      <MySchemasList ids={allSchemaIds} {...mine} />
      <SchemaMapFold label={`Все ${total} ${schemasWord(total)}`}>
        <SchemaMap mineIds={allSchemaIds} onOpenSchema={onOpenDetail} />
      </SchemaMapFold>
    </>
  );
}
