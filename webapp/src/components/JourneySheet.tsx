// «Мой путь» (webapp) — обёртка над общими useJourney/JourneyView (правило №3): fixed-оверлей с
// useHistorySheet, заголовок, шаринг (тихая ссылка: залитой кнопки на листе ленты нет, b22-journey).
import '../styles/sheet-diary.css';
import { useRef } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { Skeleton, SkeletonList } from './Skeleton';
import { api } from '../api';
import { getModeById, getSchemaById } from '../schemaTherapyData';
import { JourneyView } from '../../../shared/src/journey/JourneyView';
import { useJourneyShare } from '../../../shared/src/journey/journeyShare';
import { useJourney, makeJourneyProps } from '../../../shared/src/journey/useJourney';
import { WEB_JOURNEY_KIT } from './journey/webJourneyKit';
import { botShortUrl } from '../utils/botConfig';
import { ShareLink } from '../share/ShareLink';
import { useJourneyDetail } from '../../../shared/src/journey/JourneyItemDetail';
import { JourneyDetailLayer } from './journey/JourneyDetailLayer';
import { useJourneyDelete } from '../../../shared/src/journey/journeyDelete';

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const j = useJourney(jp.deps);
  const sh = useJourneyShare(j, jp.subtitle, botShortUrl, jp.fetchResult);
  const detail = useJourneyDetail(jp.fetchDetail);
  // Запись — вложенный уровень истории: после удаления закрываем её через слой.
  const closeDetail = useRef<() => void>(() => {});
  const del = useJourneyDelete(api, () => {
    closeDetail.current();
    j.reload();
  });

  return (
    <div className="u-sheet sd-journey">
      {!detail.item && <div className="ds-sheet-head sd-top"><button type="button" className="ds-back" onClick={goBack}>← Назад</button></div>}
      <div className="sd-journey-inner">
        {detail.item ? (
          <JourneyDetailLayer
            closeRef={closeDetail}
            detail={detail}
            subtitle={jp.subtitle}
            tr={tr}
            onShare={sh.shareItem}
            del={del}
          />
        ) : (
          <>
            <div className="ds-head-row sd-journey-head">
              <h1 className="ds-h1 sd-journey-title">Мой путь</h1>
              {j.total > 0 && <ShareLink onClick={sh.shareSummary} />}
            </div>

            <JourneyView
              tr={tr}
              j={j}
              subtitle={jp.subtitle}
              onOpenItem={detail.open}
              onShareFeed={sh.shareFeed}
              kit={WEB_JOURNEY_KIT}
              skeleton={
                // Форма — как у JourneyView: лист-герой, плитки 2×3, строки ленты 56px (journey.css).
                <div className="jr-skel">
                  <Skeleton height={232} radius={24} />
                  <div className="jr-stats">{[0, 1, 2, 3, 4, 5].map((k) => <Skeleton key={k} height={92} radius={18} />)}</div>
                  <SkeletonList rows={5} height={56} radius={16} />
                </div>
              }
            />
          </>
        )}
      </div>

      {sh.payload && <ShareCardSheet {...sh.payload} onClose={sh.close} />}
    </div>
  );
}
