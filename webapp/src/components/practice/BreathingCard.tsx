// «Дыши со мной» на сайте — обёртка над общей карточкой дыхания 4-4-6
// (shared/practices/BreathingSiteCard, правило №3): api, ShareCardSheet и
// botShortUrl — инъекцией, вёрстка — editorial.
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { BreathingSiteCard } from '../../../../shared/src/practices/BreathingSiteCard';

export function BreathingCard() {
  return (
    <BreathingSiteCard
      api={api}
      ShareCardSheet={ShareCardSheet}
      botShortUrl={botShortUrl}
    />
  );
}
