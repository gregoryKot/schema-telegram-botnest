// Тонкая обёртка над общей CrisisCardView (правило №3): прокидывает свой tr
// (ты/вы) и track (аналитика). Тело карточки — в shared/src/components.
import { useTr } from '../utils/addressForm';
import { CrisisCardView } from '../../../shared/src/components/CrisisCard';
import { api } from '../api';

export function CrisisCard({ surface }: { surface?: string } = {}) {
  const tr = useTr();
  return <CrisisCardView surface={surface} tr={tr} track={api.trackEvent} />;
}
