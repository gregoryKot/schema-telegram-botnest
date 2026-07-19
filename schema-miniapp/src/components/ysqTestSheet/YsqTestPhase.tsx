import { QUESTIONS, getSchemaForQuestion } from '../../hooks/useYsqTest';
import { YsqTestHeader } from '../../../../shared/src/components/YsqTestHeader';
import { YsqAnswerList } from '../../../../shared/src/components/YsqAnswerList';

interface Props {
  page: number;
  currentAnswer: number;
  slideKey: number;
  slideDir: 'forward' | 'back';
  safeTop: number;
  onBack: () => void;
  onExit: () => void;
  onSelect: (value: number) => void;
}

// ── Full-screen test phase ────────────────────────────────────────────────────
export function YsqTestPhase({
  page,
  currentAnswer,
  slideKey,
  slideDir,
  safeTop,
  onBack,
  onExit,
  onSelect,
}: Props) {
  const qIdx = page;
  const schema = getSchemaForQuestion(qIdx);

  return (
    <>
      <style>{`
        @keyframes slideFromRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideFromLeft  { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <YsqTestHeader
          page={page}
          topInset={safeTop}
          onBack={onBack}
          onClose={onExit}
        />

        {/* Question — animated on page change */}
        <div
          key={slideKey}
          style={{
            flex: 1,
            padding: '24px 20px 16px',
            overflowY: 'auto',
            animation: `${slideDir === 'forward' ? 'slideFromRight' : 'slideFromLeft'} 0.22s cubic-bezier(0.25,0.46,0.45,0.94)`,
          }}
        >
          {schema && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: schema.color,
                marginBottom: 12,
              }}
            >
              {schema.name}
            </div>
          )}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.45,
            }}
          >
            {QUESTIONS[qIdx]}
          </div>
        </div>

        <YsqAnswerList
          currentAnswer={currentAnswer}
          onSelect={onSelect}
          unselectedBg="var(--surface)"
          radioColor="var(--accent)"
        />
      </div>
    </>
  );
}
