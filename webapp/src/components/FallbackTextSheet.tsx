import { BottomSheetShell } from './BottomSheetShell';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { CheckIcon } from '../../../shared/src/share/ShareIcon';

/** Запасная шторка «Поделиться текстом»: своя запись истории, «Назад» закрывает её, а не лист под ней. */
export function FallbackTextSheet({ text, copied, onCopy, onClose }: { text: string; copied: boolean; onCopy: () => void; onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={300}>
      <h2 className="ds-h3 sd-share-title">Поделиться текстом</h2>
      <pre className="sd-pre">{text}</pre>
      <button
        onClick={onCopy}
        className={'ds-btn ds-btn--secondary sd-wide' + (copied ? ' is-ok' : '')}
      >
        {copied && <CheckIcon size={17} />}
        {copied ? 'Скопировано' : 'Скопировать'}
      </button>
    </BottomSheetShell>
  );
}
