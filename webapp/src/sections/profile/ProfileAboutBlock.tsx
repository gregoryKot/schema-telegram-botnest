// «Мой портрет» и «Тёплые слова» в профиле сайта. Данные — общий хук
// shared/src/portrait/useAboutMe (api инъекцией); портрет и слова готовятся
// независимо и показывают силуэт карточки, пока грузятся (правило «Скелетоны»).
import { useState } from 'react';
import { api, reportClientError } from '../../api';
import { Skeleton } from '../../components/Skeleton';
import { useAboutMe } from '../../../../shared/src/portrait/useAboutMe';
import { PortraitCard } from './PortraitCard';
import { PortraitSheet } from './PortraitSheet';
import { WarmWordsCard } from './WarmWordsCard';

interface Props {
  refreshKey?: number;
  onTakeTest?: () => void;
}

export function ProfileAboutBlock({ refreshKey, onTakeTest }: Props) {
  const aboutMe = useAboutMe(api, { refreshKey, reportError: (message) => reportClientError({ message, section: 'profile-about' }) });
  const [sheet, setSheet] = useState(false);

  return (
    <>
      <div className="cpf-slot cpf-slot--portrait">{/* слоты — flex-элементы страницы: на телефоне портрет выше (css order) */}
        {aboutMe.portraitReady
          ? <PortraitCard portrait={aboutMe.portrait} ysqCompletedAt={aboutMe.ysqCompletedAt} onOpenSheet={() => setSheet(true)} onTakeTest={onTakeTest} />
          : <Skeleton height={220} radius={20} />}
      </div>
      <div className="cpf-slot cpf-slot--warm">{aboutMe.warmWordsReady ? <WarmWordsCard items={aboutMe.warmWordsItems} /> : <Skeleton height={110} radius={20} />}</div>
      {sheet && <PortraitSheet aboutMe={aboutMe} onClose={() => setSheet(false)} />}
    </>
  );
}
