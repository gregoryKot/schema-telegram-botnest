import { BottomSheetShell } from '../../components/BottomSheetShell';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { CrisisBlock } from './CrisisBlock';
import '../../styles/practice-selfhelp.css';

/** Контакты помощи листом: телефоны доверия одним нажатием (правило №7). Лист — та же бережная
 *  бумага «Помощь рядом», что на «Практике». overSheet — поверх «Важного о самопомощи»: на телефоне не
 *  ниже родителя, чтобы его край не торчал над шторкой; отдельный лист — по содержимому (crisis.css). */
export function CrisisContactsSheet({ onClose, zIndex = 320, overSheet = false }: { onClose: () => void; zIndex?: number; overSheet?: boolean }) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={zIndex} label="Помощь рядом">
      <div className={overSheet ? 'cr-sheet cr-sheet--fill' : 'cr-sheet'}>
        <CrisisBlock />
        <button type="button" className="ds-btn ds-btn--secondary sh-close" onClick={goBack}>
          Закрыть
        </button>
      </div>
    </BottomSheetShell>
  );
}
