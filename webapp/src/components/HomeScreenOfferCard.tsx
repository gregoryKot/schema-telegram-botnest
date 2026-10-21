import { buildHomeScreenHint } from '../../../shared/src/host/homeScreen';
import { AddHomeScreenButton } from '../../../shared/src/host/AddHomeScreenButton';
import { useHomeScreenOffer } from '../hooks/useHomeScreenOffer';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-tasks.css';

// Напоминание «значок на экран» на «Сегодня» — только внутри Telegram, где
// баннеры установки PWA скрыты (hideInstallOffers). Паритет с HomeScreenOfferCard
// мини-аппа: отложил — вернётся через неделю, отказался — не вернётся, добавил —
// тем более (статус отдаёт сам Telegram).
export function HomeScreenOfferCard() {
  const tr = useTr();
  const offer = useHomeScreenOffer('today');
  if (!offer.visible) return null;

  return (
    <div className="ds-card sk-case">
      <h3 className="ds-h3">{tr('Держи под рукой', 'Держите под рукой')}</h3>
      <p className="sk-case-text">
        Значок на экране телефона — заходить не через Telegram, а в одно касание.{' '}
        {buildHomeScreenHint(offer.platform, tr)}
      </p>
      <div className="sk-case-actions">
        <AddHomeScreenButton className="ds-btn" onActivated={offer.noteAddTriggered}>
          Добавить значок
        </AddHomeScreenButton>
      </div>
      <div className="sk-case-actions">
        <button type="button" className="ds-link sk-case-map" onClick={offer.later}>Позже</button>
        <button type="button" className="ds-link sk-case-map" onClick={offer.never}>Не предлагать</button>
      </div>
    </div>
  );
}
