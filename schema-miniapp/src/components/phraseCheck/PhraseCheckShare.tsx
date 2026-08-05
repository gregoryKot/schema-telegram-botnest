import { ShareTwoOptions } from '../../share/ShareTwoOptions';
import { usePhraseCheckShare } from '../../../../shared/src/share/usePhraseCheckShare';
import type { PhraseMarkId } from '../../../../shared/src/phraseCheck/criteria';
import { botShortUrl } from '../../utils/botConfig';

/**
 * Поделиться разбором: краткая карточка «было → стало» первична (нужна
 * переписанная фраза), вторая опция — весь разбор с приметами. Ветвление и
 * пропсы считает phraseCheckShareOptions (shared, правило №11), вёрстку даёт
 * общий ShareTwoOptions — здесь остаются только тексты этой фичи.
 */
export function PhraseCheckShare({
  phrase,
  marks,
  rewrite,
}: {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite?: string;
}) {
  const { share, setShare, shortProps, fullProps } = usePhraseCheckShare(
    phrase,
    marks,
    rewrite,
    botShortUrl,
  );

  return (
    <ShareTwoOptions
      share={share}
      setShare={setShare}
      shortProps={shortProps}
      fullProps={fullProps}
      shortHint="На карточке — только две реплики: было и стало."
      fullLabel="Поделиться всем разбором"
      zIndex={300}
    />
  );
}
