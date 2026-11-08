// «Мой портрет» и «Тёплые слова» в профиле сайта. Данные — общий хук
// shared/src/portrait/useAboutMe: его держит ProfileSection (дневники — один запрос и для счётчика записей);
// портрет и слова готовятся независимо и показывают силуэт карточки, пока грузятся (правило «Скелетоны»).
import { useState } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';
import type { AboutMeState } from '../../../../shared/src/portrait/useAboutMe';
import { PortraitCard } from './PortraitCard';
import { PortraitSheet } from './PortraitSheet';
import { WarmWordsCard } from './WarmWordsCard';

interface Props {
  aboutMe: AboutMeState;
  onTakeTest?: () => void;
  blocks: SiteScreenBlocks;
}

export function ProfileAboutBlock({ aboutMe, onTakeTest, blocks }: Props) {
  const [sheet, setSheet] = useState(false);

  return (
    <>
      {/* блоки — flex-элементы страницы: на телефоне их место задаёт порядок из «Настроить экран» (css order) */}
      <ScreenBlock id="portrait" blocks={blocks} className="cpf-blk">
        {aboutMe.portraitReady
          ? <PortraitCard portrait={aboutMe.portrait} ysqCompletedAt={aboutMe.ysqCompletedAt} onOpenSheet={() => setSheet(true)} onTakeTest={onTakeTest} />
          : <Skeleton height={220} radius={20} />}
      </ScreenBlock>
      <ScreenBlock id="warm_words" blocks={blocks} className="cpf-blk">
        {aboutMe.warmWordsReady ? <WarmWordsCard items={aboutMe.warmWordsItems} /> : <Skeleton height={110} radius={20} />}
      </ScreenBlock>
      {sheet && <PortraitSheet aboutMe={aboutMe} onClose={() => setSheet(false)} />}
    </>
  );
}
