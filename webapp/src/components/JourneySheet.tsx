// «Мой путь» (webapp) — обёртка над общими useJourney/JourneyView
// (shared/src/journey, правило №3): fixed-оверлей с useHistorySheet,
// заголовок, шаринг. Парный файл: schema-miniapp/src/components/JourneySheet.tsx.
import { useCallback, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { api } from '../api';
import { getModeById, getSchemaById } from '../schemaTherapyData';
import { journeyShareText } from '../../../shared/src/share/shareTexts';
import { drawJourneyCard } from '../../../shared/src/share/cards/journeyCard';
import { JourneyView } from '../../../shared/src/journey/JourneyView';
import {
  makeJourneyProps,
  useJourney,
} from '../../../shared/src/journey/useJourney';
import { botShortUrl } from '../utils/botConfig';

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const j = useJourney(jp.deps);
  const [showShare, setShowShare] = useState(false);

  const drawCard = useCallback(
    (canvas: HTMLCanvasElement) => drawJourneyCard(canvas, j.stats, j.total),
    [j.stats, j.total],
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'var(--bg)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px' }}
      >
        <button
          onClick={goBack}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-sub)',
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: 'pointer',
            padding: '10px 0',
            marginBottom: 8,
          }}
        >
          ← Назад
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            🧭 Мой путь
          </h1>
          <span style={{ marginRight: 'auto' }} />
          {j.total > 0 && (
            <button
              onClick={() => setShowShare(true)}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 12,
                border:
                  '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                background:
                  'color-mix(in srgb, var(--accent) 12%, transparent)',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Поделиться
            </button>
          )}
        </div>

        <JourneyView
          tr={tr}
          j={j}
          subtitle={jp.subtitle}
          skeleton={
            <>
              {[36, 36, 56, 56, 56, 56].map((h, i) => (
                <div
                  key={i}
                  style={{
                    height: h,
                    borderRadius: 14,
                    marginBottom: 8,
                    background:
                      'linear-gradient(90deg,rgba(var(--fg-rgb),0.03) 25%,rgba(var(--fg-rgb),0.07) 50%,rgba(var(--fg-rgb),0.03) 75%)',
                    backgroundSize: '200% auto',
                    animation: 'shimmer 1.5s linear infinite',
                  }}
                />
              ))}
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
        />
      )}
    </div>
  );
}
