// Быстрая практика «Здесь и сейчас» с пошаговым флоу (заземление 5-4-3-2-1,
// техника «Стоп») — один компонент на обе (правило №11 CLAUDE.md: после
// переезда контента в shared оба листа стали структурно одинаковыми,
// разница только в id практики — было два клона в jscpd-храповике, вынесено
// в модуль вместо копирования). Контент — общий источник
// shared/src/practices/quickPractices.ts (правило №3). Пошаговый рендер —
// StepFlowSheet (правило «одна механика — один компонент»). Done-экран
// фиксирует прохождение через useQuickPractice и показывает счётчик +
// «Поделиться» (PracticeDoneFooter — общий подвал трёх практик, включая
// дыхание в BreathingCard). Событие stop_start парное с ANALYTICS_EVENTS на
// бэке (src/analytics/analytics.constants.ts) — уходит только для техники
// «Стоп» (у заземления своего события нет).
import { useEffect, useState } from 'react';
import { StepFlowSheet } from './StepFlowSheet';
import { PracticeDoneFooter, practiceCountLabel } from './PracticeDoneFooter';
import { useTr } from '../utils/addressForm';
import { useQuickPractice } from '../hooks/useQuickPractice';
import { api } from '../api';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawPracticeCard } from '../../../shared/src/share/cards/practiceCard';
import { practiceShareText } from '../../../shared/src/share/shareTexts';
import {
  buildQuickPractice,
  type QuickPracticeId,
} from '../../../shared/src/practices/quickPractices';
import { botShortUrl } from '../utils/botConfig';

interface Props {
  id: QuickPracticeId;
  onClose: () => void;
}

export function QuickPracticeSheet({ id, onClose }: Props) {
  const tr = useTr();
  const practice = buildQuickPractice(id, tr);
  const { count, complete } = useQuickPractice(id);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (id === 'stop') api.trackEvent('stop_start');
  }, [id]);

  const countLabel = practiceCountLabel(count);

  return (
    <>
      <StepFlowSheet
        title={practice.title}
        subtitle={practice.subtitle}
        steps={practice.steps}
        done={practice.done}
        doneExtra={
          <PracticeDoneFooter
            count={count}
            onShown={complete}
            onShare={() => setShowShare(true)}
          />
        }
        onClose={onClose}
      />
      {showShare && (
        <ShareCardSheet
          title={practice.title}
          draw={(canvas) => drawPracticeCard(canvas, practice, countLabel)}
          shareText={practiceShareText(practice.title, countLabel, botShortUrl)}
          filename={`practice-${id}.png`}
          eventKind="practice"
          onClose={() => setShowShare(false)}
          zIndex={300}
        />
      )}
    </>
  );
}
