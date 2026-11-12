import { Dialog } from '../../components/Dialog';
import { useTr } from '../../utils/addressForm';

/** Пояснение к «лучшему дню» на карточке паттернов потребностей — на бумаге шалфея, как плашка дня (cpf-pill.is-best). */
export function BestDayDialog({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  return (
    <Dialog label="Лучший день" maxWidth={420} closeOnEscape onClose={onClose}>
      <div className="pp-paper cpf-paper-dlg cpf-paper-dlg--best">
        <h2 className="dialog-title">Лучший день</h2>
        <p className="dialog-text cpf-dlg-p">{tr('День недели, в который твои оценки в среднем выше всего.', 'День недели, в который ваши оценки в среднем выше всего.')}</p>
        <p className="dialog-text cpf-dlg-p0">Становится точнее с каждой неделей.</p>
      </div>
    </Dialog>
  );
}
