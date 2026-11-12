// Вид «карточка клиента», когда карточки нет (clientCardState.ts): силуэт (CardSkeleton — тот же, что у оболочки),
// пока список грузится; иначе — исход на бумаге (PaperOutcome, APP_2026-11.md «Исходы служебных страниц»): не найден —
// как 404, `Cup` на соломе; сбой — «на нашей стороне», `Breath` на персике; у верха колонки (tk-outcome).
import { useTr } from '../../utils/addressForm';
import { CardHeadSkeleton, OverviewSkeleton } from './CardSkeleton';
import { PaperOutcome } from '../paper/PaperOutcome';
import type { ClientCardState } from './clientCardState';
import '../../styles/therapist-card.css';

interface Props {
  state: Exclude<ClientCardState, 'card'>;
  onBack: () => void;
}

export function ClientCardFallback({ state, onBack }: Props) {
  const tr = useTr();
  if (state === 'loading') {
    return (
      // Шапка над прокручиваемым телом (therapist-scroll--tabs): силуэт выше окна не режется overflow: hidden.
      <div className="therapist-scroll therapist-scroll--client" aria-hidden data-testid="client-card-skeleton">
        <CardHeadSkeleton />
        <div className="therapist-scroll therapist-scroll--tabs"><OverviewSkeleton /></div>
      </div>
    );
  }
  const failed = state === 'failed';
  return (
    <div className="therapist-scroll therapist-scroll--client" role="status">
      <PaperOutcome
        outcome={failed ? 'our_side' : 'wait'}
        className="tk-outcome"
        title={failed ? 'Карточка не открылась' : 'Клиент не найден'}
        lead={failed
          ? tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')
          : 'Карточку удалили, или ссылка ведёт не в этот кабинет.'}
        action={{ label: 'К списку клиентов', onClick: onBack }}
      />
    </div>
  );
}
