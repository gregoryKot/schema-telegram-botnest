// Быстрая практика «Здесь и сейчас» (заземление 5-4-3-2-1, техника «Стоп») —
// мини-апп-обёртка над общим QuickPracticeFlow: подставляет своё (api, лист на
// BottomSheet, подвал и ShareCardSheet, botShortUrl), логика общая (правило №3).
import { StepFlowSheet } from './StepFlowSheet';
import { api } from '../api';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';
import { QuickPracticeFlow } from '../../../shared/src/practices/QuickPracticeFlow';
import { PracticeDoneFooter } from '../../../shared/src/practices/PracticeDoneFooter';
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
      Footer={PracticeDoneFooter}
    />
  );
}
