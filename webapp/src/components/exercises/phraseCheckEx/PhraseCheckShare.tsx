// Поделиться разбором «Критик или забота?»: логика и тексты — shared/share/PhraseCheckShare, здесь лист
// карточки, шторка выбора и тихая ссылка «Поделиться» сайта.
import { PhraseCheckShare as Shared } from '../../../../../shared/src/share/PhraseCheckShare';
import { ShareCardSheet } from '../../../share/ShareCardSheet';
import { SharePickSheet } from '../../../share/SharePickSheet';
import { ShareLink } from '../../../share/ShareLink';
import type { PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';
import { botShortUrl } from '../../../utils/botConfig';

export function PhraseCheckShare(props: {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite?: string;
}) {
  return <Shared {...props} link={botShortUrl} Sheet={ShareCardSheet} Picker={SharePickSheet} Link={ShareLink} zIndex={330} />;
}
