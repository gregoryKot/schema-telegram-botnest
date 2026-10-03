// «Дыши со мной» на сайте — обёртка над общей карточкой дыхания 4-4-6
// (shared/practices/BreathingCard, правило №3): api, ShareCardSheet и
// botShortUrl — инъекцией, вёрстка — editorial-вариант variant="site".
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { BreathingCard as SharedBreathingCard } from '../../../../shared/src/practices/BreathingCard';

export function BreathingCard() {
  return (
    <SharedBreathingCard
      api={api}
      ShareCardSheet={ShareCardSheet}
      botShortUrl={botShortUrl}
      variant="site"
    />
  );
}
