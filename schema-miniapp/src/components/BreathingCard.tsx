// «Дыши со мной» — мини-апп-обёртка над общей карточкой дыхания 4-4-6
// (shared/practices/BreathingCard). Сама карточка переехала в shared при
// переносе «Здесь и сейчас» на сайт: вёрстка у площадок совпала бы построчно,
// значит она общая (правило №3), а различаются только api, ShareCardSheet и
// botShortUrl — они и приходят инъекцией.
import { api } from '../api';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';
import { BreathingCard as SharedBreathingCard } from '../../../shared/src/practices/BreathingCard';

export function BreathingCard() {
  return (
    <SharedBreathingCard
      api={api}
      ShareCardSheet={ShareCardSheet}
      botShortUrl={botShortUrl}
    />
  );
}
