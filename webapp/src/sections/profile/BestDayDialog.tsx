import { Dialog } from '../../components/Dialog';
import { glue } from '../../../../shared/src/utils/typo';
import { useTr } from '../../utils/addressForm';
import { useHistorySheet } from '../../hooks/useHistorySheet';

/** Пояснение к «лучшему дню» на карточке паттернов потребностей — на бумаге шалфея, как плашка дня (cpf-pill.is-best). */
export function BestDayDialog({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose); // «Назад» браузера закрывает пояснение, а не уводит с профиля
  return (
    <Dialog label="Лучший день" maxWidth={420} closeOnEscape onClose={goBack}>
      <div className="pp-paper cpf-paper-dlg cpf-paper-dlg--best">
        <h2 className="dialog-title">Лучший день</h2>
        <p className="dialog-text cpf-dlg-p">{glue(tr('День недели, в который твои оценки в среднем выше всего.', 'День недели, в который ваши оценки в среднем выше всего.'))}</p>
        <p className="dialog-text cpf-dlg-p0">Становится точнее с каждой неделей.</p>
      </div>
    </Dialog>
  );
}
