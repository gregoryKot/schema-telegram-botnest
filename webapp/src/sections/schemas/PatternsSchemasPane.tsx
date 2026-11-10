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
import type { ReactNode } from 'react';
import type { YsqEntryLook } from './patternsHero';
import type { PatternsTop } from './patternsTop';

interface Props {
  mobile: boolean;
  d: ReturnType<typeof useSchemasData>;
  pat: ReturnType<typeof usePatternLayer>;
  allSchemaIds: string[];
  onStartTest: () => void;
  onAdd: () => void;
  onOpenDetail: (id: string) => void;
  /** Верхняя пара (patternsTop → topPair): «Выраженные» — только с данными или пока грузятся, на любой ширине;
   *  плитка теста — на компьютере (на телефоне строка теста стоит выше, в PatternsTopStack). */
  top: PatternsTop['pair'];
  /** Плитка теста рядом с героем (ysqEntryLook → patternsTop: вид по герою и группе ниже): под вводной схем её нет. */
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
export function PatternsSchemasPane({ mobile, d, pat, allSchemaIds, onStartTest, onAdd, onOpenDetail, top, ysqEntry, note }: Props) {
  const expressed = (
    <ExpressedCard loading={d.loading} ysqSchemaIds={d.ysqSchemaIds} ysqScores={d.ysqScores} completedAt={d.ysqCompletedAt} onOpenSchema={onOpenDetail} />
  );
  const mine = { onAdd, onOpenSchema: (id: string) => pat.openPattern('schema', id), statusFor: pat.statusOf('schema').statusFor, freq: pat.entriesReady ? pat.schemaFreq : undefined };
  if (!mobile) {
    // Пустые «Выраженные схемы» не рисуются, как на телефоне: плитка теста тогда одна во весь ряд (topPair).
    return (
      <>
        {(top.tile || top.expressed) && (
          <div className="cs-top">
            {top.expressed && expressed}
            {top.tile && <YsqTestCard progressAnswered={d.ysqProgressAnswered} completedAt={d.ysqCompletedAt} onStart={onStartTest} onPaper={ysqEntry === 'paper'} solo={!top.expressed} />}
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
      {top.expressed && expressed}
      {note}
      <MySchemasList ids={allSchemaIds} {...mine} />
      <SchemaMapFold label={`Все ${total} ${schemasWord(total)}`}>
        <SchemaMap mineIds={allSchemaIds} onOpenSchema={onOpenDetail} />
      </SchemaMapFold>
    </>
  );
}
