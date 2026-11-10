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
import type { ReactNode } from 'react';
import type { YsqEntryLook } from './patternsHero';

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
  /** Плитка теста рядом с героем (ysqEntryLook): под вводной схем её нет — вход в тест уже в герое. */
  ysqEntry: YsqEntryLook;
  /** Сбой сохранения выбора схем — строкой у «Моих схем». */
  note?: ReactNode;
}

/**
 * Всё про схемы на экране «Паттерны». Компьютер — выраженные схемы и плитка теста рядом (под вводной схем —
 * без плитки: тест зовёт герой), «Мои схемы»
 * группами на бумаге домена в колонки, полная карта аккордеонами доменов. Телефон — как в мини-аппе:
 * выраженные схемы, те же группы строками, полная карта под сворачиваемым «Все N схем».
 */
export function PatternsSchemasPane({ mobile, d, pat, allSchemaIds, onStartTest, onAdd, onOpenDetail, blocks, ysqEntry, note }: Props) {
  const expressed = (
    <ExpressedCard loading={d.loading} ysqSchemaIds={d.ysqSchemaIds} ysqScores={d.ysqScores} completedAt={d.ysqCompletedAt} onOpenSchema={onOpenDetail} />
  );
  const mine = { onAdd, onOpenSchema: (id: string) => pat.openPattern('schema', id), statusFor: pat.statusOf('schema').statusFor, freq: pat.entriesReady ? pat.schemaFreq : undefined };
  if (!mobile) {
    const tile = ysqEntry !== 'hidden' && !blocks.isHidden('ysq_status');
    // Пустые «Выраженные схемы» зовут «пройти справа» — без плитки теста рядом (вводная схем) их нет, как на телефоне.
    return (
      <>
        {(tile || d.loading || d.ysqSchemaIds.length > 0) && (
          <div className="cs-top">
            {expressed}
            {tile && <YsqTestCard progressAnswered={d.ysqProgressAnswered} completedAt={d.ysqCompletedAt} onStart={onStartTest} onPaper={ysqEntry === 'paper'} />}
          </div>
        )}
        <MySchemasBlock loading={d.loading} ids={allSchemaIds} {...mine} note={note} />
        <SchemaMap mineIds={allSchemaIds} onOpenSchema={onOpenDetail} />
      </>
    );
  }
  const total = countSchemas(SCHEMA_DOMAINS);
  return (
    <>
      {(d.loading || d.ysqSchemaIds.length > 0) && expressed}
      {note}
      <MySchemasList ids={allSchemaIds} {...mine} />
      <SchemaMapFold label={`Все ${total} ${schemasWord(total)}`}>
        <SchemaMap mineIds={allSchemaIds} onOpenSchema={onOpenDetail} />
      </SchemaMapFold>
    </>
  );
}
