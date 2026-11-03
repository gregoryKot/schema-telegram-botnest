import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { deleteFailedText, useDeleteAction } from '../../../../shared/src/diary/diaryDelete';

// «Удалить» → «Удалить навсегда» в карточке записи. Пока запрос идёт, кнопка
// выключена; сбой — строка под кнопками, запись остаётся (QA 2026-11, З2).
export function DeleteBtn({ onClick }: { onClick: () => void | Promise<void> }) {
  const tr = useTr();
  const [confirm, setConfirm] = useState(false);
  const { busy, failed, run } = useDeleteAction(onClick);
  if (!confirm) return (
    <button className="ds-btn ds-btn--sm ds-btn--secondary cd-del" onClick={e => { e.stopPropagation(); setConfirm(true); }}>Удалить</button>
  );
  return (
    <div className="cd-del-row" role="presentation" onClick={e => e.stopPropagation()}>
      <button className="ds-btn ds-btn--sm ds-btn--accent" disabled={busy} onClick={() => { void run(); }}>Удалить навсегда</button>
      <button className="ds-btn ds-btn--sm ds-btn--secondary" disabled={busy} onClick={() => setConfirm(false)}>Отмена</button>
      {failed && <p role="alert" className="cd-del-err">{deleteFailedText(tr)}</p>}
    </div>
  );
}
