import { useState } from 'react';
import { useSafeTop } from '../utils/safezone';
import { BottomSheet } from './BottomSheet';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';
import { ysqShareCard } from '../../../shared/src/share/cards/ysqCard';
import { api } from '../api';
import {
  useYsqTest,
  buildShareText,
  YSQ_RESULT_KEY,
  YSQ_PROGRESS_KEY,
} from '../hooks/useYsqTest';
import { YsqTestPhase } from './ysqTestSheet/YsqTestPhase';
import { YsqIntro } from './ysqTestSheet/YsqIntro';
import { YsqResultView } from './ysqTestSheet/YsqResultView';

export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY };

interface Props {
  onClose: () => void;
  ratings?: Record<string, number>;
  autoResume?: boolean;
  onViewSchemas?: (schemaName: string) => void;
}

export function YSQTestSheet({
  onClose,
  ratings,
  autoResume,
  onViewSchemas,
}: Props) {
  const safeTop = useSafeTop();
  const {
    phase,
    setPhase,
    answers,
    page,
    slideKey,
    slideDir,
    history,
    hasProgress,
    inactiveExpanded,
    setInactiveExpanded,
    retakeConfirm,
    setRetakeConfirm,
    progressAnswered,
    handleContinue,
    handleStartFresh,
    selectAnswer,
    handleBack,
    handleRetake,
    scores,
    resultView,
  } = useYsqTest({ api, autoResume });

  const [showShare, setShowShare] = useState(false);

  // ── Full-screen test phase ────────────────────────────────────────────────────
  if (phase === 'test') {
    return (
      <YsqTestPhase
        page={page}
        currentAnswer={answers[page]}
        slideKey={slideKey}
        slideDir={slideDir}
        safeTop={safeTop}
        onBack={handleBack}
        onExit={() => setPhase('intro')}
        onSelect={(value) => selectAnswer(page, value)}
      />
    );
  }

  // ── Intro + Result in BottomSheet ─────────────────────────────────────────────
  return (
    <>
      <BottomSheet onClose={onClose} zIndex={300}>
        {/* INTRO */}
        {phase === 'intro' && (
          <YsqIntro
            hasProgress={hasProgress}
            progressAnswered={progressAnswered}
            onContinue={handleContinue}
            onStartFresh={handleStartFresh}
            onClose={onClose}
          />
        )}

        {/* RESULT */}
        {phase === 'result' && scores && resultView && (
          <YsqResultView
            scores={scores}
            resultView={resultView}
            ratings={ratings}
            history={history}
            inactiveExpanded={inactiveExpanded}
            setInactiveExpanded={setInactiveExpanded}
            retakeConfirm={retakeConfirm}
            setRetakeConfirm={setRetakeConfirm}
            onViewSchemas={onViewSchemas}
            onClose={onClose}
            onShare={() => setShowShare(true)}
            onRetake={handleRetake}
          />
        )}
      </BottomSheet>

      {/* Шаринг результата — общий механизм share-карточек (kind 'ysq') */}
      {showShare && scores && resultView && (
        <ShareCardSheet
          {...ysqShareCard(scores, resultView, botShortUrl)}
          fallbackText={buildShareText(scores, resultView.dateLabel)}
          onClose={() => setShowShare(false)}
          zIndex={400}
          therapyNote
        />
      )}
    </>
  );
}
