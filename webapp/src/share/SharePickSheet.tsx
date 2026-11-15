// Шторка «Чем поделиться?» за ссылкой «Поделиться →» (ShareTwoOptions, shared): варианты карточки строками
// с подписью, что на ней. Выбор — goBack(then): шторка закрывается, следом открывается лист карточки.
import { useHistorySheet } from '../hooks/useHistorySheet';
import { BottomSheetShell } from '../components/BottomSheetShell';
import { glue } from '../../../shared/src/utils/typo';
import type { SharePickSheetProps } from '../../../shared/src/share/ShareTwoOptions';

export function SharePickSheet({ title, options, onPick, onClose, zIndex = 300 }: SharePickSheetProps) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={zIndex} label={title}>
      <h2 className="ds-h3">{title}</h2>
      {options.map((o) => (
        <button key={o.id} type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover ds-list-row--inset"
          onClick={() => goBack(() => onPick(o.id))}>
          <span className="ds-list-body">
            <span className="ds-list-title">{o.label}</span>
            {o.hint && <span className="ds-list-sub">{glue(o.hint)}</span>}
          </span>
          <span className="ds-chev" aria-hidden="true" />
        </button>
      ))}
    </BottomSheetShell>
  );
}
