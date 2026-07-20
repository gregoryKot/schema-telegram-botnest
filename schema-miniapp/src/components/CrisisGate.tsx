// Тонкий рендер-гейт кризисной карточки (правило №7 CLAUDE.md + правило «одна
// механика — один компонент»): собирает detectCrisisAny + CrisisCard в одном
// месте, чтобы добавление детекции в новый экран стоило одну строку JSX, а не
// пару лишних импортов на файл (важно для файлов на потолке ratchet'а №10).
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';

export function CrisisGate({
  texts,
  surface,
}: {
  texts: Array<string | null | undefined>;
  surface: string;
}) {
  return detectCrisisAny(...texts) ? <CrisisCard surface={surface} /> : null;
}
