// Тонкая обёртка над общей CrisisCardView (правило №3): прокидывает свой tr
// (ты/вы) и track (аналитика). Тело карточки — в shared/src/components.
import { useTr } from '../utils/addressForm';
import { CrisisCardView } from '../../../shared/src/components/CrisisCard';
import { api } from '../api';

type Props = { surface?: string; standing?: boolean; compact?: boolean };

export function CrisisCard(p: Props = {}) {
  const tr = useTr();
  return <CrisisCardView {...p} tr={tr} track={api.trackEvent} />;
}
