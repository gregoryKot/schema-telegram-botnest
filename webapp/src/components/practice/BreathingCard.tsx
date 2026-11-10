// «Дыши со мной» на сайте — обёртка над общей рамкой дыхания 4-4-6
// (createBreathingCard в shared/practices, правило №3): api, ShareCardSheet и
// botShortUrl — инъекцией, вёрстка — лист персика с живой сценой (BreathingPaperView).
// В разделе «Практики» — на странице, из ⌘K, итога разбора и паттерна — в листе (BreathingSheet).
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { createBreathingCard, type BreathingCardProps } from '../../../../shared/src/practices/createBreathingCard';
import { PracticeDoneFooterSite } from '../../../../shared/src/practices/PracticeDoneFooterSite';
import { BreathingPaperView } from './BreathingPaperView';

const BreathingSiteCard = createBreathingCard(BreathingPaperView, PracticeDoneFooterSite);

type SheetProps = Pick<BreathingCardProps, 'onClose' | 'note' | 'frame' | 'shareZIndex'>;

export function BreathingCard(props: SheetProps) {
  return <BreathingSiteCard api={api} ShareCardSheet={ShareCardSheet} botShortUrl={botShortUrl} {...props} />;
}
