// Плашка «нет сети» на телефоне и компьютере (там — под верхней строкой, слова «офлайн» в шапке нет): полоса
// соломы со знаком Cup на пластине тоном глубже — «подождём, всё сохранится», без красного (index.css).
import { NavSign } from './appShell/NavSign';

export function OfflineBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div className="pp-paper offline-banner" role="status">
      <span className="offline-banner-art" aria-hidden="true"><NavSign sign="cup" size="empty" /></span><span>Нет сети. Оценки сохранятся на устройстве и отправятся, когда сеть вернётся.</span>
    </div>
  );
}
