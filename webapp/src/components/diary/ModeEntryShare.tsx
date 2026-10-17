import { ShareCardSheet } from '../../share/ShareCardSheet';
import { useModeEntryShare } from '../../../../shared/src/share/useModeEntryShare';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';
import type { ModeEntryMode } from '../../../../shared/src/share/cards/modeEntryCard';
import { botShortUrl } from '../../utils/botConfig';
import '../../styles/sheet-diary.css';

// Обе кнопки шаринга — ОДИН вид (ds-btn--secondary). Раньше первая была плашкой
// «Сохранить карточку», а вторая — подчёркнутой ссылкой: два соседних действия
// одного смысла читались как разные элементы (замечание пользователя, 2026-08).
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
      <div className="sd-share">
        {hasHealthy && (
          <>
            <div className="sd-share-note">
              Можно сохранить карточку и перечитывать, когда снова накроет.
            </div>
            <button
              className="ds-btn ds-btn--secondary ds-btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                setShare('short');
              }}
            >
              Поделиться карточкой
            </button>
          </>
        )}
        {hasFull && (
          <div className="sd-share-full">
            <button
              className="ds-btn ds-btn--secondary ds-btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                setShare('full');
              }}
            >
              Поделиться всей записью
            </button>
            <div className="sd-share-note">{fullProps?.hint}</div>
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
