import { SharePill } from '../../share/SharePill';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import {
  useModeEntryShare,
  modeEntryShareLinkStyle,
} from '../../../../shared/src/share/useModeEntryShare';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';
import type { ModeEntryMode } from '../../../../shared/src/share/cards/modeEntryCard';
import { botShortUrl } from '../../utils/botConfig';

/**
 * Сохранить/поделиться записью режима: краткая карточка «Голос Здорового
 * Взрослого» первична (нужен healthyResponse). Вторая, более откровенная
 * опция — «поделиться всей записью» (нужен entry хоть с одним полем, кроме
 * healthyResponse). Ветвление и оба набора пропсов ShareCardSheet считает
 * modeEntryShareOptions (shared, правило №11) — здесь только тонкий JSX.
 */
export function ModeEntryShare({
  mode,
  healthyResponse,
  entry,
  dateLabel,
}: {
  mode?: ModeEntryMode;
  healthyResponse?: string | null;
  entry?: ModeEntryFullSource;
  dateLabel?: string;
}) {
  const { share, setShare, hasHealthy, hasFull, shortProps, fullProps } =
    useModeEntryShare(mode, healthyResponse, entry, botShortUrl, dateLabel);
  if (!hasHealthy && !hasFull) return null;

  return (
    <>
      {hasHealthy && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 8,
            }}
          >
            <SharePill compact onClick={() => setShare('short')} />
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Можно сохранить карточку и перечитывать, когда снова накроет.
          </div>
        </>
      )}
      {hasFull && (
        <div style={{ marginTop: hasHealthy ? 10 : 8, textAlign: 'right' }}>
          <button
            onClick={() => setShare('full')}
            style={modeEntryShareLinkStyle}
          >
            Поделиться всей записью
          </button>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {fullProps?.hint}
          </div>
        </div>
      )}
      {share === 'short' && shortProps && (
        <ShareCardSheet {...shortProps} onClose={() => setShare(null)} />
      )}
      {share === 'full' && fullProps && (
        <ShareCardSheet {...fullProps} onClose={() => setShare(null)} />
      )}
    </>
  );
}
