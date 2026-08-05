import { ShareTwoOptions } from '../../share/ShareTwoOptions';
import { useModeEntryShare } from '../../../../shared/src/share/useModeEntryShare';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';
import type { ModeEntryMode } from '../../../../shared/src/share/cards/modeEntryCard';
import { botShortUrl } from '../../utils/botConfig';

/**
 * Сохранить/поделиться записью режима: краткая карточка «Голос Здорового
 * Взрослого» первична (нужен healthyResponse). Вторая, более откровенная
 * опция — «поделиться всей записью» (нужен entry хоть с одним полем, кроме
 * healthyResponse). Ветвление и оба набора пропсов ShareCardSheet считает
 * modeEntryShareOptions (shared, правило №11), вёрстку даёт общий
 * ShareTwoOptions — тот же контрол, что у разбора фразы.
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
    mode,
    healthyResponse,
    entry,
    botShortUrl,
    dateLabel,
  );

  return (
    <ShareTwoOptions
      share={share}
      setShare={setShare}
      shortProps={shortProps}
      fullProps={fullProps}
      shortHint="Можно сохранить карточку и перечитывать, когда снова накроет."
      fullLabel="Поделиться всей записью"
    />
  );
}
