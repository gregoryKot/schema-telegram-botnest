// Состояние блока «поделиться разбором фразы» (правило №3). Ветвление и оба
// набора пропсов ShareCardSheet считает phraseCheckShareOptions; хук добавляет
// только useState открытого: шторки выбора или листа варианта (ShareTwoOptions).
import { useState } from 'react';
import { phraseCheckShareOptions } from './cards/phraseCheckFullCard';
import type { ShareOpen } from './ShareTwoOptions';
import type { PhraseMarkId } from '../phraseCheck/criteria';

export interface PhraseCheckShareState {
  share: ShareOpen;
  setShare: (v: ShareOpen) => void;
  hasShort: boolean;
  hasFull: boolean;
  shortProps: ReturnType<typeof phraseCheckShareOptions>['shortProps'];
  fullProps: ReturnType<typeof phraseCheckShareOptions>['fullProps'];
}

export function usePhraseCheckShare(
  phrase: string | null | undefined,
  marks: PhraseMarkId[],
  rewrite: string | null | undefined,
  link: string,
): PhraseCheckShareState {
  const [share, setShare] = useState<ShareOpen>(null);
  const { hasShort, hasFull, shortProps, fullProps } = phraseCheckShareOptions(
    phrase,
    marks,
    rewrite,
    link,
  );
  return { share, setShare, hasShort, hasFull, shortProps, fullProps };
}
