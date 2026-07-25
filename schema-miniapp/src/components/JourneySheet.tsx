// «Мой путь» (мини-апп) — обёртка над общими useJourney/JourneyView
// (shared/src/journey, правило №3): BottomSheet, заголовок, открытие записи
// (тап → детальный вид) и шаринг ленты/шага.
// Парный файл: webapp/src/components/JourneySheet.tsx.
import { BottomSheet } from './BottomSheet';
import { SkeletonCard, SkeletonList } from './Skeleton';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { SharePill } from '../share/SharePill';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { getModeById, getSchemaById } from '../schemaTherapyData';
import { botShortUrl } from '../utils/botConfig';
import {
  makeJourneyProps,
  useJourney,
} from '../../../shared/src/journey/useJourney';
import { JourneyView } from '../../../shared/src/journey/JourneyView';
import { useJourneyShare } from '../../../shared/src/journey/journeyShare';
import {
  JourneyItemDetail,
  useJourneyDetail,
} from '../../../shared/src/journey/JourneyItemDetail';

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const j = useJourney(jp.deps);
  const sh = useJourneyShare(j, jp.subtitle, botShortUrl, jp.fetchResult);
  const detail = useJourneyDetail(jp.fetchDetail);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4, minHeight: '55vh' }}>
        {detail.item ? (
          <JourneyItemDetail
            detail={detail}
            subtitle={jp.subtitle}
            onShare={() => detail.item && sh.shareItem(detail.item)}
          />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}
              >
                🧭 Мой путь
              </span>
              <span style={{ marginRight: 'auto' }} />
              {j.total > 0 && <SharePill compact onClick={sh.shareFeed} />}
            </div>

            <JourneyView
              tr={tr}
              j={j}
              subtitle={jp.subtitle}
              onOpenItem={detail.open}
              skeleton={
                <>
                  <SkeletonCard h={96} />
                  <div style={{ height: 10 }} />
                  <SkeletonCard h={64} />
                  <div style={{ height: 10 }} />
                  <SkeletonList rows={5} h={52} />
                </>
              }
            />
          </>
        )}
      </div>

      {sh.payload && (
        <ShareCardSheet {...sh.payload} onClose={sh.close} zIndex={300} />
      )}
    </BottomSheet>
  );
}
