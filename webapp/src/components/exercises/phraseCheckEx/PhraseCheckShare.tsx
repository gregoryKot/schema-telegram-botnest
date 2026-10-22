// Поделиться разбором «Критик или забота?» — паритет с мини-аппом. Логика и
// тексты — shared/share/PhraseCheckShare, здесь лист и кнопка сайта.
import { PhraseCheckShare as Shared } from '../../../../../shared/src/share/PhraseCheckShare';
import { ShareCardSheet } from '../../../share/ShareCardSheet';
import type { PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';
import { botShortUrl } from '../../../utils/botConfig';

const Pill = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onClick}>{label}</button>
);

export function PhraseCheckShare(props: {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite?: string;
}) {
  return <Shared {...props} link={botShortUrl} Sheet={ShareCardSheet} Pill={Pill} zIndex={330} />;
}
