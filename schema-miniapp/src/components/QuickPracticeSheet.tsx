// Быстрая практика «Здесь и сейчас» (заземление 5-4-3-2-1, техника «Стоп») —
// мини-апп-обёртка над общим QuickPracticeFlow: подставляет своё (api,
// пошаговый лист на BottomSheet, ShareCardSheet, botShortUrl), логика и
// контент общие с сайтом (правило №3). Карточка шаринга — поверх листа
// практики (лист 200 → карточка 300).
import { StepFlowSheet } from './StepFlowSheet';
import { api } from '../api';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';
import { QuickPracticeFlow } from '../../../shared/src/practices/QuickPracticeFlow';
import type { QuickPracticeId } from '../../../shared/src/practices/quickPractices';

interface Props {
  id: QuickPracticeId;
  onClose: () => void;
}

export function QuickPracticeSheet({ id, onClose }: Props) {
  return (
    <QuickPracticeFlow
      id={id}
      onClose={onClose}
      api={api}
      StepFlow={StepFlowSheet}
      ShareCardSheet={ShareCardSheet}
      botShortUrl={botShortUrl}
      shareZIndex={300}
    />
  );
}
