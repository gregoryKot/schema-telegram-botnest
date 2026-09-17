// Быстрая практика «Здесь и сейчас» (заземление 5-4-3-2-1, техника «Стоп») на
// сайте — обёртка над общим QuickPracticeFlow: подставляет своё (api,
// пошаговый лист на BottomSheetShell, ShareCardSheet, botShortUrl), логика и
// контент общие с мини-аппом (правило №3). Карточка шаринга ложится поверх
// листа практики: лист 300 → карточка 320 (слои webapp, как у
// PhraseHistoryCard над шитом).
import { StepFlowSheet } from './StepFlowSheet';
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { QuickPracticeFlow } from '../../../../shared/src/practices/QuickPracticeFlow';
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
    />
  );
}
