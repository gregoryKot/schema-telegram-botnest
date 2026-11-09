// Плашка «нет сети» на телефоне и компьютере (там — под верхней строкой, слова «офлайн» в шапке нет): полоса
// соломы со знаком Cup — «подождём, всё сохранится», без красного (index.css). Текст безличный.
import { NavSign } from './appShell/NavSign';

export function OfflineBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div className="pp-paper offline-banner" role="status">
      <NavSign sign="cup" size="empty" /><span>Нет сети. Оценки сохранятся на устройстве и отправятся, когда сеть вернётся.</span>
    </div>
  );
}
