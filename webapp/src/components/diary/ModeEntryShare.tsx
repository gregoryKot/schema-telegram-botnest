import { ShareTwoOptions } from '../../../../shared/src/share/ShareTwoOptions';
import { useModeEntryShare } from '../../../../shared/src/share/useModeEntryShare';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';
import type { ModeEntryMode } from '../../../../shared/src/share/cards/modeEntryCard';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { SharePickSheet } from '../../share/SharePickSheet';
import { ShareLink } from '../../share/ShareLink';
import { botShortUrl } from '../../utils/botConfig';

/**
 * Поделиться записью режима: одна ссылка «Поделиться →» (ShareTwoOptions, как у разбора фразы).
 * Есть краткая карточка и вся запись — выбор в шторке, один вариант — сразу его лист.
 * stopPropagation — тап не сворачивает запись.
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
  const { share, setShare, shortProps, fullProps } = useModeEntryShare(
    mode, healthyResponse, entry, botShortUrl, dateLabel,
  );
  if (!shortProps && !fullProps) return null;
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <ShareTwoOptions
        share={share}
        setShare={setShare}
        shortProps={shortProps}
        fullProps={fullProps}
        shortLabel="Краткая карточка"
        shortHint="На карточке — только Голос Здорового Взрослого."
        fullLabel="Вся запись"
        zIndex={330}
        Sheet={ShareCardSheet}
        Picker={SharePickSheet}
        Link={ShareLink}
      />
    </span>
  );
}
