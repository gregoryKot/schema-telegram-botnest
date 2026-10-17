// «Мой путь» (webapp) — обёртка над общими useJourney/JourneyView (правило №3):
// fixed-оверлей с useHistorySheet, заголовок, шаринг. Парный: schema-miniapp/…
import '../styles/sheet-diary.css';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { Skeleton, SkeletonList } from './Skeleton';
import { api } from '../api';
import { getModeById, getSchemaById } from '../schemaTherapyData';
import { JourneyView } from '../../../shared/src/journey/JourneyView';
import { useJourneyShare } from '../../../shared/src/journey/journeyShare';
import {
  useJourney,
  makeJourneyProps,
} from '../../../shared/src/journey/useJourney';
import { WEB_JOURNEY_HEROES } from './journey/webJourneyHeroes';
import { botShortUrl } from '../utils/botConfig';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import { useJourneyDetail } from '../../../shared/src/journey/JourneyItemDetail';
import { JourneyDetailPane } from '../../../shared/src/journey/JourneyDetailPane';
import { useJourneyDelete } from '../../../shared/src/journey/journeyDelete';

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const j = useJourney(jp.deps);
  const sh = useJourneyShare(j, jp.subtitle, botShortUrl, jp.fetchResult);
  const detail = useJourneyDetail(jp.fetchDetail);
  const del = useJourneyDelete(api, () => {
    detail.close();
    j.reload();
  });

  return (
    <div className="u-sheet sd-journey">
      <div className="sd-journey-inner">
        {detail.item ? (
          <JourneyDetailPane
            detail={detail}
            subtitle={jp.subtitle}
            tr={tr}
            onShare={sh.shareItem}
            del={del}
          />
        ) : (
          <>
            <button onClick={goBack} className="ds-link sd-back">
              ← Назад
            </button>

            <div className="ds-head-row sd-journey-head">
              <h1 className="ds-h1 sd-journey-title">Мой путь</h1>
              {j.total > 0 && (
                <button onClick={sh.shareSummary} className="ds-btn ds-btn--secondary ds-btn--sm">
                  <ShareIcon size={15} />
                  Поделиться
                </button>
              )}
            </div>

            <JourneyView
              tr={tr}
              j={j}
              subtitle={jp.subtitle}
              onOpenItem={detail.open}
              onShareFeed={sh.shareFeed}
              heroes={WEB_JOURNEY_HEROES}
              skeleton={
                // Форма — как у реального JourneyView: hero-итог + счётчик +
                // строки ленты (JourneyTimeline минимальная высота строки —
                // 52px, shared/src/journey/JourneyTimeline.tsx). Парно с
                // schema-miniapp/src/components/JourneySheet.tsx.
                <>
                  <Skeleton height={96} radius={16} />
                  <div className="sd-skel-gap" />
                  <Skeleton height={64} radius={16} />
                  <div className="sd-skel-gap" />
                  <SkeletonList rows={5} height={52} radius={16} />
                </>
              }
            />
          </>
        )}
      </div>

      {sh.payload && <ShareCardSheet {...sh.payload} onClose={sh.close} />}
    </div>
  );
}
