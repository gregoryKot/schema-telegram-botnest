import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { contactCta } from '../utils/therapistContact';
import { botShortUrl } from '../utils/botConfig';
import { ysqShareCard } from '../../../shared/src/share/cards/ysqCard';
import { SsSheet } from './schemaSheets/SsSheet';
import { YsqIntro } from './ysq/YsqIntro';
import { YsqQuestion } from './ysq/YsqQuestion';
import { YsqResult } from './ysq/YsqResult';
import { YsqResultHero } from './ysq/YsqResultHero';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useYsqTest, useYsqSchemas, buildShareText, YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../hooks/useYsqTest';
import { api } from '../api';

export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY };

interface Props {
  onClose: () => void;
  ratings?: Record<string, number>;
  autoResume?: boolean;
  onViewSchemas?: (schemaName: string) => void;
}

export function YSQTestSheet({ onClose, ratings, autoResume, onViewSchemas }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const cta = contactCta();
  const ysqSchemas = useYsqSchemas(); // tip зависит от addressForm — не TIP_VY-вилкой
  const {
    phase, setPhase,
    answers,
    page,
    slideKey, slideDir,
    history,
    hasProgress,
    inactiveExpanded, setInactiveExpanded,
    retakeConfirm, setRetakeConfirm,
    progressAnswered,
    handleContinue, handleStartFresh,
    selectAnswer,
    handleBack, handleRetake,
    scores, resultView,
    resumeCheckFailed, retryResumeCheck, resultSaveError, retrySaveResult,
  } = useYsqTest({ api, autoResume });

  const [showShare, setShowShare] = useState(false);

  if (phase === 'test') {
    return (
      <YsqQuestion
        page={page}
        slideKey={slideKey}
        slideDir={slideDir}
        answer={answers[page]}
        onSelect={(value) => selectAnswer(page, value)}
        onBack={handleBack}
        onClose={() => setPhase('intro')}
      />
    );
  }

  // ── Intro + Result ────────────────────────────────────────────────────────────
  // Результат — разворот: на компьютере герой и «Как понимать» слева колонкой, схемы справа.
  const result = phase === 'result' && scores && resultView ? resultView : null;
  return (
    <>
      <SsSheet onBack={goBack} zIndex={300} spread={!!result}
        hero={result ? <YsqResultHero tr={tr} view={result} onShare={() => setShowShare(true)} /> : undefined}>
        {phase === 'intro' && (
          <YsqIntro
            tr={tr}
            hasProgress={hasProgress}
            progressAnswered={progressAnswered}
            resumeCheckFailed={resumeCheckFailed}
            retryResumeCheck={retryResumeCheck}
            onContinue={handleContinue}
            onStartFresh={handleStartFresh}
            onCancel={goBack}
          />
        )}
        {result && scores && (
          <YsqResult
            tr={tr}
            scores={scores}
            view={result}
            ysqSchemas={ysqSchemas}
            history={history}
            ratings={ratings}
            cta={cta}
            resultSaveError={resultSaveError}
            retrySaveResult={retrySaveResult}
            inactiveExpanded={inactiveExpanded}
            onToggleInactive={() => setInactiveExpanded(prev => !prev)}
            retakeConfirm={retakeConfirm}
            onRetakeConfirm={setRetakeConfirm}
            onRetake={handleRetake}
            onOpenSchema={(name) => goBack(onViewSchemas && (() => onViewSchemas(name)))}
            onDone={goBack}
          />
        )}
      </SsSheet>

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
