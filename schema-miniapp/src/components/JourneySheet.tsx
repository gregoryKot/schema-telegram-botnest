// «Мой путь» (мини-апп) — обёртка над общими useJourney/JourneyView
// (shared/src/journey, правило №3): BottomSheet, заголовок, шаринг ленты
// (кнопка) и одного шага (тап по записи).
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

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const j = useJourney(jp.deps);
  const sh = useJourneyShare(j, jp.subtitle, botShortUrl);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4, minHeight: '55vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            🧭 Мой путь
          </span>
          <span style={{ marginRight: 'auto' }} />
          {j.total > 0 && <SharePill compact onClick={sh.shareFeed} />}
        </div>

        <JourneyView
          tr={tr}
          j={j}
          subtitle={jp.subtitle}
          onShareItem={sh.shareItem}
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
      </div>

      {sh.payload && (
        <ShareCardSheet {...sh.payload} onClose={sh.close} zIndex={300} />
      )}
    </BottomSheet>
  );
}
