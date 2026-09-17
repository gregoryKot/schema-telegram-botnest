// Состояние блока «поделиться разбором фразы» — общее для обоих фронтов
// (правило №3). Ветвление и оба набора пропсов ShareCardSheet считает
// phraseCheckShareOptions; хук добавляет только useState открытого варианта —
// по образцу useModeEntryShare.
import { useState } from 'react';
import { phraseCheckShareOptions } from './cards/phraseCheckFullCard';
import type { PhraseMarkId } from '../phraseCheck/criteria';

export type PhraseCheckShareKind = 'short' | 'full' | null;

/** Стиль текстовой ссылки «Поделиться всем разбором» — общий для фронтов. */
export const phraseCheckShareLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-sub)',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
} as const;

export interface PhraseCheckShareState {
  share: PhraseCheckShareKind;
  setShare: (v: PhraseCheckShareKind) => void;
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
  const [share, setShare] = useState<PhraseCheckShareKind>(null);
  const { hasShort, hasFull, shortProps, fullProps } = phraseCheckShareOptions(
    phrase,
    marks,
    rewrite,
    link,
  );
  return { share, setShare, hasShort, hasFull, shortProps, fullProps };
}
