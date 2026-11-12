// Витрина профиля (b21): «Мой путь», «Мой портрет», «Мои тёплые слова» — плитки цветной бумаги
// (pp-squares) вместо трёх белых карточек. Каждая плитка — свой блок «Настроить экран» (ScreenBlock):
// скрытая не рисуется, порядок плиток — из листа, место всей витрины на телефоне — место её первой
// видимой плитки (--blk-o группы). Раскладка по числу видимых плиток — cpf-shelf--nN (client-profile.css).
// Данные портрета и слов — общий хук useAboutMe (держит ProfileSection: дневники — один запрос).
import { useState, type CSSProperties } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import type { AboutMeState } from '../../../../shared/src/portrait/useAboutMe';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';
import { useTr } from '../../utils/addressForm';
import { PortraitCard } from './PortraitCard';
import { PortraitSheet } from './PortraitSheet';
import { WarmWordsCard } from './WarmWordsCard';
import { ShelfTile } from './ShelfTile';
import { groupOrder, SHELF_IDS, visibleInOrder, type ShelfId } from './profileLayout';

interface Props {
  aboutMe: AboutMeState;
  blocks: SiteScreenBlocks;
  onOpenJourney: () => void;
  onTakeTest?: () => void;
  /** Какие плитки вообще может показать экран (пустой профиль — только путь). */
  allow?: (id: ShelfId) => boolean;
}

export function ProfileShelf({ aboutMe, blocks, onOpenJourney, onTakeTest, allow = () => true }: Props) {
  const tr = useTr();
  const [sheet, setSheet] = useState(false);
  const ids = visibleInOrder(SHELF_IDS, blocks, (id) => allow(id) && (id !== 'warm_words' || aboutMe.warmWordsItems.length > 0));
  const tile = (id: ShelfId) => {
    if (id === 'journey') {
      return (
        <ShelfTile look={ENTITY_LOOK.journey} title="Мой путь" onOpen={onOpenJourney}>
          {glue(tr(
            'Вся твоя история в одном месте: трекер, дневники, практики и тесты — и красивая карточка, чтобы поделиться.',
            'Вся ваша история в одном месте: трекер, дневники, практики и тесты — и красивая карточка, чтобы поделиться.',
          ))}
        </ShelfTile>
      );
    }
    if (id === 'portrait') return <PortraitCard portrait={aboutMe.portrait} ysqCompletedAt={aboutMe.ysqCompletedAt} onOpenSheet={() => setSheet(true)} onTakeTest={onTakeTest} />;
    return <WarmWordsCard items={aboutMe.warmWordsItems} />;
  };
  return (
    <>
      {ids.length > 0 && (
        <div className={`pp-squares cpf-shelf cpf-shelf--n${ids.length} cpf-blk`} style={{ '--blk-o': groupOrder(ids, blocks) } as CSSProperties}>
          {ids.map((id) => (
            <ScreenBlock key={id} id={id} blocks={blocks} className={`cpf-shelf-item cpf-shelf-item--${id}`}>{tile(id)}</ScreenBlock>
          ))}
        </div>
      )}
      {sheet && <PortraitSheet aboutMe={aboutMe} onClose={() => setSheet(false)} />}
    </>
  );
}
