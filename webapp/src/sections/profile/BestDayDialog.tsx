import { Dialog } from '../../components/Dialog';
import { useTr } from '../../utils/addressForm';

/** Пояснение к «лучшему дню» на карточке паттернов потребностей. */
export function BestDayDialog({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  return (
    <Dialog label="Лучший день" maxWidth={400} closeOnEscape onClose={onClose}>
      <h2 className="dialog-title">Лучший день</h2>
      <p className="dialog-text cpf-dlg-p">{tr('День недели, в который твои оценки в среднем выше всего.', 'День недели, в который ваши оценки в среднем выше всего.')}</p>
      <p className="dialog-text cpf-dlg-p0">Становится точнее с каждой неделей.</p>
    </Dialog>
  );
}
