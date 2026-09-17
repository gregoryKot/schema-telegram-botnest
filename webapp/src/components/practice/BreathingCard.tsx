// «Дыши со мной» на сайте — обёртка над общей карточкой дыхания 4-4-6
// (shared/practices/BreathingCard). Сама карточка общая: после выноса логики
// вёрстка совпала бы с мини-апповской построчно (правило №3), различаются
// только api, ShareCardSheet и botShortUrl — они и приходят инъекцией.
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
    />
  );
}
