import { useTr } from '../utils/addressForm';
import { BottomSheet } from './BottomSheet';
import { api } from '../api';
import {
  useYsqTest,
  YSQ_RESULT_KEY,
  YSQ_PROGRESS_KEY,
} from '../hooks/useYsqTest';
import { TestPhase } from './ysqTestSheet/TestPhase';
import { IntroPanel } from './ysqTestSheet/IntroPanel';
import { ResultActiveSchemas } from './ysqTestSheet/ResultActiveSchemas';
import { ResultInactiveSchemas } from './ysqTestSheet/ResultInactiveSchemas';
import { ResultCta } from './ysqTestSheet/ResultCta';
import { ResultHistory } from './ysqTestSheet/ResultHistory';
import { ResultFooter } from './ysqTestSheet/ResultFooter';

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
  const tr = useTr();
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

  // ── Full-screen test phase ────────────────────────────────────────────────────
  if (phase === 'test') {
    return (
      <TestPhase
        page={page}
        currentAnswer={answers[page]}
        slideKey={slideKey}
        slideDir={slideDir}
        handleBack={handleBack}
        setPhase={setPhase}
        selectAnswer={selectAnswer}
      />
    );
  }

  // ── Intro + Result in BottomSheet ─────────────────────────────────────────────
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      {/* INTRO */}
      {phase === 'intro' && (
        <IntroPanel
          hasProgress={hasProgress}
          progressAnswered={progressAnswered}
          handleContinue={handleContinue}
          handleStartFresh={handleStartFresh}
          onClose={onClose}
        />
      )}

      {/* RESULT */}
      {phase === 'result' &&
        scores &&
        resultView &&
        (() => {
          const {
            inactiveSchemas,
            activeByDomain,
            dateLabel,
            activeCount,
            activeLabel,
            getSchemaDelta,
          } = resultView;

          return (
            <div style={{ padding: '8px 0 16px' }}>
              {/* Header */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: 'var(--text)',
                    letterSpacing: '-0.5px',
                    marginBottom: 4,
                  }}
                >
                  {activeLabel}
                </div>
                {dateLabel && (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    Пройдено {dateLabel}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.55,
                  marginBottom: 20,
                  fontStyle: 'italic',
                }}
              >
                Схема считается выраженной если больше половины ответов — 5 или
                6. Это инструмент самоисследования, не диагноз.
              </div>

              {activeCount === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '28px 0',
                    fontSize: 14,
                    color: 'var(--text-sub)',
                  }}
                >
                  Выраженных схем не обнаружено — отличный результат.
                </div>
              )}

              {/* Active schemas grouped by domain */}
              <ResultActiveSchemas
                activeByDomain={activeByDomain}
                scores={scores}
                ratings={ratings}
                getSchemaDelta={getSchemaDelta}
                tr={tr}
                onViewSchemas={onViewSchemas}
                onClose={onClose}
              />

              {/* Inactive schemas — collapsed */}
              <ResultInactiveSchemas
                inactiveSchemas={inactiveSchemas}
                scores={scores}
                inactiveExpanded={inactiveExpanded}
                setInactiveExpanded={setInactiveExpanded}
              />

              {/* CTA */}
              <ResultCta activeCount={activeCount} tr={tr} />

              {/* History timeline */}
              <ResultHistory history={history} />

              <ResultFooter
                onClose={onClose}
                retakeConfirm={retakeConfirm}
                setRetakeConfirm={setRetakeConfirm}
                handleRetake={handleRetake}
              />
            </div>
          );
        })()}
    </BottomSheet>
  );
}
