// Вид «карточка клиента», когда карточки нет (состояние — clientCardState.ts):
// скелетон по форме шапки и вкладки, пока список клиентов грузится; иначе —
// понятный ответ и дорога к списку вместо пустого экрана.
import { Skeleton, SkeletonCard } from '../Skeleton';
import { useTr } from '../../utils/addressForm';
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
      <div className="therapist-scroll therapist-scroll--client" aria-hidden data-testid="client-card-skeleton">
        <div className="tk-head">
          <Skeleton width={110} height={13} />
          <div className="tk-head-row">
            <Skeleton width={56} height={56} radius={28} />
            <Skeleton width="40%" height={28} />
          </div>
          <Skeleton width="70%" height={20} style={{ marginBottom: 14 }} />
        </div>
        <div className="tk-tabs-body">
          <div className="tk-load"><SkeletonCard height={96} /><SkeletonCard /></div>
        </div>
      </div>
    );
  }
  const failed = state === 'failed';
  return (
    <div className="therapist-scroll therapist-scroll--client">
      <div className="tk-tabs-body">
        <div className="tk-load tk-missing" role="status">
          <h2 className="ds-h2">{failed ? 'Карточка не открылась' : 'Клиент не найден'}</h2>
          <p className="ds-sub tk-missing-text">
            {failed
              ? tr('Не удалось загрузить клиентов. Проверь соединение и обнови страницу', 'Не удалось загрузить клиентов. Проверьте соединение и обновите страницу')
              : 'Карточку удалили, или ссылка ведёт не в этот кабинет.'}
          </p>
          <button className="ds-btn" onClick={onBack}>К списку клиентов</button>
        </div>
      </div>
    </div>
  );
}
