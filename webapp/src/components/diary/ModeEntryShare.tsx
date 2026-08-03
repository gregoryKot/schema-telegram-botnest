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
 * modeEntryShareOptions (shared, правило №11) — здесь только тонкий JSX. Тап
 * явный (stopPropagation — не сворачивает запись), с превью.
 */
export function ModeEntryShare({
  mode,
  healthyResponse,
  entry,
  dateLabel,
  color = 'var(--c-slate)',
}: {
  mode?: ModeEntryMode;
  healthyResponse?: string | null;
  entry?: ModeEntryFullSource;
  dateLabel?: string;
  color?: string;
}) {
  const { share, setShare, hasHealthy, hasFull, shortProps, fullProps } =
    useModeEntryShare(mode, healthyResponse, entry, botShortUrl, dateLabel);
  if (!hasHealthy && !hasFull) return null;

  return (
    <>
      <div style={{ marginTop: 4 }}>
        {hasHealthy && (
          <>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-faint)',
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              Можно сохранить карточку и перечитывать, когда снова накроет.
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShare('short');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: color + '18',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                color,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Сохранить карточку
            </button>
          </>
        )}
        {hasFull && (
          <div style={{ marginTop: hasHealthy ? 10 : 0 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShare('full');
              }}
              style={modeEntryShareLinkStyle}
            >
              Поделиться всей записью
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>
              {fullProps?.hint}
            </div>
          </div>
        )}
      </div>
      {share === 'short' && shortProps && (
        <ShareCardSheet {...shortProps} onClose={() => setShare(null)} />
      )}
      {share === 'full' && fullProps && (
        <ShareCardSheet {...fullProps} onClose={() => setShare(null)} />
      )}
    </>
  );
}
