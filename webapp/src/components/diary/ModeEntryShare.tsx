import { ShareCardSheet } from '../../share/ShareCardSheet';
import { useModeEntryShare } from '../../../../shared/src/share/useModeEntryShare';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';
import type { ModeEntryMode } from '../../../../shared/src/share/cards/modeEntryCard';
import { botShortUrl } from '../../utils/botConfig';

// Обе кнопки шаринга — ОДИН вид. Раньше первая была плашкой «Сохранить
// карточку», а вторая — подчёркнутой ссылкой: два соседних действия одного
// смысла читались как разные элементы (замечание пользователя, 2026-08).
const shareBtnStyle = (color: string) =>
  ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
    borderRadius: 'var(--r-12)',
    minHeight: 40,
    padding: '0 14px',
    color,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }) as const;

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
              style={shareBtnStyle(color)}
            >
              Поделиться карточкой
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
              style={shareBtnStyle(color)}
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
