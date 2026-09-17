// Быстрая практика «Здесь и сейчас» с пошаговым флоу (заземление 5-4-3-2-1,
// техника «Стоп») — один компонент на обе и на обе площадки (правило №3 и
// «одна механика — один компонент»). Контент — shared/practices/quickPractices,
// пошаговое тело — StepFlowBody, done-экран фиксирует прохождение через
// useQuickPractice и показывает счётчик + «Поделиться» (PracticeDoneFooter).
// Площадочное приходит инъекцией, как ShareCardSheet в MonthShareButton:
// свой пошаговый лист (оболочка-шит у webapp и мини-аппа разная), свой
// ShareCardSheet, свой api и botShortUrl. Событие stop_start парное с
// ANALYTICS_EVENTS на бэке (src/analytics/analytics.constants.ts) — уходит
// только для техники «Стоп» (у заземления своего события нет).
import { useEffect, useState, type ComponentType } from 'react';
import { PracticeDoneFooter, practiceCountLabel } from './PracticeDoneFooter';
import type { StepFlowProps } from './StepFlowBody';
import { useQuickPractice, type QuickPracticeApi } from './useQuickPractice';
import { useTr } from '../utils/addressForm';
import { drawPracticeCard } from '../share/cards/practiceCard';
import { practiceShareText } from '../share/shareTexts';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';
import { buildQuickPractice, type QuickPracticeId } from './quickPractices';

export interface QuickPracticeFlowProps {
  id: QuickPracticeId;
  onClose: () => void;
  api: QuickPracticeApi & {
    trackEvent: (name: string, meta?: Record<string, unknown>) => void;
  };
  StepFlow: ComponentType<StepFlowProps>;
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  botShortUrl: string;
  /** Карточка шаринга обязана лечь ПОВЕРХ листа практики, а слои у площадок
   * разные (мини-апп: лист 200 → карточка 300; сайт: лист 300 → карточка 320). */
  shareZIndex: number;
}

export function QuickPracticeFlow({
  id,
  onClose,
  api,
  StepFlow,
  ShareCardSheet,
  botShortUrl,
  shareZIndex,
}: QuickPracticeFlowProps) {
  const tr = useTr();
  const practice = buildQuickPractice(id, tr);
  const { count, complete } = useQuickPractice(id, api);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (id === 'stop') api.trackEvent('stop_start');
  }, [id, api]);

  const countLabel = practiceCountLabel(count);

  return (
    <>
      <StepFlow
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
          zIndex={shareZIndex}
        />
      )}
    </>
  );
}
