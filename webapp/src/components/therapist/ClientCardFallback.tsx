// Вид «карточка клиента», когда карточки нет (состояние — clientCardState.ts):
// силуэт карточки (ClientCardSkeleton — тот же, что у оболочки по адресу), пока список
// клиентов грузится; иначе — исход на бумаге (PaperOutcome, APP_2026-11.md «Исходы служебных
// страниц»): не найден — как 404, `Cup` на соломе; сбой — «на нашей стороне», `Breath` на персике.
// Лист — у верха колонки кабинета (tk-outcome), а не по центру всего окна.
import { useTr } from '../../utils/addressForm';
import { ClientCardSkeleton } from '../ShellSkeletons';
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
      <div className="therapist-scroll therapist-scroll--client" aria-hidden>
        <ClientCardSkeleton />
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
