import { getHost } from '../../../shared/src/host';
import { buildHomeScreenHint } from '../../../shared/src/host/homeScreen';
import { AddHomeScreenButton } from '../../../shared/src/host/AddHomeScreenButton';
import { useHomeScreenOffer } from '../hooks/useHomeScreenOffer';
import { useInstallHandoff } from '../hooks/useInstallHandoff';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-tasks.css';

// «Установить приложение» на «Сегодня» — только внутри мессенджера: кнопка открывает /install
// во внешнем браузере с кодом передачи сессии (строка в БД, одноразовая ссылка входа — его просит
// только ВИДИМАЯ карточка, OfferBody). Отложил — вернётся через неделю, отказался — не вернётся.
export function HomeScreenOfferCard() {
  const offer = useHomeScreenOffer('today');
  return offer.visible ? <OfferBody offer={offer} /> : null;
}

function OfferBody({ offer }: { offer: ReturnType<typeof useHomeScreenOffer> }) {
  const tr = useTr();
  const { href } = useInstallHandoff();
  return (
    <div className="ds-card sk-case">
      <h3 className="ds-h3">{tr('Держи под рукой', 'Держите под рукой')}</h3>
      <p className="sk-case-text">
        Приложение на экране телефона — открывается без {getHost().id === 'max' ? 'MAX' : 'Telegram'}, в одно касание. {buildHomeScreenHint(offer.platform)}
      </p>
      <div className="sk-case-actions"><AddHomeScreenButton href={href} className="ds-btn" onActivated={offer.noteAddTriggered}>Установить приложение</AddHomeScreenButton></div>
      <div className="sk-case-actions">
        <button type="button" className="ds-link sk-case-map" onClick={offer.later}>Позже</button>
        <button type="button" className="ds-link sk-case-map" onClick={offer.never}>Не предлагать</button>
      </div>
    </div>
  );
}
