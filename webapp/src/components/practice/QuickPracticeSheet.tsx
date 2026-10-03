// Быстрая практика «Здесь и сейчас» (заземление 5-4-3-2-1, техника «Стоп») на
// сайте — обёртка над общим QuickPracticeFlow: подставляет своё (api, лист на
// BottomSheetShell, подвал и ShareCardSheet сайта, botShortUrl), логика и
// контент общие с мини-аппом (правило №3). Шаринг поверх листа: 300 → 320.
import { StepFlowSheet } from './StepFlowSheet';
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { QuickPracticeFlow } from '../../../../shared/src/practices/QuickPracticeFlow';
import { PracticeDoneFooterSite } from '../../../../shared/src/practices/PracticeDoneFooterSite';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';

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
      shareZIndex={320}
      Footer={PracticeDoneFooterSite}
    />
  );
}
