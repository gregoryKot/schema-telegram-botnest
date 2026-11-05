// «Дыши со мной» на сайте — обёртка над общей рамкой дыхания 4-4-6
// (createBreathingCard в shared/practices, правило №3): api, ShareCardSheet и
// botShortUrl — инъекцией, вёрстка — герой-блок бумажной аппликации.
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { createBreathingCard } from '../../../../shared/src/practices/createBreathingCard';
import { PracticeDoneFooterSite } from '../../../../shared/src/practices/PracticeDoneFooterSite';
import { BreathingPaperView } from './BreathingPaperView';

const BreathingSiteCard = createBreathingCard(BreathingPaperView, PracticeDoneFooterSite);

export function BreathingCard() {
  return <BreathingSiteCard api={api} ShareCardSheet={ShareCardSheet} botShortUrl={botShortUrl} />;
}
