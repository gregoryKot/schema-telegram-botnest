// Кликабельные строки «Прошлые разборы» (PhraseCheckEx) — общая строка прошлого ExPastRow (ревью g6): фраза
// цитатой со знаком Looming, ниже — «→ стало» со знаком Together. Тап открывает PhraseHistoryCard с правкой ответа.
import { fmtAgo } from '../../../utils/format';
import { SignArt } from '../../art/SignArt';
import { ExPastRow } from '../ExDonePage';
import { CARE_LOOK, CRITIC_LOOK } from './phraseLook';
import type { PhraseCheckEntry } from '../../../api';

export function PhraseHistoryRows({ entries, onOpen, showRewrite }: {
  entries: PhraseCheckEntry[];
  onOpen: (id: number) => void;
  showRewrite?: boolean;
}) {
  return (
    <>
      {entries.map((h) => (
        <ExPastRow key={h.id} sign={CRITIC_LOOK.sign} date={fmtAgo(h.createdAt)} quote={h.phrase}
          onOpen={() => onOpen(h.id)} openLabel={`Открыть разбор: ${h.phrase}`}>
          {showRewrite && h.rewrite && (
            <span className="ex2-phrase-now"><SignArt sign={CARE_LOOK.sign} size="nav" />→ «{h.rewrite}»</span>
          )}
        </ExPastRow>
      ))}
    </>
  );
}
