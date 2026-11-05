// «Дыши со мной» на сайте — обёртка над общей карточкой дыхания 4-4-6
// (createBreathingCard в shared/practices, правило №3): api, ShareCardSheet и
// botShortUrl — инъекцией, вёрстка — editorial.
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { BreathingSiteCard } from './BreathingPaperView';

export function BreathingCard() {
  return (
    <BreathingSiteCard
      api={api}
      ShareCardSheet={ShareCardSheet}
      botShortUrl={botShortUrl}
    />
  );
}
