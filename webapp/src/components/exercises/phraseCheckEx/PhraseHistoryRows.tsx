// Кликабельные строки «Прошлые разборы» (PhraseCheckEx) — «было → стало» (b18): фраза курсивом со знаком
// Looming, ответ — со знаком Together. Тап открывает PhraseHistoryCard с правкой ответа.
import { pressable } from '../../../utils/a11y';
import { fmtAgo } from '../../../utils/format';
import { SignArt } from '../../art/SignArt';
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
        <div key={h.id} className="ex2-hist-row ex2-phrase-row" {...pressable(() => onOpen(h.id))} aria-label={`Открыть разбор: ${h.phrase}`}>
          <span className="ex2-hist-date">{fmtAgo(h.createdAt)}</span>
          <span className="ex2-phrase-was"><SignArt sign={CRITIC_LOOK.sign} size="nav" />«{h.phrase}»</span>
          {showRewrite && h.rewrite && (
            <span className="ex2-phrase-now"><SignArt sign={CARE_LOOK.sign} size="nav" />→ «{h.rewrite}»</span>
          )}
        </div>
      ))}
    </>
  );
}
