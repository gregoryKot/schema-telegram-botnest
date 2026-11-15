// Поделиться разбором «Критик или забота?» (правило №3): краткая карточка
// «было → стало» или весь разбор с приметами. Ветвление и пропсы считает
// phraseCheckShareOptions, вёрстку даёт ShareTwoOptions; лист, шторку выбора и
// ссылку площадки передаёт обёртка.
import { ShareTwoOptions, type ShareTwoOptionsProps } from './ShareTwoOptions';
import { usePhraseCheckShare } from './usePhraseCheckShare';
import type { PhraseMarkId } from '../phraseCheck/criteria';

type Platform = Pick<ShareTwoOptionsProps, 'Sheet' | 'Picker' | 'Link'>;

export function PhraseCheckShare({
  phrase,
  marks,
  rewrite,
  link,
  zIndex,
  ...platform
}: Platform & {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite?: string;
  link: string;
  zIndex?: number;
}) {
  const { share, setShare, shortProps, fullProps } = usePhraseCheckShare(
    phrase,
    marks,
    rewrite,
    link,
  );
  return (
    <ShareTwoOptions
      share={share}
      setShare={setShare}
      shortProps={shortProps}
      fullProps={fullProps}
      shortLabel="Краткая карточка"
      shortHint="На карточке — только две реплики: было и стало."
      fullLabel="Весь разбор"
      zIndex={zIndex}
      {...platform}
    />
  );
}
