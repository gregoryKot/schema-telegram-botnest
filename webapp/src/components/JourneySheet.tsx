// «Мой путь» (webapp) — обёртка над общими useJourney/JourneyView
// (shared/src/journey, правило №3): fixed-оверлей с useHistorySheet,
// заголовок, шаринг ленты (кнопка) и одного шага (тап по записи).
// Парный файл: schema-miniapp/src/components/JourneySheet.tsx.
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { api } from '../api';
import { getModeById, getSchemaById } from '../schemaTherapyData';
import { JourneyView } from '../../../shared/src/journey/JourneyView';
import { useJourneyShare } from '../../../shared/src/journey/journeyShare';
import {
  useJourney,
  makeJourneyProps,
} from '../../../shared/src/journey/useJourney';
import { botShortUrl } from '../utils/botConfig';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';

// Уровень модуля — стабильные ссылки (см. комментарий makeJourneyProps).
const jp = makeJourneyProps(api, { getModeById, getSchemaById });

export function JourneySheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const j = useJourney(jp.deps);
  const sh = useJourneyShare(j, jp.subtitle, botShortUrl);

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
        style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 80px' }}
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
              onClick={sh.shareFeed}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
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
              <ShareIcon size={15} />
              Поделиться
            </button>
          )}
        </div>

        <JourneyView
          tr={tr}
          j={j}
          subtitle={jp.subtitle}
          onShareItem={sh.shareItem}
          skeleton={
            <>
              {[96, 64, 56, 56, 56, 56].map((h, i) => (
                <div
                  key={i}
                  style={{
                    height: h,
                    borderRadius: 16,
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

      {sh.payload && <ShareCardSheet {...sh.payload} onClose={sh.close} />}
    </div>
  );
}
