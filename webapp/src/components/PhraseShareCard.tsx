// «Фраза для себя»: случайная фраза Здорового Взрослого из пула + шэр
// карточкой. Паритет с schema-miniapp/src/components/PhraseShareCard.tsx
// (правило №16 — GET /api/healthy-phrase был доступен только мини-аппу).
// Состояние — общее (shared/usePhraseShareCard, правило №3), вёрстка своя.
import { api } from '../api';
import { Skeleton } from './Skeleton';
import { useIsMobile } from './useIsMobile';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { SharePillButton } from '../share/SharePillButton';
import { usePhraseShareCard } from '../../../shared/src/share/usePhraseShareCard';
import { phraseShareText } from '../../../shared/src/share/shareTexts';

// Низ карточки: на телефоне подпись и «Другая ↻» в одну строку, на десктопе — ссылка под фразой.
function PhraseMore({ phone, onMore }: { phone: boolean; onMore: () => void }) {
  if (!phone) {
    return (
      <button
        onClick={onMore}
        style={{ marginTop: 8, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        Другая ↻
      </button>
    );
  }
  return (
    <div className="ct-phrase-foot">
      <div className="ct-phrase-cap">Голос Здорового Взрослого — тёплая опора в моменте</div>
      <button onClick={onMore} className="ct-phrase-more">Другая ↻</button>
    </div>
  );
}

export function PhraseShareCard() {
  const { phrase, loading, showShare, setShowShare, reload, draw } =
    usePhraseShareCard(api.getHealthyPhrase);
  const phone = useIsMobile();
  if (!loading && !phrase) return null;

  // Телефон — карточка с подписью, как в мини-аппе; десктоп — строка под линией.
  return (
    <>
    {!phone && <hr className="hr-soft" style={{ margin: '28px 0' }} />}
    <div className={phone ? 'ds-card ct-phrase' : undefined}>
      <div className="u-between-mb10">
        <div className="eyebrow">Фраза для себя</div>
        {phrase && <SharePillButton onClick={() => setShowShare(true)} label="Поделиться фразой" />}
      </div>

      {loading ? (
        <div className="u-col8">
          <Skeleton width="100%" height={13} />
          <Skeleton width="75%" height={13} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: phone ? 16 : 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>«{phrase}»</div>
          <PhraseMore phone={phone} onMore={reload} />
        </>
      )}

      {showShare && phrase && (
        <ShareCardSheet
          title="Фраза для себя"
          draw={draw}
          shareText={phraseShareText(phrase)}
          filename="phrase.png"
          eventKind="phrase"
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
    </>
  );
}
