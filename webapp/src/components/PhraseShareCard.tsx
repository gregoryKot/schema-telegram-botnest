// «Фраза для себя»: случайная фраза Здорового Взрослого из пула + шэр
// карточкой. Паритет с schema-miniapp/src/components/PhraseShareCard.tsx
// (правило №16 — GET /api/healthy-phrase был доступен только мини-аппу).
// Состояние — общее (shared/usePhraseShareCard, правило №3), вёрстка своя.
import { api } from '../api';
import { Skeleton } from './Skeleton';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { SharePillButton } from '../share/SharePillButton';
import { usePhraseShareCard } from '../../../shared/src/share/usePhraseShareCard';
import { phraseShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';

export function PhraseShareCard() {
  const { phrase, loading, showShare, setShowShare, reload, draw } =
    usePhraseShareCard(api.getHealthyPhrase);
  if (!loading && !phrase) return null;

  return (
    <>
    <hr className="hr-soft" style={{ margin: '28px 0' }} />
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="eyebrow">Фраза для себя</div>
        {phrase && <SharePillButton onClick={() => setShowShare(true)} label="Поделиться фразой" />}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <Skeleton width="100%" height={13} />
          <Skeleton width="75%" height={13} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>«{phrase}»</div>
          <button
            onClick={reload}
            style={{ marginTop: 8, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            Другая ↻
          </button>
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
    </>
  );
}
