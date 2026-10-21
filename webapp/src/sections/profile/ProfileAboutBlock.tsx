// «Мой портрет» и «Тёплые слова» в профиле сайта. Данные — общий хук
// shared/src/portrait/useAboutMe (api инъекцией); портрет и слова готовятся
// независимо и показывают силуэт карточки, пока грузятся (правило «Скелетоны»).
import { useState } from 'react';
import { api, reportClientError } from '../../api';
import { Skeleton } from '../../components/Skeleton';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';
import { useAboutMe } from '../../../../shared/src/portrait/useAboutMe';
import { PortraitCard } from './PortraitCard';
import { PortraitSheet } from './PortraitSheet';
import { WarmWordsCard } from './WarmWordsCard';

interface Props {
  refreshKey?: number;
  onTakeTest?: () => void;
  blocks: SiteScreenBlocks;
}

export function ProfileAboutBlock({ refreshKey, onTakeTest, blocks }: Props) {
  const aboutMe = useAboutMe(api, { refreshKey, reportError: (message) => reportClientError({ message, section: 'profile-about' }) });
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
