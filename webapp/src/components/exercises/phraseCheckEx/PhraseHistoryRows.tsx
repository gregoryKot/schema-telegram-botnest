// Кликабельные строки «Прошлые разборы» (PhraseCheckEx.tsx) — вынесены
// отдельно, чтобы держать PhraseCheckEx.tsx под лимитом файла (правило №10).
// Тап открывает PhraseHistoryCard с правкой ответа.
import { pressable } from '../../../utils/a11y';
import { fmtAgo } from '../../../utils/format';
import type { PhraseCheckEntry } from '../../../api';

export function PhraseHistoryRows({
  entries,
  onOpen,
  showRewrite,
}: {
  entries: PhraseCheckEntry[];
  onOpen: (id: number) => void;
  showRewrite?: boolean;
}) {
  return (
    <>
      {entries.map((h) => (
        <div
          key={h.id}
          className="history-row"
          {...pressable(() => onOpen(h.id))}
          aria-label={`Открыть разбор: ${h.phrase}`}
        >
          <span className="history-date">{fmtAgo(h.createdAt)}</span>
          <span className="history-snippet">
            «{h.phrase}»{showRewrite && h.rewrite ? ` → «${h.rewrite}»` : ''}
          </span>
        </div>
      ))}
    </>
  );
}
