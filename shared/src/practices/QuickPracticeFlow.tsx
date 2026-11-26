// Быстрая практика «Здесь и сейчас» с пошаговым флоу (заземление 5-4-3-2-1,
// техника «Стоп») — рамка логики (правило №3). Контент — quickPractices, вёрстка —
// лист площадки (StepFlow), done-экран фиксирует прохождение (useQuickPractice) и
// показывает счётчик + «Поделиться» (Footer). Площадочное — инъекцией (лист,
// ShareCardSheet, api, предупреждение `note`). stop_start — только «Стоп».
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { PracticeDoneFooterProps } from './PracticeDoneFooter';
import { practiceCountLabel } from './practiceCountLabel';
import type { StepFlowProps } from './stepFlowTypes';
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
  /** Подвал done-экрана: вёрстка площадки (PracticeDoneFooter / ...Site). */
  Footer: ComponentType<PracticeDoneFooterProps>;
  /** Под кнопками первого шага (предупреждение площадки). */
  note?: ReactNode;
}

export function QuickPracticeFlow({
  id,
  onClose,
  api,
  StepFlow,
  ShareCardSheet,
  botShortUrl,
  shareZIndex,
  Footer,
  note,
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
        id={id}
        title={practice.title}
        subtitle={practice.subtitle}
        steps={practice.steps}
        counter={practice.counter}
        done={practice.done}
        note={note}
        doneExtra={
          <Footer
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
