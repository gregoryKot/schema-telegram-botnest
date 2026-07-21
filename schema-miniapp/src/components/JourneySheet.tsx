// «Мой путь» (мини-апп) — обёртка над общими useJourney/JourneyView
// (shared/src/journey, правило №3): BottomSheet, заголовок, шаринг.
// Парный файл: webapp/src/components/JourneySheet.tsx.
import { useCallback, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { SkeletonLines, SkeletonList } from './Skeleton';
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
import { drawJourneyCard } from '../../../shared/src/share/cards/journeyCard';
import { journeyShareText } from '../../../shared/src/share/shareTexts';

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const j = useJourney(jp.deps);
  const [showShare, setShowShare] = useState(false);

  const drawCard = useCallback(
    (canvas: HTMLCanvasElement) => drawJourneyCard(canvas, j.stats, j.total),
    [j.stats, j.total],
  );

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4, minHeight: '55vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            🧭 Мой путь
          </span>
          <span style={{ marginRight: 'auto' }} />
          {j.total > 0 && (
            <SharePill compact onClick={() => setShowShare(true)} />
          )}
        </div>

        <JourneyView
          tr={tr}
          j={j}
          subtitle={jp.subtitle}
          skeleton={
            <>
              <SkeletonLines widths={['70%', '45%']} />
              <div style={{ height: 12 }} />
              <SkeletonList rows={6} h={56} />
            </>
          }
        />
      </div>

      {showShare && (
        <ShareCardSheet
          title="Мой путь"
          draw={drawCard}
          shareText={journeyShareText(j.total, botShortUrl)}
          filename="journey.png"
          eventKind="journey"
          onClose={() => setShowShare(false)}
          zIndex={300}
        />
      )}
    </BottomSheet>
  );
}
