// «Дыши со мной» на сайте — обёртка над общей рамкой дыхания 4-4-6
// (createBreathingCard в shared/practices, правило №3): api, ShareCardSheet и
// botShortUrl — инъекцией, вёрстка — лист персика с живой сценой (BreathingPaperView).
// В разделе «Практики» — на странице, из ⌘K, итога разбора и паттерна — в листе (BreathingSheet).
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { createBreathingCard, type BreathingCardProps } from '../../../../shared/src/practices/createBreathingCard';
import { PracticeDoneFooterSite } from '../../../../shared/src/practices/PracticeDoneFooterSite';
import type { PracticeDoneFooterProps } from '../../../../shared/src/practices/PracticeDoneFooter';
import { BreathingPaperView } from './BreathingPaperView';

// «поделиться» — сразу за счётчиком: на широком листе край колонки текста висел посреди карточки.
const BreathFooter = (p: PracticeDoneFooterProps) => <PracticeDoneFooterSite {...p} packed />;
const BreathingSiteCard = createBreathingCard(BreathingPaperView, BreathFooter);

type SheetProps = Pick<BreathingCardProps, 'onClose' | 'note' | 'frame' | 'shareZIndex' | 'titleAs'>;

export function BreathingCard(props: SheetProps) {
  return <BreathingSiteCard api={api} ShareCardSheet={ShareCardSheet} botShortUrl={botShortUrl} {...props} />;
}
