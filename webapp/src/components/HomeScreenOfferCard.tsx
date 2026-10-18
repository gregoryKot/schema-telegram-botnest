import { getHost } from '../../../shared/src/host';
import { ADD_ICON_HOP_URL, buildHomeScreenHint } from '../../../shared/src/host/homeScreen';
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
        {offer.platform === 'ios' ? (
          // iOS: настоящая ссылка — openLink и нативный вызов там молча не срабатывают
          // (подробности в мини-аппе, AddHomeScreenButton).
          <a className="ds-btn" href={ADD_ICON_HOP_URL} target="_blank" rel="noopener noreferrer" onClick={offer.noteAddTriggered}>
            Добавить значок
          </a>
        ) : (
          <button
            type="button"
            className="ds-btn"
            // Нативный вызов первым, в жесте; побочные действия после.
            onClick={() => { getHost().homeScreen.add(); offer.noteAddTriggered(); }}
          >
            Добавить значок
          </button>
        )}
      </div>
      <div className="sk-case-actions">
        <button type="button" className="ds-link sk-case-map" onClick={offer.later}>Позже</button>
        <button type="button" className="ds-link sk-case-map" onClick={offer.never}>Не предлагать</button>
      </div>
    </div>
  );
}
