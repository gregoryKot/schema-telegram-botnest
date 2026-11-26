import { Fragment, type ReactNode } from 'react';
import type { ScreenBlockId } from '../../../../shared/src/screens/screenBlocks';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import { YsqTestRow } from './YsqTestRow';
import type { YsqEntryLook } from './patternsHero';

interface Props {
  blocks: SiteScreenBlocks;
  mobile: boolean;
  /** «Подсказка сверху» (PatternsTopCards): сам прячется, когда блок скрыт. */
  hero: ReactNode;
  /** Вход в тест рядом с героем (ysqEntryLook): под вводной схем второй кнопки теста нет. */
  ysqEntry: YsqEntryLook;
  ysqProgressAnswered: number | null;
  ysqCompletedAt: string | null;
  onStartTest: () => void;
}

/**
 * Верх вкладки «Схемы»: «Подсказка сверху» и (на телефоне) строка теста — в том
 * порядке, который человек выбрал в «Настроить экран», как в мини-аппе. На
 * десктопе порядок не меняется: карточка теста там стоит рядом с «Выраженными
 * схемами» (PatternsSchemasPane), здесь только подсказка.
 */
export function PatternsTopStack({ blocks, mobile, hero, ysqEntry, ysqProgressAnswered, ysqCompletedAt, onStartTest }: Props) {
  const byId: Partial<Record<ScreenBlockId, ReactNode>> = {
    heroes: hero,
    ysq_status: mobile && ysqEntry !== 'hidden' && (
      <ScreenBlock id="ysq_status" blocks={blocks}>
        <YsqTestRow progressAnswered={ysqProgressAnswered} completedAt={ysqCompletedAt} onStart={onStartTest} />
      </ScreenBlock>
    ),
  };
  const ids = mobile ? blocks.orderedIds : (['heroes'] as ScreenBlockId[]);
  return <>{ids.map((id) => <Fragment key={id}>{byId[id]}</Fragment>)}</>;
}
