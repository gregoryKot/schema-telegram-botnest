// «Ритм дней» (b21): счётчики, серия и теплокарта — один блок между линиями (pp-block) вместо трёх
// белых карточек. Серия и теплокарта — свои блоки «Настроить экран» (ScreenBlock streak/heatmap);
// место всего блока на телефоне — место первого видимого из них (--blk-o группы). Счётчики на
// телефоне не показываются (дублируют серию): без серии и теплокарты блок на телефоне не рисуется.
import type { CSSProperties } from 'react';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';
import { ProfileCounters } from './ProfileCounters';
import { StreakCard } from './StreakCard';
import { ActivityHeatmap } from './ActivityHeatmap';
import type { StreakData } from './profileMeta';
import { groupOrder, visibleInOrder } from './profileLayout';

interface Props {
  blocks: SiteScreenBlocks;
  streak: StreakData | null;
  levels: Map<string, number>;
  activeDates: Set<string>;
  diaryCount: number;
  ysqCount: number;
  onOpenTracker?: () => void;
}

const RHYTHM_IDS = ['streak', 'heatmap'] as const;

export function RhythmBlock({ blocks, streak, levels, activeDates, diaryCount, ysqCount, onOpenTracker }: Props) {
  const totalDays = streak?.totalDays ?? 0;
  const has = { streak: streak !== null, heatmap: activeDates.size > 0 };
  const ids = visibleInOrder(RHYTHM_IDS, blocks, (id) => has[id]);
  const cls = `pp-block cpf-rhythm cpf-blk${ids.length === 0 ? ' cpf-rhythm--bare' : ''}${ids.length === 2 ? ' cpf-rhythm--two' : ''}`;
  return (
    <section className={cls} style={{ '--blk-o': groupOrder(ids, blocks) } as CSSProperties}>
      <ProfileCounters streak={streak?.currentStreak ?? 0} totalDays={totalDays} diaryCount={diaryCount} ysqCount={ysqCount} />
      {ids.length > 0 && (
        <div className="cpf-rhythm-row">
          {streak && <ScreenBlock id="streak" blocks={blocks} className="cpf-rhythm-item"><StreakCard streak={streak} onOpenTracker={onOpenTracker} /></ScreenBlock>}
          <ScreenBlock id="heatmap" blocks={blocks} when={has.heatmap} className="cpf-rhythm-item cpf-rhythm-item--heat">
            <ActivityHeatmap levels={levels} activeDates={activeDates} totalDays={totalDays} />
          </ScreenBlock>
        </div>
      )}
    </section>
  );
}
