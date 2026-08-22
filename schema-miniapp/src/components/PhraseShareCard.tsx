// «Фраза для себя» на экране «Здесь и сейчас»: случайная фраза Здорового
// взрослого из пула + шэр красивой карточкой. Контент готовый (не PII).
// Состояние — общее с webapp (shared/usePhraseShareCard, правило №3),
// вёрстка своя.
import { api } from '../api';
import { SkeletonLines } from './Skeleton';
import { SharePill } from '../share/SharePill';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { usePhraseShareCard } from '../../../shared/src/share/usePhraseShareCard';
import { phraseShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';

export function PhraseShareCard() {
  const { phrase, loading, showShare, setShowShare, reload, draw } =
    usePhraseShareCard(api.getHealthyPhrase);
  if (!loading && !phrase) return null;

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          Фраза для себя
        </div>
        {phrase && <SharePill compact onClick={() => setShowShare(true)} />}
      </div>

      {loading ? (
        <SkeletonLines widths={['100%', '75%']} />
      ) : (
        <>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.5,
            }}
          >
            «{phrase}»
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              Голос Здорового взрослого — тёплая опора в моменте
            </div>
            <button
              onClick={reload}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '4px 0 4px 10px',
                flexShrink: 0,
              }}
            >
              Другая ↻
            </button>
          </div>
        </>
      )}

      {showShare && phrase && (
        <ShareCardSheet
          title="Фраза для себя"
          draw={draw}
          shareText={phraseShareText(phrase, botShortUrl)}
          filename="phrase.png"
          eventKind="phrase"
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
