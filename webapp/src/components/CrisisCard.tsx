// Тонкая обёртка над общей CrisisCardView (правило №3): свой tr (ты/вы) и track.
// Оболочка — ds-card с рамкой --err (.sd-crisis в styles/sheet-diary.css).
import { useTr } from '../utils/addressForm';
import { CrisisCardView } from '../../../shared/src/components/CrisisCard';
import { api } from '../api';
import '../styles/sheet-diary.css';
export function CrisisCard(p: { surface?: string; standing?: boolean } = {}) {
  const tr = useTr();
  return <div className="ds-card ds-card--row sd-crisis"><CrisisCardView {...p} tr={tr} track={api.trackEvent} /></div>;
}
