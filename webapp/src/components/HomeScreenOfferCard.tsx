import { getHost } from '../../../shared/src/host';
import { buildHomeScreenHint } from '../../../shared/src/host/homeScreen';
import { AddHomeScreenButton } from '../../../shared/src/host/AddHomeScreenButton';
import { useHomeScreenOffer } from '../hooks/useHomeScreenOffer';
import { useInstallHandoff } from '../hooks/useInstallHandoff';
import { useTr } from '../utils/addressForm';
import { EntitySheet } from './paper/EntitySheet';
import { EntryBrand } from './paper/EntryHead';
import '../styles/sheet-tasks.css';

// «Установить приложение» на «Ещё» — только внутри мессенджера: кнопка открывает /install во внешнем браузере
// с кодом передачи сессии (одноразовая ссылка входа — её просит только ВИДИМАЯ карточка). Отложил — вернётся
// через неделю, отказался — не вернётся. Вид — лист неба, как полоса «Приложение» лендинга; в углу — сам значок.
export function HomeScreenOfferCard() {
  const offer = useHomeScreenOffer('today');
  return offer.visible ? <OfferBody offer={offer} /> : null;
}

function OfferBody({ offer }: { offer: ReturnType<typeof useHomeScreenOffer> }) {
  const tr = useTr();
  const { href } = useInstallHandoff();
  const text = `Приложение на экране телефона — открывается без ${getHost().id === 'max' ? 'MAX' : 'Telegram'}, в одно касание. ${buildHomeScreenHint(offer.platform)}`;
  return (
    <EntitySheet look={{ hue: 240 }} art={<EntryBrand />} title={tr('Держи под рукой', 'Держите под рукой')} sub={text} className="hso-card ef-bare ef-art">
      <div className="hso-actions">
        <AddHomeScreenButton href={href} className="ds-btn" onActivated={offer.noteAddTriggered}>Установить приложение</AddHomeScreenButton>
        <span className="hso-quiet"><button type="button" className="ds-link" onClick={offer.later}>Позже</button>
          <button type="button" className="ds-link" onClick={offer.never}>Не предлагать</button></span>
      </div>
    </EntitySheet>
  );
}
