import { BottomSheetShell } from '../../components/BottomSheetShell';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { CrisisBlock } from './CrisisBlock';
import '../../styles/practice-selfhelp.css';

/** Контакты помощи листом: телефоны доверия одним нажатием (правило №7). Лист — та же бережная
 *  бумага «Помощь рядом», что на «Практике»; на телефоне не ниже родителя («Важное о самопомощи»),
 *  чтобы его край не торчал над шторкой в кризисный момент (cr-sheet, crisis.css). */
export function CrisisContactsSheet({ onClose, zIndex = 320 }: { onClose: () => void; zIndex?: number }) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={zIndex} label="Помощь рядом">
      <div className="cr-sheet">
        <CrisisBlock />
        <button type="button" className="ds-btn ds-btn--secondary sh-close" onClick={goBack}>
          Закрыть
        </button>
      </div>
    </BottomSheetShell>
  );
}
