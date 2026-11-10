import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { useDeleteAction } from '../../../../shared/src/diary/diaryDelete';
import { deleteFailedNote } from '../../../../shared/src/diary/deleteFailedNote';
import { PaperAlert } from '../../components/paper/PaperAlert';
import '../../styles/delete-btn.css';

// «Удалить» → «Удалить навсегда» в карточке записи (дневник, прошлый разбор фразы): тихая ссылка, подтверждение —
// в той же строке текстом цвета ошибки без заливки (залитая — только главная кнопка экрана). Пока запрос идёт, кнопки
// выключены; сбой — компактный лист соломы (PaperAlert) под ними, запись остаётся (QA 2026-11, З2; ревью g3 r5).
export function DeleteBtn({ onClick }: { onClick: () => void | Promise<void> }) {
  const tr = useTr();
  const [confirm, setConfirm] = useState(false);
  const { busy, failed, run } = useDeleteAction(onClick);
  if (!confirm) return <button type="button" className="ds-link cd-del" onClick={e => { e.stopPropagation(); setConfirm(true); }}>Удалить</button>;
  return (
    <div className="cd-del-row" role="presentation" onClick={e => e.stopPropagation()}>
      <button type="button" className="ds-link ds-link--danger cd-del" disabled={busy} aria-busy={busy || undefined} onClick={() => { void run(); }}>Удалить навсегда</button>
      <button type="button" className="ds-link cd-del" disabled={busy} onClick={() => setConfirm(false)}>Отмена</button>
      {failed && <PaperAlert role="status" sign="sheets" className="cd-del-err" {...deleteFailedNote(tr)} />}
    </div>
  );
}
