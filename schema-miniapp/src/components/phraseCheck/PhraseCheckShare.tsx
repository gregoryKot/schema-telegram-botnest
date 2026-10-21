import { PhraseCheckShare as Shared } from '../../../../shared/src/share/PhraseCheckShare';
import { SharePill } from '../../share/SharePill';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import type { PhraseMarkId } from '../../../../shared/src/phraseCheck/criteria';
import { botShortUrl } from '../../utils/botConfig';

/** Поделиться разбором: логика и тексты — в shared, здесь лист и кнопка мини-аппа. */
export function PhraseCheckShare(props: {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite?: string;
}) {
  return (
    <Shared
      {...props}
      link={botShortUrl}
      Sheet={ShareCardSheet}
      Pill={SharePill}
      zIndex={300}
    />
  );
}
