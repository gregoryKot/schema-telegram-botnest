import { BottomSheetShell } from '../../components/BottomSheetShell';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { CrisisBlock } from './CrisisBlock';
import '../../styles/practice-selfhelp.css';

/** Контакты помощи листом: телефоны доверия одним нажатием (правило №7). */
export function CrisisContactsSheet({ onClose, zIndex = 320 }: { onClose: () => void; zIndex?: number }) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={zIndex} label="Помощь рядом">
      <CrisisBlock />
      <button type="button" className="ds-btn ds-btn--secondary sh-close" onClick={goBack}>
        Закрыть
      </button>
    </BottomSheetShell>
  );
}
