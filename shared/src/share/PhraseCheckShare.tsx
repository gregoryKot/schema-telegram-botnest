// Поделиться разбором «Критик или забота?» — общий для обоих фронтендов
// (правило №3): краткая карточка «было → стало» первична, вторая опция — весь
// разбор с приметами. Ветвление и пропсы считает phraseCheckShareOptions,
// вёрстку даёт ShareTwoOptions; лист и кнопку площадки передаёт обёртка.
import type { ComponentProps } from 'react';
import { ShareTwoOptions } from './ShareTwoOptions';
import { usePhraseCheckShare } from './usePhraseCheckShare';
import type { PhraseMarkId } from '../phraseCheck/criteria';

type Platform = Pick<ComponentProps<typeof ShareTwoOptions>, 'Sheet' | 'Pill'>;

export function PhraseCheckShare({
  phrase,
  marks,
  rewrite,
  link,
  Sheet,
  Pill,
  zIndex,
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
      shortHint="На карточке — только две реплики: было и стало."
      fullLabel="Поделиться всем разбором"
      zIndex={zIndex}
      Sheet={Sheet}
      Pill={Pill}
    />
  );
}
