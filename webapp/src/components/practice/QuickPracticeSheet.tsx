// Быстрая практика «Здесь и сейчас» листом — один вход для ⌘K, раздела «Практики», итога разбора
// и «Что поможет» паттерна. Дыхание — живой лист (BreathingSheet, та же механика, что в разделе),
// заземление и «Стоп» — пошаговые (общий QuickPracticeFlow + StepFlowSheet сайта); логика и
// контент общие (правило №3). Шаринг поверх листа: 300 → 320. Предупреждение «самопомощь, не
// замена терапии» — под кнопками; caution={false} — лист открыт из потока, где оно уже было.
import { StepFlowSheet } from './StepFlowSheet';
import { BreathingSheet } from './BreathingSheet';
import { TherapyCaution } from '../therapy/TherapyCaution';
import { api } from '../../api';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';
import { QuickPracticeFlow } from '../../../../shared/src/practices/QuickPracticeFlow';
import { PracticeDoneFooterSite } from '../../../../shared/src/practices/PracticeDoneFooterSite';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';

interface Props {
  id: QuickPracticeId;
  onClose: () => void;
  caution?: boolean;
}

export function QuickPracticeSheet({ id, onClose, caution = true }: Props) {
  const note = caution ? <TherapyCaution place="exercise_start" compact /> : undefined;
  if (id === 'breathing') return <BreathingSheet onClose={onClose} note={note} />;
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
      note={note}
    />
  );
}
